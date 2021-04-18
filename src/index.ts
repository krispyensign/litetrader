import sourceMap = require('source-map-support')
import yargs = require('yargs/yargs')
import { app } from './app'
import type { ExchangeName } from './types'

sourceMap.install()

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 200 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  apiKey: { type: 'string', default: '' },
  apiPrivateKey: { type: 'string', default: '' },
  buildGraph: { type: 'boolean', default: false },
}).argv

// do some error handling
if (argv.initialAsset === null) throw Error('Invalid asset provided')

// fire it up
app({
  exchangeName: argv.exchangeName as ExchangeName,
  initialAmount: argv.initialAmount,
  initialAsset: argv.initialAsset,
  eta: argv.eta,
  key: {
    apiKey: argv.apiKey,
    apiPrivateKey: argv.apiPrivateKey,
  },
  buildGraph: argv.buildGraph,
})

// wait till shutdown of sockets and readline
