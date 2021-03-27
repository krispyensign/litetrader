// eslint-disable-next-line @typescript-eslint/no-var-requires
require('source-map-support').install()
import * as defaults from './defaults.json'
import yargs = require('yargs/yargs')
import { tickService } from './tick-service'
import type { PairPriceUpdate } from 'exchange-models/exchange'
import WebSocket = require('ws')
import type { TickerConfiguration } from './types'

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: defaults.exchange },
  threshold: { type: 'number', default: defaults.threshold },
  wsUrl: { type: 'string', default: defaults.wsUrl },
  apiUrl: { type: 'string', default: defaults.apiUrl },
}).argv

let dummyCallback = (update: string | PairPriceUpdate): void => {
  console.log(update)
}

let ws = new WebSocket(argv.wsUrl)
tickService(argv as TickerConfiguration, ws, dummyCallback)
