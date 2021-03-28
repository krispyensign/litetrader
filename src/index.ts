// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install()
import yargs = require('yargs/yargs')
import * as tickService from './tick-service'
import type { ExchangeName, PairPriceUpdate } from 'exchange-models/exchange'
import WebSocket = require('ws')

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
}).argv

let dummyCallback = (update: string | PairPriceUpdate): void => {
  if ((update as PairPriceUpdate).tradeName !== undefined) console.log(update)
}

let tickDriver = tickService.selectExchangeDriver(argv.exchangeName as ExchangeName)
let ws = new WebSocket(tickDriver.getWebSocketUrl())

process.on('SIGINT', async () => {
  tickService.shutdownTickService(ws, tickDriver).then(() => {
    ws.close()
    console.log('done')
  })
})

tickService.tickService(tickDriver, ws, dummyCallback)
