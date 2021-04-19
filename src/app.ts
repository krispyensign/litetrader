import sourceMap = require('source-map-support')
import type { Config } from './types'
import { buildGraph, setupData } from './setup'
import { orderSelector, tickSelector } from './helpers'
import WebSocket = require('ws')
import readline = require('readline')
import { newTickCallback, newShutdownCallback, newGraphProfitCallback } from './callbacks'
import fs = require('fs')
// import os = require('os')

sourceMap.install()

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export let app = async (
  config: Config
): Promise<[WebSocket, WebSocket, readline.Interface] | undefined> => {
  // configure everything
  let tick = tickSelector(config.exchangeName)
  let order = orderSelector(config.exchangeName)
  let [assets, pairs, pairMap] = await setupData(config.exchangeName)

  // token = await order.getToken(config.key)
  let token = ''

  // setup mutex
  let isUnsubscribe = new Boolean(false)
  let isSending = new Boolean(false)

  // validate asset before continuing
  let initialAssetIndex = assets.findIndex(a => a === config.initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  // build the graph from the data and quit if this option was selected
  if (config.buildGraph !== '') {
    fs.writeFile(
      config.buildGraph,
      JSON.stringify({
        graph: buildGraph(pairs),
        initialIndex: initialAssetIndex,
      }),
      (err): void => {
        if (err) throw err
        console.log("It's saved!")
      }
    )
    return
  }

  // setup sockets and graph worker
  let tickws = new WebSocket(tick.getWebSocketUrl())
  let orderws = new WebSocket(order.getWebSocketUrl())
  let graphWorker = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  // setup closures for later portable
  let tickCallback = newTickCallback(pairs, pairMap, tick.parseTick)
  let shutdownCallback = newShutdownCallback(
    isUnsubscribe,
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
    isSending,
    orderws,
    token,
    order.createOrderRequest,
    shutdownCallback
  )

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  tickws.on('message', tickCallback)
  orderws.on('message', eventData => console.log(order.parseEvent(eventData.toLocaleString())))
  graphWorker.on('line', graphWorkerCallback)

  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN) await sleep(100)
  tickws.send(tick.createTickSubRequest(pairs.map(p => p.tradename)))

  // return configured threads
  return [tickws, orderws, graphWorker]
}
