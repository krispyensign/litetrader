import { Config, Connections } from './types'
import { buildGraph, setupData } from './setup'
import { selector } from './helpers'
import {
  constructGraphCallback,
  constructShutdownCallback,
  constructTickCallback,
  sleep,
} from './callbacks'
import WebSocket = require('ws')
import { Worker } from 'worker_threads'

export default async function app(config: Config): Promise<Connections | undefined> {
  // configure everything
  const [tick, order] = selector(config.exchangeName),
    tradeDatum = await setupData(tick),
    // token = await order.getToken(config.key)
    token = '',
    // setup mutex
    isUnsubscribe = new Boolean(false),
    isSending = new Boolean(false),
    // setup closures for later portable
    tickCallback = constructTickCallback(tradeDatum, tick),
    initialAssetIndex = tradeDatum.assets.findIndex(a => a === config.initialAsset)

  // validate asset before continuing
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  const conns: Connections = {
      tickws: new WebSocket(tick.getWebSocketUrl()),
      orderws: new WebSocket(order.getWebSocketUrl()),
      worker: new Worker(__filename, {
        // create the graph worker
        workerData: {
          graph: buildGraph(tradeDatum.pairs),
          initialAssetIndex: tradeDatum.assets.findIndex(a => a === config.initialAsset),
        },
      }),
    },
    shutdownCallback = constructShutdownCallback(conns, tradeDatum, isUnsubscribe),
    graphCallback = constructGraphCallback(
      initialAssetIndex,
      config,
      tradeDatum,
      isSending,
      conns,
      order,
      token
    )

  // setup all thread and process handlers
  process.on('SIGINT', shutdownCallback)
  conns.tickws.on('message', tickCallback)
  conns.orderws.on('message', eventData =>
    console.log(order.parseEvent(eventData.toLocaleString()))
  )
  conns.worker.on('message', graphCallback)

  // sleep until tick websocket is stable then subscribe
  while (conns.tickws.readyState !== WebSocket.OPEN) await sleep(100)
  conns.tickws.send(JSON.stringify(tradeDatum.subRequest))

  // return configured threads
  return conns
}
