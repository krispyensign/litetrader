import type { PairPriceUpdate } from 'exchange-models/exchange'
import { LoggerFactoryService } from 'socket-comms-libs'
import WebSocket from 'ws'
import * as kraken from 'kraken-helpers'
import type { TickerConfiguration, TickerExchangeInterface } from './types'

export let tickService = async (
  conf: TickerConfiguration,
  tickerWS: WebSocket,
  tickCallback: (arg: PairPriceUpdate) => void
): Promise<WebSocket> => {
  // configure ticker behavior
  const logger = new LoggerFactoryService().getLogger('TickService')
  const sleep = (ms: number): Promise<unknown> => new Promise(resolve => setTimeout(resolve, ms))
  let isRunning = true

  let exi: TickerExchangeInterface
  switch (conf.exchangeName) {
    case 'kraken':
      exi = {
        createTickSubRequest: kraken.createTickSubRequest,
        isError: kraken.isError,
        parseEvent: kraken.parseEvent,
        getAvailablePairs: kraken.getAvailablePairs,
        createStopRequest: kraken.createStopRequest,
      }
      break
    default:
      throw Error('Invalid exchange selected')
  }

  // attempt to get available pairs
  const pairsResponse = await exi.getAvailablePairs(conf.apiUrl, conf.threshold)
  if (pairsResponse instanceof Error) throw pairsResponse
  const pairs = pairsResponse.map(p => p.tradename)

  // register handlers
  tickerWS.on('message', async (eventData: string) => {
    if (!isRunning) return
    logger.debug(eventData)
    // attempt to parse the event
    const event = exi.parseEvent(eventData)

    // log then eat any errors
    if (exi.isError(event)) {
      tickerWS.close()
      throw Error(eventData)
    }

    if (typeof event !== 'string') tickCallback(event)
  })

  process.once('SIGINT', async () => {
    // unsubscribe from ticker
    logger.info('Got shutdown request')
    isRunning = false
    tickerWS.send(JSON.stringify(exi.createStopRequest()))
    await sleep(10)
    tickerWS.close()
    logger.info('Shutdown complete')
  })

  // sleep while waiting for client socket state
  while (tickerWS.readyState === 0) await sleep(100)
  logger.info('Socket ready state: ' + tickerWS.readyState)

  // subscribe
  tickerWS.send(JSON.stringify(exi.createTickSubRequest(pairs)))
  logger.info('Subscription request sent')

  return tickerWS
}
