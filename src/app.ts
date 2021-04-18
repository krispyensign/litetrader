
import sourceMap = require('source-map-support')
import type {
  Config,
} from './types'
import { buildGraph, setupData } from './setup'
import { selector } from './helpers'
import WebSocket = require('ws')
import readline = require('readline')
import { newTickCallback, newShutdownCallback, newGraphProfitCallback } from './callbacks'
// import os = require('os')

sourceMap.install()

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export let app = async (config: Config): Promise<[WebSocket, WebSocket, readline.Interface] | undefined> => {
  // configure everything
  let [tick, order] = selector(config.exchangeName)
  let [assets, pairs, pairMap, unSubRequest, subRequest] = await setupData(tick)
  // token = await order.getToken(config.key)
  let token = ''
  
  // setup mutex
  let isUnsubscribe = new Boolean(false)
  let isSending = new Boolean(false)
  
  let initialAssetIndex = assets.findIndex(a => a === config.initialAsset)

  // validate asset before continuing
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  // build the graph from the data and quit if this option was selected
  if (config.buildGraph) {
    console.log(JSON.stringify({
      graph: buildGraph(pairs),
      initialIndex: initialAssetIndex
    }))
    return
  }

  let // setup sockets and graph worker
    tickws = new WebSocket(tick.getWebSocketUrl()),
    orderws = new WebSocket(order.getWebSocketUrl()),
    graphWorker = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

  // setup closures for later portable
  let tickCallback = newTickCallback(pairs, pairMap, tick.parseTick)
  let shutdownCallback = newShutdownCallback(isUnsubscribe, tickws, orderws, graphWorker, unSubRequest)
  let graphWorkerCallback = newGraphProfitCallback(
    initialAssetIndex,
    config.initialAmount,
    assets,
    pairs,
    pairMap,
    config.eta,
    isSending,
    orderws,
    token,
    order.createOrderRequest
  )

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  tickws.on('message', tickCallback)
  orderws.on('message', eventData =>
    console.log(order.parseEvent(eventData.toLocaleString()))
  )
  graphWorker.on('line', graphWorkerCallback)

  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN) await sleep(100)
  tickws.send(subRequest)

  // return configured threads
  return [tickws, orderws, graphWorker]
}