// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install()
import readline = require('readline')
import yargs = require('yargs/yargs')
import type { ExchangeName } from 'exchange-models/exchange'
import WebSocket = require('ws')
import { selector } from './select'
import { updatePair, setupData, calcProfit } from './calc'

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 0 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
}).argv

let app = async (
  exchangeName: ExchangeName,
  initialAmount: number,
  initialAsset: string,
  eta: number
): Promise<[WebSocket, WebSocket, readline.Interface]> => {
  // configure everything
  let [tick, order] = selector(exchangeName)
  let tickws = new WebSocket(tick.getWebSocketUrl())
  let orderws = new WebSocket(order.getWebSocketUrl())
  let [assets, pairs, pairMap] = await setupData(tick)
  if (argv.initialAsset === null) throw Error('Invalid asset provided')
  let initialAssetIndex = assets.findIndex(a => a === initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${initialAsset}`)
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  let shutdown = async (): Promise<void> => {
    tickws.send(JSON.stringify(await tick.createStopRequest()))
    await new Promise(resolve => setTimeout(resolve, 100))
    tickws.close()
    orderws.close()
    rl.close()
  }

  // setup ctrl+c handler for dev
  process.on('SIGINT', async () => await shutdown())
  tickws.on('message', async (eventData: string) => updatePair(pairs, tick.parseTick(eventData)))
  orderws.on('message', async (eventData: string) => console.log(order.parseEvent(eventData)))
  rl.on('line', async line => {
    if (line === 'done') await shutdown()
    let cycle = line.split(',')
    if (cycle.length < 4) return
    let result = calcProfit(
      initialAssetIndex,
      initialAmount,
      cycle,
      assets,
      pairs,
      pairMap,
      eta,
      '0'
    )
    if (typeof result !== 'number') {
      console.log(result)
      await shutdown()
    }
  })
  
  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN)
    await new Promise(resolve => setTimeout(resolve, 100))
  tickws.send(JSON.stringify(await tick.createTickSubRequest()))

  // return configured sockets and stdin reader
  return [tickws, orderws, rl]
}

app(argv.exchangeName as ExchangeName, argv.initialAmount, argv.initialAsset, argv.eta)
