import sourceMap = require('source-map-support')
import readline = require('readline')
import yargs = require('yargs/yargs')
import WebSocket = require('ws')
import { selector } from './helpers'
import { updatePair, setupData, calcProfit } from './calc'
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
}).argv

const app = async (
  exchangeName: ExchangeName,
  initialAmount: number,
  initialAsset: string,
  eta: number
): Promise<[WebSocket, WebSocket, readline.Interface]> => {
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

  let isUnsubscribe = false

  // do some error handling
  if (argv.initialAsset === null) throw Error('Invalid asset provided')
  const initialAssetIndex = assets.findIndex(a => a === initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${initialAsset}`)

  // setup a shutdown handler
  const shutdown = async (): Promise<void> => {
    if (isUnsubscribe === true) return
    // unsubsribe from everything
    tickws.send(JSON.stringify(stopRequest))
    isUnsubscribe = true
    // wait for unsubsribe command to be sent
    await new Promise(resolve => setTimeout(resolve, 100))

    // kill the connections ( will also kill detached threads and thus the app )
    tickws.close()
    orderws.close()
    rl.close()
    console.log('done')
  }

  // setup all handlers
  process.on('SIGINT', shutdown)
  tickws.on('message', async eventData =>
    updatePair(pairs, tick.parseTick(eventData.toLocaleString()))
  )
  orderws.on('message', async eventData =>
    console.log(order.parseEvent(eventData.toLocaleString()))
  )
  rl.on('line', async line => {
    // if input gives done then quit
    if (line === 'done') await shutdown()

    // split a string 1,2,3,... into [1, 2, 3, ...]
    const cycle = line.split(',')

    // can only trade the approved asset
    if (Number(cycle[0]) !== initialAssetIndex) return

    // cannot hedge so skip anything less than 4
    if (cycle.length < 4) return

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
      const [, recipe] = result
      for (const step of recipe.steps) {
        orderws.send(order.createOrderRequest(token, step))
      }
    }
  })

  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN)
    await new Promise(resolve => setTimeout(resolve, 100))

  // subscribe to all the available pairs
  tickws.send(JSON.stringify(await tick.createTickSubRequest()))
  await new Promise(resolve => setTimeout(resolve, 1000))

  // return configured sockets and stdin reader
  return [tickws, orderws, rl]
}

// fire it up
app(argv.exchangeName as ExchangeName, argv.initialAmount, argv.initialAsset, argv.eta)

// wait till shutdown of sockets and readline
