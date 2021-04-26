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

export let worker = async (): Promise<void> => {
  // recover worker data before processing
  let graphData: Dictionary<number[]> = workerData.graph
  let initialAssetIndex: number = workerData.initialAssetIndex

  // map from object to map
  let graph = new Map<number, number[]>()
  for (let [key, nbrs] of Object.entries(graphData)) graph.set(Number(key), nbrs)

  // post each cycle
  for (let cycle of findCycles([initialAssetIndex], graph)) parentPort?.postMessage(cycle)
}

export let app = async (config: Config): Promise<[WebSocket, WebSocket, Worker]> => {
  // configure everything
  let [
    createStopRequest,
    createTickSubRequest,
    getAvailablePairs,
    getWebSocketUrl,
    parseTick,
  ] = tickSelector(config.exchangeName)
  let [, createOrderRequest, , getAuthWebSocketUrl, , parseEvent] = orderSelector(
    config.exchangeName
  )
  let exchangeData = await setupData(getAvailablePairs)
  let [assets, pairs, pairMap] = exchangeData 

  // token = await order.getToken(config.key)
  let token = ''

  // validate asset before continuing
  let initialAssetIndex = assets.findIndex(a => a === config.initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  // setup sockets and graph worker
  let dirName = dirname(process.argv[1])
  let tickws = new WebSocket(getWebSocketUrl())
  let orderws = new WebSocket(getAuthWebSocketUrl())
  let graphWorker = new Worker(dirName + '/index.js', {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
  })

  // setup callbacks
  let tickCallback = createTickCallback(pairs, pairMap, parseTick)
  let shutdownCallback = createShutdownCallback(
    tickws,
    orderws,
    graphWorker,
    createStopRequest(pairs.map(p => p.tradename))
  )
  let graphWorkerCallback = createGraphProfitCallback(
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
