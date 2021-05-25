console.time('startup')
import { isMainThread } from 'worker_threads'

import yargs from 'yargs'
import * as sourceMap from 'source-map-support'
import { app } from './app.js'
import { worker } from './graphworker.js'

// install the sourcemap for better troubleshooting
sourceMap.install()

// process the command line args
const argv = yargs(process.argv.slice(2)).options({
  exchangeName: { type: 'string', default: 'kraken' },
  initialAmount: { type: 'number', default: 200 },
  initialAsset: { type: 'string', default: 'ADA' },
  eta: { type: 'number', default: 0.001 },
  apiKey: { type: 'string', default: '' },
  apiPrivateKey: { type: 'string', default: '' },
}).argv

// do some error handling
argv.initialAsset === null
  ? console.log('Invalid asset provided')
  : // fire it up
  isMainThread
  ? app({
      exchangeName: argv.exchangeName as ExchangeName,
      initialAmount: argv.initialAmount,
      initialAsset: argv.initialAsset,
      eta: argv.eta,
      key: {
        apiKey: argv.apiKey,
        apiPrivateKey: argv.apiPrivateKey,
      },
    }).then(() => console.timeEnd('startup'))
  : worker()

// wait till shutdown of sockets and readline
