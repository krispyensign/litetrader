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

export const worker = async (): Promise<void> => {
  // recover worker data before processing
  const graphData: Dictionary<number[]> = workerData.graph
  const initialAssetIndex: number = workerData.initialAssetIndex

  // map from object to map
  const graph = new Map<number, number[]>()
  for (const [key, nbrs] of Object.entries(graphData)) graph.set(Number(key), nbrs)

  // post each cycle
  for (const cycle of findCycles([initialAssetIndex], graph)) parentPort?.postMessage(cycle)
}

export const app = async (config: Config): Promise<[WebSocket, WebSocket, Worker]> => {
  // configure everything
  const [
    createStopRequest,
    createTickSubRequest,
    getAvailablePairs,
    getWebSocketUrl,
    parseTick,
  ] = tickSelector(config.exchangeName)
  const [, createOrderRequest, , getAuthWebSocketUrl, , parseEvent] = orderSelector(
    config.exchangeName
  )
  const exchangeData = await setupData(getAvailablePairs)
  const [assets, pairs, pairMap] = exchangeData

  // token = await order.getToken(config.key)
  const token = ''

  // validate asset before continuing
  const initialAssetIndex = assets.findIndex(a => a === config.initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  // setup sockets and graph worker
  const dirName = dirname(process.argv[1])
  const tickws = new WebSocket(getWebSocketUrl())
  const orderws = new WebSocket(getAuthWebSocketUrl())
  const graphWorker = new Worker(dirName + '/index.js', {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
  })

  // setup callbacks
  const tickCallback = createTickCallback(pairs, pairMap, parseTick)
  const shutdownCallback = createShutdownCallback(
    tickws,
    orderws,
    graphWorker,
    createStopRequest(pairs.map(p => p.tradename))
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
