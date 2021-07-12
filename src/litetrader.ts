console.time('startup')
import * as sourceMap from 'source-map-support'
sourceMap.install()
import { Worker, isMainThread } from 'worker_threads'
import yargs from 'yargs'
import { dirname } from 'path'
import { Mutex } from 'async-mutex'
import {
  closeExchangeWs,
  dropConnection,
  getAvailablePairs,
  getConnection,
  getExchangeApi,
  getExchangeWs,
  getToken,
  configureService,
  startSubscription,
  stopSubscription,
} from './services/configure.js'
import { createGraphProfitCallback, graphWorker } from './graphworker.js'
import { setupData } from './lib/datahelpers.js'
import { buildGraph } from './lib/graphlib.js'

const createShutdownCallback = (
  conn: unknown,
  worker: Worker,
  pairs: IndexedPair[],
  wsExchange: unknown
) =>
  async function (): Promise<void> {
    // kill detached worker thread
    await worker.terminate()

    // unsubsribe from everything
    stopSubscription(pairs, wsExchange)
    closeExchangeWs(wsExchange)

    // kill the connections
    dropConnection(conn)

    console.log('shutdown complete')
  }

async function app(config: Config): Promise<readonly [unknown, Worker]> {
  console.log('Starting.')
  configureService(config.exchangeName)

  const [assets, pairs, pairMap, initialAssetIndex] = await setupData(
      await getAvailablePairs(await getExchangeApi(config.exchangeName), config.key),
      config.initialAsset
    ),
    exchangeWs = await getExchangeWs(config.exchangeName),
    exchangeConn = getConnection(config.key),
    sendMutex = new Mutex()

  // start subscriptions and wait for initial flood of tick updates to stabilize
  await startSubscription(pairs, pairMap, exchangeWs, config.key)
  console.log('syncing.')
  await new Promise(res => setTimeout(res, 10000))

  // setup sockets and graph worker
  const graphWorkerTask = new Worker(dirname(process.argv[1]) + '/litetrader.js', {
    workerData: {
      exchangeName: config.exchangeName,
      graph: buildGraph(pairs),
      initialAssetIndex: initialAssetIndex,
    },
  })

  // setup process handler
  process.on('SIGINT', () =>
    sendMutex
      .acquire()
      .then(createShutdownCallback(exchangeConn, graphWorkerTask, pairs, exchangeWs))
      .then(() => process.exit(0))
  )

  // start processing with the graph thread
  graphWorkerTask.on(
    'message',
    createGraphProfitCallback(
      {
        assets: assets,
        eta: config.eta,
        initialAmount: config.initialAmount,
        initialAssetIndex: initialAssetIndex,
        pairMap: pairMap,
        pairs: pairs,
        token: await getToken(config.key, new Date().getTime() * 1000),
      },
      exchangeConn,
      sendMutex,
      config.key,
      createShutdownCallback(exchangeConn, graphWorkerTask, pairs, exchangeWs)
    )
  )

  // return configured threads
  console.timeEnd('startup')
  return [exchangeConn, graphWorkerTask]
}

// process the command line args
const argv = yargs(process.argv.slice(2))
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
