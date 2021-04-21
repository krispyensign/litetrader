import sourceMap = require('source-map-support')
import type { Config, Dictionary } from './types'
import { buildGraph, setupData } from './setup'
import { orderSelector, tickSelector } from './helpers'
import WebSocket = require('ws')
import { newTickCallback, newShutdownCallback, newGraphProfitCallback } from './callbacks'
import { Worker, parentPort, workerData } from 'worker_threads'
import { findCycles } from './unicycle/unicycle'

sourceMap.install()

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export let worker = async () => {
  let graph: Dictionary<number[]> = workerData.graph
  let initialAssetIndex: number = workerData.initialAssetIndex
  for (let cycle of findCycles([initialAssetIndex], graph)) {
    
  }
}

export let app = async (
  config: Config
): Promise<[WebSocket, WebSocket, Worker] | undefined> => {
  // configure everything
  let tick = tickSelector(config.exchangeName)
  let order = orderSelector(config.exchangeName)
  let [assets, pairs, pairMap] = await setupData(config.exchangeName)

  // token = await order.getToken(config.key)
  let token = ''

  // validate asset before continuing
  let initialAssetIndex = assets.findIndex(a => a === config.initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  // setup sockets and graph worker
  let tickws = new WebSocket(tick.getWebSocketUrl())
  let orderws = new WebSocket(order.getWebSocketUrl())
  let graphWorker = new Worker(__dirname + "/index.js", {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex
    }
  }) 

  // setup callbacks
  let tickCallback = newTickCallback(pairs, pairMap, tick.parseTick)
  let shutdownCallback = newShutdownCallback(
    tickws,
    orderws,
    graphWorker,
    tick.createStopRequest(pairs.map(p => p.tradename))
  )
  let graphWorkerCallback = newGraphProfitCallback(
    initialAssetIndex,
    config.initialAmount,
    assets,
    pairs,
    pairMap,
    config.eta,
    orderws,
    token,
    order.createOrderRequest,
    shutdownCallback
  )

  // sleep until websockets are stable before proceeding
  while (tickws.readyState !== WebSocket.OPEN || orderws.readyState !== WebSocket.OPEN)
    await sleep(1000)

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  tickws.on('message', tickCallback)
  orderws.on('message', eventData => console.log(order.parseEvent(eventData.toLocaleString())))
  graphWorker.on('message', graphWorkerCallback)

  tickws.send(tick.createTickSubRequest(pairs.map(p => p.tradename)))

  // return configured threads
  return [tickws, orderws, graphWorker]
}
