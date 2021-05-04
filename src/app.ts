import WebSocket from 'ws'
import { dirname } from 'path'
import { Worker, parentPort, workerData } from 'worker_threads'
import {
  createTickCallback,
  createShutdownCallback,
  createGraphProfitCallback,
} from './callbacks.js'
import { isError, orderSelector, tickSelector } from './helpers.js'
import { buildGraph, setupData } from './setup.js'
import type { Config, Dictionary } from './types/types'
import { findCycles } from './unicycle/unicycle.js'

export const worker = async (): Promise<void> => {
  // post each cycle
  for (const cycle of findCycles(
    [workerData.initialAssetIndex as number],
    Object.entries(workerData.graph as Dictionary<number[]>).reduce(
      (prev, [key, nbrs]) => prev.set(Number(key), nbrs),
      new Map<number, number[]>()
    )
  ))
    parentPort?.postMessage(cycle)
}

export const app = async (config: Config): Promise<[WebSocket, WebSocket, Worker]> => {
  // configure everything
  const tick = tickSelector(config.exchangeName)
  if (isError(tick)) throw tick
  const [
    createStopRequest,
    createTickSubRequest,
    getAvailablePairs,
    getWebSocketUrl,
    parseTick,
  ] = tick
  const order = orderSelector(config.exchangeName)
  if (isError(order)) throw order
  const [, createOrderRequest, , getAuthWebSocketUrl, , parseEvent] = order
  const exchangeData = await setupData(getAvailablePairs)
  if (isError(exchangeData)) throw exchangeData
  const [assets, pairs, pairMap] = exchangeData

  // token = await order.getToken(config.key)
  const token = ''

  // validate asset before continuing
  const initialAssetIndex = assets.findIndex(a => a === config.initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  // setup sockets and graph worker
  const tickws = new WebSocket(getWebSocketUrl())
  const orderws = new WebSocket(getAuthWebSocketUrl())
  const graphWorker = new Worker(dirname(process.argv[1]) + '/index.js', {
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
