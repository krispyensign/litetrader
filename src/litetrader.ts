console.time('startup')
import * as sourceMap from 'source-map-support'
sourceMap.install()
import { Worker, isMainThread } from 'worker_threads'
import yargs from 'yargs'
import { dirname } from 'path'
import { Mutex } from 'async-mutex'
import { dropConnection, getConnection, getToken, setupAuthService } from './exchange/auth.js'
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

const createShutdownCallback =
  (
    conn: unknown,
    worker: Worker,
    mutex: Mutex,
    pairs: IndexedPair[],
    wsExchange: Closeable
  ): (() => Promise<void>) =>
  async (): Promise<void> =>
    mutex.acquire().then(async () => {
      // kill detached worker thread
      worker.terminate()

      // unsubsribe from everything
      stopSubscription(pairs, wsExchange)

      // kill the connections
      dropConnection(conn)
      wsExchange.close()

      console.log('shutdown complete')
    })

export const app = async (config: Config): Promise<readonly [unknown, Worker]> => {
  // configure everything
  console.log(config)
  setupAuthService(config.exchangeName)
  const [assets, pairs, pairMap, initialAssetIndex] = await setupData(
    await getAvailablePairs(await getExchangeApi(config.exchangeName)),
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
  const exchangeConn = getConnection(config.key)

  // setup callbacks
  const sendMutex = new Mutex()
  const shutdownCallback = createShutdownCallback(
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
    sendMutex,
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
    passphrase: { type: 'string', default: '' },
  })
  .parseSync()

// do some error handling
argv.initialAsset === null
  ? console.log('Invalid asset provided')
  : isMainThread
  ? app({
      exchangeName: argv.exchangeName as ExchangeName,
      initialAmount: argv.initialAmount,
      initialAsset: argv.initialAsset,
      eta: argv.eta,
      key: {
        apiKey: argv.apiKey,
        apiPrivateKey: argv.apiPrivateKey,
        passphrase: argv.passphrase,
      },
    })
  : worker()

// wait for shutdown
