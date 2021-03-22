import { ExchangeName, ExchangePair, PairPriceUpdate } from 'exchange-models/exchange'
import { Subscribe } from 'exchange-models/kraken'
import { LoggerFactoryService } from 'socket-comms-libs'
import WebSocket from 'ws'
import * as kraken from 'kraken-helpers'
import * as c from './common'

interface TickerExchangeInterface {
  createTickSubRequest: { (instruments: string[]): Subscribe }
  isError: { (event: unknown): event is Error }
  parseEvent: { (eventData: string): string | Error | PairPriceUpdate }
  createStopRequest: { (): object }
  getAvailablePairs: {
    (exchangeApiUrl: string, threshold: number): Promise<Error | ExchangePair[]>
  }
}

let selectTickerExchange = (exchangeName: ExchangeName): TickerExchangeInterface => {
  if (exchangeName === 'kraken') {
    return {
      createTickSubRequest: kraken.createTickSubRequest,
      isError: kraken.isError,
      parseEvent: kraken.parseEvent,
      getAvailablePairs: kraken.getAvailablePairs,
      createStopRequest: kraken.createStopRequest,
    }
  }
  console.log("Invalid exchange selected")
  process.exit(1)
}

export let tickService = async (
  conf: c.Configuration,
  tickerWS: WebSocket,
  tickCallback: ((arg: PairPriceUpdate) => void)
): Promise<Error | undefined> => {
  // configure ticker behavior
  let isRunning = true
  const logger = new LoggerFactoryService().getLogger('TickerService')
  const exi = selectTickerExchange(conf.exchangeName)

  // attempt to get available pairs
  const pairsResponse = await exi.getAvailablePairs(conf.apiUrl, conf.threshold)
  if (pairsResponse instanceof Error) return pairsResponse
  const pairs = pairsResponse.map(p => p.tradename)

  // register handlers
  tickerWS.on('message', async (eventData: string) => {
    // attempt to parse the event
    if (!isRunning) return
    logger.debug(eventData)
    const event = exi.parseEvent(eventData)
  
    // log then eat any errors
    if (exi.isError(event)) {
      logger.error(eventData)
      tickerWS.close()
      process.exit()
    }

    if (typeof event != 'string') tickCallback(event)
  })

  process.once('SIGINT', async () => {
    // unsubscribe from ticker
    logger.info('Got shutdown request')
    isRunning = false
    tickerWS.send(JSON.stringify(exi.createStopRequest()))
    await c.sleep(10)
    tickerWS.close()
    logger.info('Shutdown complete')
  })

  // sleep while waiting for client socket state
  while (tickerWS.readyState === 0) await c.sleep(100)
  logger.info('Socket ready state: ' + tickerWS.readyState)

  // subscribe
  tickerWS.send(JSON.stringify(exi.createTickSubRequest(pairs)))
  logger.info('Subscription request sent')

  return undefined
}
