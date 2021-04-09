import sourceMap = require('source-map-support')
import readline = require('readline')
import yargs = require('yargs/yargs')
import WebSocket = require('ws')
import { selector } from './helpers'
import { updatePair, setupData, buildGraph, findProfit, sleep } from './calc'
import type { ExchangeName } from './types'

// TODO: get token
// TODO: observe order response
// TODO: assign valid orderId

sourceMap.install()

const token = ''

const argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 0 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  buildGraph: { type: 'boolean', default: false },
}).argv

async function shutdown(
  isUnsubscribe: Boolean,
  tickws: WebSocket,
  orderws: WebSocket,
  rl: readline.Interface,
  stopRequest: unknown
): Promise<void> {
  if (isUnsubscribe === true) return
  // unsubsribe from everything
  tickws.send(JSON.stringify(stopRequest))
  isUnsubscribe = true
  // wait for unsubsribe command to be sent
  await sleep(100)

  // kill the connections ( will also kill detached threads and thus the app )
  tickws.close()
  orderws.close()
  rl.close()
  console.log('shutdown complete')
}

async function app(
  exchangeName: ExchangeName,
  initialAmount: number,
  initialAsset: string,
  eta: number,
  buildGraphOnly: boolean
): Promise<[WebSocket, WebSocket, readline.Interface] | undefined> {
  // configure everything

  const [tick, order] = selector(exchangeName),
    tickws = new WebSocket(tick.getWebSocketUrl()),
    orderws = new WebSocket(order.getWebSocketUrl()),
    [assets, pairs, pairMap] = await setupData(tick),
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    }),
    stopRequest = await tick.createStopRequest()

  const isUnsubscribe: Boolean = false

  if (buildGraphOnly) {
    console.log(JSON.stringify(buildGraph(pairs)))
    return undefined
  }

  // do some error handling
  if (argv.initialAsset === null) throw Error('Invalid asset provided')
  const initialAssetIndex = assets.findIndex(a => a === initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${initialAsset}`)

  // setup all handlers
  process.on('SIGINT', async () => await shutdown(isUnsubscribe, tickws, orderws, rl, stopRequest))
  tickws.on('message', async eventData =>
    updatePair(pairs, tick.parseTick(eventData.toLocaleString()))
  )
  orderws.on('message', async eventData =>
    console.log(order.parseEvent(eventData.toLocaleString()))
  )
  rl.on('line', async line => {
    // if input gives done then quit
    if (line === 'done') await shutdown(isUnsubscribe, tickws, orderws, rl, stopRequest)
    await findProfit(
      line,
      initialAssetIndex,
      initialAmount,
      assets,
      pairs,
      pairMap,
      eta,
      orderws,
      token,
      order
    )
  })

  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN) await sleep(100)

  // subscribe to all the available pairs
  tickws.send(JSON.stringify(await tick.createTickSubRequest()))
  await sleep(1000)

  // return configured sockets and stdin reader
  return [tickws, orderws, rl]
}

// fire it up
app(
  argv.exchangeName as ExchangeName,
  argv.initialAmount,
  argv.initialAsset,
  argv.eta,
  argv.buildGraph
)

// wait till shutdown of sockets and readline
