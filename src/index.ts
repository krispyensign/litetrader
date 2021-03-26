// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install()
import * as conf from './config.json'
import yargs = require('yargs/yargs')
import { tickService } from './tick-service'
import type { PairPriceUpdate } from 'exchange-models/exchange'
import WebSocket = require('ws')
import type { TickerConfiguration } from './types'

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: conf.exchange },
  threshold: { type: 'number', default: conf.threshold },
  wsUrl: { type: 'string', default: conf.wsUrl },
  apiUrl: { type: 'string', default: conf.apiUrl },
}).argv

let dummyCallback = (update: PairPriceUpdate): void => {
  console.log('callback')
  console.log(update)
}

let ws = new WebSocket(argv.wsUrl)
tickService(argv as TickerConfiguration, ws, dummyCallback)
