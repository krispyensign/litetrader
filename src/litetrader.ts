console.time('startup')
import * as sourceMap from 'source-map-support'
sourceMap.install()
import { Worker, isMainThread } from 'worker_threads'
import yargs from 'yargs'
import WebSocket from 'ws'
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
    ? Promise.reject(new Error(`invalid asset ${initialAsset}`))
    : Promise.resolve(initialAssetIndexF)

const createShutdownCallback = (
  orderws: WebSocket,
  worker: Worker,
  mutex: Mutex,
  pairs: IndexedPair[],
  wsExchange: unknown
): (() => void) => async (): Promise<void> =>
  mutex.acquire().then(() => {
    // unsubsribe from everything and kill tick thread
    stopSubscription(pairs, wsExchange)

    // kill the connections ( will also kill detached threads and thus the app )
    orderws.close()
    worker.terminate()
    console.log('shutdown complete')
  })

export const app = async (config: Config): Promise<readonly [WebSocket, Worker]> => {
  console.log('TODO: Replace lib. Implement coinbase sandbox')
  // configure everything
  const [, createOrderRequest, , authWebSocketUrl, , parseEvent, getToken] = await orderSelector(
    config.exchangeName
  )
  const [assets, pairs, pairMap] = await setupData(
    await getAvailablePairs(getExchangeApi(config.exchangeName))
  )

  // validate initialasset before continuing
  const initialAssetIndex = await getIndex(
    assets.findIndex(a => a === config.initialAsset),
    config.initialAsset
  )

  // setup sockets and graph worker
  const orderws = new WebSocket(authWebSocketUrl)
  const graphWorker = new Worker(dirname(process.argv[1]) + '/litetrader.js', {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
  })
  const exchangeWs = getExchangeWs(config.exchangeName)

  // setup callbacks
  const sendMutex = new Mutex()
  const shutdownCallback = createShutdownCallback(
    orderws,
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
    orderws,
    sendMutex,
    createOrderRequest,
    shutdownCallback
  )
  const tickCallback = createTickCallback(pairs, pairMap)

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  orderws.on('message', eventData => console.log(parseEvent(eventData.toLocaleString())))
  graphWorker.on('message', graphWorkerCallback)
  exchangeWs.on('ticker', tickCallback)

  startSubscription(pairs, exchangeWs)

  // return configured threads
  return [orderws, graphWorker]
}

// process the command line args
const argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 200 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  apiKey: { type: 'string', default: '' },
  apiPrivateKey: { type: 'string', default: '' },
}).argv

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
    }).then((): void => console.timeEnd('startup'))
  : worker()

// wait till shutdown of sockets and readline
