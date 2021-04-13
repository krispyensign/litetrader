import sourceMap = require('source-map-support')
import yargs = require('yargs/yargs')
import WebSocket = require('ws')
import { selector } from './helpers'
import { Worker, isMainThread } from 'worker_threads'
// import os = require('os')
import { updatePair, calcProfit } from './calc'
import type { ExchangeName, Key } from './types'
import { buildGraph, setupData } from './setup'

// TODO: observe order response
// TODO: add new worker thread to find cycles
// TODO: assign valid orderId

sourceMap.install()

const argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 0 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  apiKey: { type: 'string', default: '' },
  apiPrivateKey: { type: 'string', default: '' },
}).argv

async function sleep(timems: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timems))
}

async function shutdown(
  tickws: WebSocket,
  orderws: WebSocket,
  stopRequest: unknown
): Promise<void> {
  // unsubsribe from everything
  tickws.send(JSON.stringify(stopRequest))
  // wait for unsubsribe command to be sent
  await sleep(100)

  // kill the connections ( will also kill detached threads and thus the app )
  tickws.close()
  orderws.close()
  console.log('shutdown complete')
}

async function mainApp(
  exchangeName: ExchangeName,
  initialAmount: number,
  initialAsset: string,
  eta: number,
  key: Key
): Promise<[WebSocket, WebSocket, Worker] | undefined> {
  // configure everything
  const [tick, order] = selector(exchangeName),
    tickws = new WebSocket(tick.getWebSocketUrl()),
    orderws = new WebSocket(order.getWebSocketUrl()),
    [assets, pairs, pairMap, stopRequest, subRequest] = await setupData(tick),
    token = await order.getToken(key)

  // do some error handling
  if (argv.initialAsset === null) throw Error('Invalid asset provided')
  const initialAssetIndex = assets.findIndex(a => a === initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${initialAsset}`)

  // create the graph worker
  const worker = new Worker(__filename, {
    workerData: {
      graph: buildGraph(pairs),
      initialAssetIndex: assets.findIndex(a => a === initialAsset),
    },
  })

  // setup some small poorman mutex
  let isUnsubscribe = false,
    isSending = false

  // setup all thread and process handlers
  process.on('SIGINT', async () => {
    if (isUnsubscribe) return
    await shutdown(tickws, orderws, stopRequest)
    isUnsubscribe = true
  })
  tickws.on('message', eventData => updatePair(pairs, tick.parseTick(eventData.toLocaleString())))
  orderws.on('message', eventData => console.log(order.parseEvent(eventData.toLocaleString())))
  worker.on('message', async cycle => {
    // calc profit, hopefully something good is found
    const result = calcProfit(
      initialAssetIndex,
      initialAmount,
      cycle,
      assets,
      pairs,
      pairMap,
      eta,
      '0'
    )

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      if (isSending) {
        console.log('blocked send while already sending')
        return
      }
      isSending = true
      console.time('send')
      const [amount, recipe] = result
      console.log(`amounts: ${initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      for (const step of recipe.steps) {
        orderws.send(order.createOrderRequest(token, step))
        await sleep(2)
      }
      console.timeEnd('send')
      isSending = false
    }
  })

  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN) await sleep(100)

  // subscribe to all the available pairs
  tickws.send(JSON.stringify(subRequest))
  await sleep(1000)

  // return configured threads
  return [tickws, orderws, worker]
}

// fire it up
if (isMainThread)
  mainApp(argv.exchangeName as ExchangeName, argv.initialAmount, argv.initialAsset, argv.eta, {
    apiKey: argv.apiKey,
    apiPrivateKey: argv.apiPrivateKey,
  })

// wait till shutdown of sockets and readline
