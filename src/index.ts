import sourceMap = require('source-map-support')
import yargs = require('yargs/yargs')
import type {
  Config,
  Connections,
  ExchangeName,
  OrdersExchangeDriver,
  ThreadData,
  TickerExchangeDriver,
  TradeDatum,
} from './types'
import { buildGraph, setupData } from './setup'
import { selector } from './helpers'
import WebSocket = require('ws')
import { isMainThread, Worker, workerData, parentPort } from 'worker_threads'
import findCircuits = require('elementary-circuits-directed-graph')
import { updatePair, calcProfit, createEdgeList } from './calc'
import { createNbrsFromEdgeList, findCycles } from './unicycle/unicycle'
// import os = require('os')

sourceMap.install()

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

let setBool = (bool: Boolean, newVal: boolean): Boolean => {
  bool.valueOf = (): boolean => newVal
  return bool
}

let constructTickCallback = (tradeDatum: TradeDatum, tick: TickerExchangeDriver) => {
  return (x: WebSocket.MessageEvent): void => {
    return updatePair(tradeDatum.pairMap, tradeDatum.pairs, tick.parseTick(x.toLocaleString()))
  }
}

let constructShutdownCallback = (
  connections: Connections,
  tradeDatum: TradeDatum,
  isUnsubscribe: Boolean
) => {
  return (): void => {
    // only run once
    if (isUnsubscribe.valueOf()) return
    setBool(isUnsubscribe, true)

    // unsubsribe from everything
    connections.tickws.send(JSON.stringify(tradeDatum.unSubRequest))

    // kill the connections ( will also kill detached threads and thus the app )
    connections.tickws.close()
    connections.orderws.close()
    connections.worker.terminate()
    console.log('shutdown complete')
  }
}

let constructGraphCallback = (
  initialAssetIndex: number,
  config: Config,
  tradeDatum: TradeDatum,
  isSending: Boolean,
  conns: Connections,
  order: OrdersExchangeDriver,
  token: string
) => {
  return async (cycle: number[]): Promise<void> => {
    console.log('Graph callback called')
    // calc profit, hopefully something good is found
    let result = calcProfit(
      initialAssetIndex,
      config.initialAmount,
      cycle,
      tradeDatum.assets,
      tradeDatum.pairs,
      tradeDatum.pairMap,
      config.eta,
      '0'
    )

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      if (isSending) {
        console.log('blocked send while already sending')
        return
      }
      setBool(isSending, true)
      console.time('send')
      let [amount, recipe] = result
      console.log(`amounts: ${config.initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      for (let step of recipe.steps) {
        conns.orderws.send(order.createOrderRequest(token, step))
        await sleep(2)
      }
      console.timeEnd('send')
      setBool(isSending, false)
    }
  }
}

export let workerApp = async (data: string): Promise<void> => {
  console.log('Started worker')
  console.log(typeof data === 'string')
  console.log('go')
  let wdata: ThreadData = await JSON.parse(data)
  // console.log(wdata.graph)
  console.log('====')
  console.log(wdata.initialAssetIndex)
  console.log('parsed')
  await sleep(1000)

    // convert to a graph
    let edgeList = createEdgeList(data.pairs)
    console.log(`Have ${edgeList.length} edges`)
  
    // create the neighbors now from the edge list
    let nbrs = createNbrsFromEdgeList(edgeList)
    logger.info(`Have ${nbrs.size} cached nbrs`)
  
    // initialize count for diagnostics
    let count = 0
    for (let cycle of findCycles([String(wdata.initialAssetIndex)], nbrs)) {
      count++
      console.log(`cb: ${cycle}`)
      if (cycle[0] === wdata.initialAssetIndex) parentPort?.postMessage(cycle)
    }
}

export let app = async (config: Config): Promise<Connections | undefined> => {
  // configure everything
  let [tick, order] = selector(config.exchangeName)
  let tradeDatum = await setupData(tick)
  // token = await order.getToken(config.key)
  let token = ''
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
    worker: new Worker(__filename, {

      // create the graph worker
      workerData: JSON.stringify({
        graph: buildGraph(tradeDatum.pairs),
        initialAssetIndex: tradeDatum.assets.findIndex(a => a === config.initialAsset),
      }),
    }),
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
  conns.worker.on('message', graphCallback)

  // sleep until tick websocket is stable then subscribe
  while (conns.tickws.readyState !== WebSocket.OPEN) await sleep(100)
  conns.tickws.send(JSON.stringify(tradeDatum.subRequest))

  // return configured threads
  return conns
}

if (isMainThread) {
  let argv = yargs(process.argv.slice(2)).options({
    exchangeName: { type: 'string', default: 'kraken' },
    initialAmount: { type: 'number', default: 0 },
    initialAsset: { type: 'string', default: 'ADA' },
    eta: { type: 'number', default: 0.001 },
    apiKey: { type: 'string', default: '' },
    apiPrivateKey: { type: 'string', default: '' },
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
  })
} else {
  workerApp(workerData)
}

// wait till shutdown of sockets and readline
