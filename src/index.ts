import sourceMap = require('source-map-support')
import yargs = require('yargs/yargs')
import type {
  Config,
  Connections,
  ExchangeName
} from './types'
import { buildGraph, constructGraphCallback, constructShutdownCallback, constructTickCallback, setupData } from './setup'
import { selector } from './helpers'
import WebSocket = require('ws')
import readline = require('readline')
// import os = require('os')

sourceMap.install()

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export let app = async (config: Config): Promise<Connections | undefined> => {
  // configure everything
  let [tick, order] = selector(config.exchangeName)
  let tradeDatum = await setupData(tick)
  // token = await order.getToken(config.key)
  let token = ''
  
  if (config.buildGraph) {
    console.log(buildGraph(tradeDatum.pairs))
    return
  }
  
  // setup mutex
  let isUnsubscribe = new Boolean(false)
  let isSending = new Boolean(false)
  
  // setup closures for later portable
  let tickCallback = constructTickCallback(tradeDatum, tick)
  let initialAssetIndex = tradeDatum.assets.findIndex(a => a === config.initialAsset)

  // validate asset before continuing
  if (initialAssetIndex === -1) throw Error(`invalid asset ${config.initialAsset}`)

  let conns: Connections = {
    tickws: new WebSocket(tick.getWebSocketUrl()),
    orderws: new WebSocket(order.getWebSocketUrl()),
    worker: readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
  }

  let shutdownCallback = constructShutdownCallback(conns, tradeDatum, isUnsubscribe)
  let graphCallback = constructGraphCallback(
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
  conns.worker.on('line', graphCallback)

  // sleep until tick websocket is stable then subscribe
  while (conns.tickws.readyState !== WebSocket.OPEN) await sleep(100)
  conns.tickws.send(JSON.stringify(tradeDatum.subRequest))

  // return configured threads
  return conns
}

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 0 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  apiKey: { type: 'string', default: '' },
  apiPrivateKey: { type: 'string', default: '' },
  buildGraph: { type: 'boolean', default: false}
}).argv

// do some error handling
if (argv.initialAsset === null) throw Error('Invalid asset provided')

// fire it up
app({
  exchangeName: argv.exchangeName as ExchangeName,
  initialAmount: argv.initialAmount,
  initialAsset: argv.initialAsset,
  eta: argv.eta,
  key: {
    apiKey: argv.apiKey,
    apiPrivateKey: argv.apiPrivateKey,
  },
  buildGraph: argv.buildGraph
})

// wait till shutdown of sockets and readline
