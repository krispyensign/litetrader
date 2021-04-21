import type { Config, Dictionary } from './types'
import { buildGraph, setupData } from './setup'
import { orderSelector, tickSelector } from './helpers'
import ws = require('ws')
import { newTickCallback, newShutdownCallback, newGraphProfitCallback } from './callbacks'
import { Worker, parentPort, workerData } from 'worker_threads'
import { findCycles } from './unicycle/unicycle'

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export let worker = async (): Promise<void> => {
  // recover worker data before processing
  let graphData: Dictionary<number[]> = workerData.graph
  let initialAssetIndex: number = workerData.initialAssetIndex

  // map from object to map
  let graph = new Map<number, number[]>()
  for (let [key, nbrs] of Object.entries(graphData)) {
    graph.set(Number(key), nbrs)
  }

  // post each cycle
  for (let cycle of findCycles([initialAssetIndex], graph)) {
    console.log(cycle)
    parentPort?.postMessage(cycle)
  }
}

export let app = async (config: Config): Promise<[ws, ws, Worker] | undefined> => {
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
  let tickws = new ws(tick.getWebSocketUrl())
  let orderws = new ws(order.getWebSocketUrl())
  let graphWorker = new Worker(__dirname + '/index.js', {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
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
  while (tickws.readyState !== ws.OPEN || orderws.readyState !== ws.OPEN) await sleep(1000)

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  tickws.on('message', tickCallback)
  orderws.on('message', eventData => console.log(order.parseEvent(eventData.toLocaleString())))
  graphWorker.on('message', graphWorkerCallback)

  tickws.send(tick.createTickSubRequest(pairs.map(p => p.tradename)))

  // return configured threads
  return [tickws, orderws, graphWorker]
}
