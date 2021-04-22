import yargs from 'yargs'
import { install } from 'source-map-support'
import { app, worker } from './app.js'
import type { ExchangeName } from './types/types'
import { isMainThread } from 'worker_threads'

install()

let argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 200 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  apiKey: { type: 'string', default: '' },
  apiPrivateKey: { type: 'string', default: '' },
}).argv

// do some error handling
if (argv.initialAsset === null) {
  let t = (): void => {
    throw Error('Invalid asset provided')
  }
  t()
}

// fire it up
if (isMainThread) {
  app({
    exchangeName: argv.exchangeName as ExchangeName,
    initialAmount: argv.initialAmount,
    initialAsset: argv.initialAsset,
    eta: argv.eta,
    key: {
      apiKey: argv.apiKey,
      apiPrivateKey: argv.apiPrivateKey,
    },
  })
} else {
  worker()
}

// wait till shutdown of sockets and readline
