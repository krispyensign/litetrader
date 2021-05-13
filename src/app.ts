import WebSocket from 'ws'
import { dirname } from 'path'
import { Worker, parentPort, workerData } from 'worker_threads'
import {
  createTickCallback,
  createShutdownCallback,
  createGraphProfitCallback,
} from './callbacks.js'
import { orderSelector, tickSelector } from './helpers.js'
import { buildGraph, setupData } from './setup.js'
import type { Config, Dictionary } from './types/types'
import { findCycles } from './unicycle/unicycle.js'
import { Mutex } from 'async-mutex'

export const worker = (): true => {
  // post each cycle
  for (const cycle of findCycles(
    [workerData.initialAssetIndex],
    new Map<number, readonly number[]>(
      Object.entries(workerData.graph as Dictionary<readonly number[]>).map(([k, v]) => [
        Number(k),
        v,
      ])
    )
  )) {
    parentPort?.postMessage(cycle)
  }
  return true
}

const getIndex = async (initialAssetIndexF: number, initialAsset: string): Promise<number> =>
  initialAssetIndexF === -1
    ? Promise.reject(new Error(`invalid asset ${initialAsset}`))
    : Promise.resolve(initialAssetIndexF)

export const app = async (config: Config): Promise<readonly [WebSocket, WebSocket, Worker]> => {
  // configure everything
  const [
    createStopRequest,
    createTickSubRequest,
    getAvailablePairs,
    webSocketUrl,
    parseTick,
  ] = await tickSelector(config.exchangeName)
  const [, createOrderRequest, , authWebSocketUrl, , parseEvent] = await orderSelector(
    config.exchangeName
  )

  const exchangeData = await setupData(getAvailablePairs)
  const [assets, pairs, pairMap] = exchangeData

  // token = await order.getToken(config.key)
  const token = ''

  // validate initialasset before continuing
  const initialAssetIndex = await getIndex(
    assets.findIndex(a => a === config.initialAsset),
    config.initialAsset
  )

  // setup sockets and graph worker
  const tickws = new WebSocket(webSocketUrl)
  const orderws = new WebSocket(authWebSocketUrl)
  const graphWorker = new Worker(dirname(process.argv[1]) + '/index.js', {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
  })

  // setup callbacks
  const sendMutex = new Mutex()
  const tickCallback = createTickCallback(pairs, pairMap, parseTick)
  const shutdownCallback = createShutdownCallback(
    tickws,
    orderws,
    graphWorker,
    createStopRequest(pairs.map(p => p.tradename)),
    sendMutex
  )
  const graphWorkerCallback = createGraphProfitCallback(
    initialAssetIndex,
    config.initialAmount,
    assets,
    pairs,
    pairMap,
    config.eta,
    orderws,
    token,
    sendMutex,
    createOrderRequest,
    shutdownCallback
  )

  // sleep until websockets are stable before proceeding
  while (tickws.readyState !== WebSocket.OPEN || orderws.readyState !== WebSocket.OPEN)
    await new Promise(resolve => setTimeout(resolve, 1000))

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  tickws.on('message', tickCallback)
  orderws.on('message', eventData => console.log(parseEvent(eventData.toLocaleString())))
  graphWorker.on('message', graphWorkerCallback)

  tickws.send(createTickSubRequest(pairs.map(p => p.tradename)))

  // return configured threads
  return [tickws, orderws, graphWorker]
}
