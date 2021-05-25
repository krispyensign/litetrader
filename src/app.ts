import WebSocket from 'ws'
import { dirname } from 'path'
import { Worker } from 'worker_threads'
import { Mutex } from 'async-mutex'
import {
  getAvailablePairs,
  getExchangeApi,
  getExchangeWs,
  setupData,
  startSubscription,
  stopSubscription,
} from './dataservices.js'
import { orderSelector } from './exchange/orders.js'
import { buildGraph, createGraphProfitCallback } from './graphworker.js'

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
    // unsubsribe from everything
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

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  orderws.on('message', eventData => console.log(parseEvent(eventData.toLocaleString())))
  graphWorker.on('message', graphWorkerCallback)
  exchangeWs.on(
    'ticker',
    async (tick, market): Promise<void> => {
      const pairIndex = pairMap.get(market.id)
      if (pairIndex === undefined)
        return Promise.reject(Error(`Invalid pair encountered. ${market.id}`))
      pairs[pairIndex].ask = Number(tick.ask)
      pairs[pairIndex].bid = Number(tick.bid)
      return
    }
  )

  startSubscription(pairs, exchangeWs)

  // return configured threads
  return [orderws, graphWorker]
}
