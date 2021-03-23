import type { PairPriceUpdate } from 'exchange-models/exchange'
import { LoggerFactoryService } from 'socket-comms-libs'
import WebSocket from 'ws'
import { getExchangeInterface } from './kraken/tick'
import type { TickerConfiguration, TickerExchangeInterface } from './types'

export let tickService = async (
  conf: TickerConfiguration,
  tickerWS: WebSocket,
  tickCallback: (arg: PairPriceUpdate) => void
): Promise<WebSocket> => {
  // configure ticker behavior
  let logger = new LoggerFactoryService().getLogger('TickService')
  let sleep = (ms: number): Promise<unknown> => new Promise(resolve => setTimeout(resolve, ms))
  let isRunning = true
  let exi = ((): TickerExchangeInterface => {
    switch (conf.exchangeName) {
      case 'kraken':
        return getExchangeInterface()
      default:
        throw Error('Invalid exchange selected')
    }
  })()

  // register handlers
  tickerWS.on('message', async (eventData: string) => {
    if (!isRunning) return
    logger.debug(eventData)

    // attempt to parse the event
    let event: string | PairPriceUpdate
    try {
      event = exi.parseTick(eventData)
    } catch (e) {
      tickerWS.close()
      throw e
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
  tickerWS.send(
    JSON.stringify(
      exi.createTickSubRequest(
        (await exi.getAvailablePairs(conf.apiUrl, conf.threshold)).map(p => p.tradename)
      )
    )
  )
  logger.info('Subscription request sent')

  return tickerWS
}
