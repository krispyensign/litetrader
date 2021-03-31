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
  let [tickDriver, orderDriver] = selector(exchangeName)
  let tickws = new WebSocket(tickDriver.getWebSocketUrl())
  let orderws = new WebSocket(orderDriver.getWebSocketUrl())
  let [assets, indexedPairs, pairMap] = await setupData(tickDriver)
  if (argv.initialAsset === null) throw Error('Invalid asset provided')
  let initialAssetIndex = assets.findIndex(a => a === initialAsset)
  if (initialAssetIndex === -1) throw Error(`invalid asset ${initialAsset}`)
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  // setup ctrl+c handler for dev
  process.on('SIGINT', async () => {
    tickws.send(JSON.stringify(await tickDriver.createStopRequest()))
    tickws.close()
    orderws.close()
    rl.close()
    console.log('done')
  })

  // setup callback handlers
  tickws.on('message', async (eventData: string) =>
    updatePair(pairMap, indexedPairs, tickDriver.parseTick(eventData))
  )
  orderws.on('message', async (eventData: string) => console.log(orderDriver.parseEvent(eventData)))

  // sleep until tick websocket is stable then subscribe
  while (tickws.readyState !== WebSocket.OPEN)
    await new Promise(resolve => setTimeout(resolve, 100))
  tickws.send(JSON.stringify(await tickDriver.createTickSubRequest()))

  // calc profit on new line from stdin
  // setup the reader to process the cycles from external script 1,2,3,4 etc..
  rl.on('line', line => {
    if (line === 'done')
      process.exit(0)
    let cycle = line.split(',')
    if (cycle.length < 4) return
    let result = calcProfit(initialAssetIndex, initialAmount, cycle, assets, indexedPairs, pairMap, eta, '0')
    if (typeof result !== 'number') {
      console.log(result)
      process.exit(0)
    }
  })

  // return configured sockets and stdin reader
  return [tickws, orderws, rl]
}

app(argv.exchangeName as ExchangeName, argv.initialAmount, argv.initialAsset, argv.eta)
