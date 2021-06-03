console.time('startup')
import * as sourceMap from 'source-map-support'
sourceMap.install()
import { Worker, isMainThread } from 'worker_threads'
import yargs from 'yargs'
import { dirname } from 'path'
import { Mutex } from 'async-mutex'
import { orderSelector } from './exchange/orders.js'
import { buildGraph, createGraphProfitCallback, worker } from './graphworker.js'
import {
  createTickCallback,
  getAvailablePairs,
  getExchangeApi,
  getExchangeWs,
  setupData,
  startSubscription,
  stopSubscription,
} from './dataservices.js'

const getIndex = async (initialAssetIndexF: number, initialAsset: string): Promise<number> =>
  initialAssetIndexF === -1
    ? Promise.reject(Error(`invalid asset ${initialAsset}`))
    : Promise.resolve(initialAssetIndexF)

const createShutdownCallback =
  (
    dropConnection: (ws: unknown) => void,
    conn: unknown,
    worker: Worker,
    mutex: Mutex,
    pairs: IndexedPair[],
    wsExchange: Closeable
  ): (() => void) =>
  async (): Promise<void> =>
    mutex.acquire().then(() => {
      // unsubsribe from everything
      stopSubscription(pairs, wsExchange)

      // kill the connections
      dropConnection(conn)
      wsExchange.close()

      // kill detached worker thread
      worker.terminate()

      console.log('shutdown complete')
    })

export const app = async (config: Config): Promise<readonly [unknown, Worker]> => {
  console.log('TODO: Implement coinbase sandbox')
  // configure everything
  const [createOrderRequest, getToken, getConnection, dropConnection, sendData] =
    await orderSelector(config.exchangeName)
  const [assets, pairs, pairMap] = await setupData(
    await getAvailablePairs(await getExchangeApi(config.exchangeName))
  )

  // validate initialasset before continuing
  const initialAssetIndex = await getIndex(
    assets.findIndex(a => a === config.initialAsset),
    config.initialAsset
  )

  // setup sockets and graph worker
  const graphWorker = new Worker(dirname(process.argv[1]) + '/litetrader.js', {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
  })
  const exchangeWs = await getExchangeWs(config.exchangeName)
  const exchangeConn = getConnection()

  // setup callbacks
  const sendMutex = new Mutex()
  const shutdownCallback = createShutdownCallback(
    dropConnection,
    exchangeConn,
    graphWorker,
    sendMutex,
    pairs,
    exchangeWs
  )
  const graphWorkerCallback = createGraphProfitCallback(
    {
      assets: assets,
      eta: config.eta,
      initialAmount: config.initialAmount,
      initialAssetIndex: initialAssetIndex,
      pairMap: pairMap,
      pairs: pairs,
      token: await getToken(config.key, new Date().getTime() * 1000),
    },
    exchangeConn,
    sendData,
    sendMutex,
    createOrderRequest,
    shutdownCallback,
    new Date(Date.now())
  )
  const tickCallback = createTickCallback(pairs, pairMap)

  // setup process handler and websockets
  process.on('SIGINT', shutdownCallback)
  exchangeWs.on('ticker', tickCallback)

  // start subscriptions and wait for initial flood of tick updates to stabilize
  console.log('stabilizing...')
  startSubscription(pairs, exchangeWs)
  await new Promise(res => setTimeout(res, 2000))

  // start processing with the graph thread
  graphWorker.on('message', graphWorkerCallback)

  // return configured threads
  console.timeEnd('startup')
  return [exchangeConn, graphWorker]
}

// process the command line args
const argv = yargs(process.argv.slice(2))
  .options({
    exchangeName: { type: 'string', default: 'kraken' },
    initialAmount: { type: 'number', default: 200 },
    initialAsset: { type: 'string', default: 'ADA' },
    eta: { type: 'number', default: 0.001 },
    apiKey: { type: 'string', default: '' },
    apiPrivateKey: { type: 'string', default: '' },
  })
  .parseSync()

// do some error handling
argv.initialAsset === null
  ? console.log('Invalid asset provided')
  : // fire it up
  isMainThread
  ? app({
      exchangeName: argv.exchangeName as ExchangeName,
      initialAmount: argv.initialAmount,
      initialAsset: argv.initialAsset,
      eta: argv.eta,
      key: {
        apiKey: argv.apiKey,
        apiPrivateKey: argv.apiPrivateKey,
      },
    })
  : worker()

// wait till shutdown of sockets and readline
