// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install()
import readline = require('readline')
import yargs = require('yargs/yargs')
import type { ExchangeName } from 'exchange-models/exchange'
import WebSocket = require('ws')
import { selector } from './select'
import { updatePair, setupData } from './calc'

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
  let [tickDriver, orderDriver] = selector(exchangeName)
  let tickws = new WebSocket(tickDriver.getWebSocketUrl())
  let orderws = new WebSocket(orderDriver.getWebSocketUrl())
  let [assets, indexedPairs, pairMap] = await setupData(tickDriver)
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

  // setup the reader to process the cycles from external script 1,2,3,4 etc..
  if (initialAsset === null) throw Error('Invalid asset provided')
  rl.on('line', line => console.log(line))

  // return configured sockets and stdin reader
  return [tickws, orderws, rl]
}

app(argv.exchangeName as ExchangeName, argv.initialAmount, argv.initialAsset, argv.eta)
