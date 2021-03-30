// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install()
import yargs = require('yargs/yargs')
import type { ExchangeName } from 'exchange-models/exchange'
import WebSocket = require('ws')
import { selector } from './select'
import {
  setupAssetsFromPairs,
  setupLookupMapFromPairs,
  setupMapFromPairs,
  updatePair,
  setupPairsWithAssetCodes,
} from './calc'

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
}).argv

let app = async (exchangeName: ExchangeName): Promise<[WebSocket, WebSocket]> => {
  let [tickDriver, orderDriver] = selector(exchangeName)
  let tickws = new WebSocket(tickDriver.getWebSocketUrl())
  let orderws = new WebSocket(orderDriver.getWebSocketUrl())
  let pairs = await tickDriver.getAvailablePairs()
  let assets = setupAssetsFromPairs(pairs)
  let indexedPairs = setupPairsWithAssetCodes(pairs, assets)
  let pairMap = new Map([...setupMapFromPairs(indexedPairs), ...setupLookupMapFromPairs(indexedPairs)])

  // setup ctrl+c handler for dev
  process.on('SIGINT', async () => {
    tickws.send(JSON.stringify(await tickDriver.createStopRequest()))
    tickws.close()
    orderws.close()
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

  // return configured sockets
  return [tickws, orderws]
}

app(argv.exchangeName as ExchangeName)
