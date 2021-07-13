console.time('startup')
import * as sourceMap from 'source-map-support'
sourceMap.install()
import { isMainThread } from 'worker_threads'
import yargs from 'yargs'
import { graphWorker } from './graphworker.js'
import { app } from './litetrader.js'

// process the command line args
let argv = yargs(process.argv.slice(2))
  .options({
    exchangeName: { type: 'string', default: 'kraken' },
    initialAmount: { type: 'number', default: 200 },
    initialAsset: { type: 'string', default: 'ADA' },
    eta: { type: 'number', default: 0.001 },
    apiKey: { type: 'string', default: '' },
    apiPrivateKey: { type: 'string', default: '' },
    passphrase: { type: 'string', default: '' },
    accountId: { type: 'string', default: '' },
  })
  .parseSync()

// startup the app if main thread else start the graph worker
argv.initialAsset === null
  ? console.log('Invalid asset provided')
  : isMainThread
  ? app({
      exchangeName: argv.exchangeName as ExchangeName,
      initialAmount: argv.initialAmount,
      initialAsset: argv.initialAsset,
      eta: argv.eta,
      key: {
        apiKey: argv.apiKey,
        apiPrivateKey: argv.apiPrivateKey,
        passphrase: argv.passphrase,
        accountId: argv.accountId,
      },
    })
  : graphWorker()

// wait for shutdown
