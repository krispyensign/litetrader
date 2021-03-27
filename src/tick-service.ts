import type { PairPriceUpdate } from 'exchange-models/exchange'
import WebSocket = require('ws')
import { getExchangeInterface } from './kraken/tick'
import type { TickerConfiguration, TickerExchangeDriver } from './types'

export let tickService = async (
  conf: TickerConfiguration,
  tickerWS: WebSocket,
  tickCallback: (arg: string | PairPriceUpdate) => void
): Promise<WebSocket> => {
  // configure ticker behavior
  let exchangeDriver = ((): TickerExchangeDriver => {
    switch (conf.exchangeName) {
      case 'kraken':
        return getExchangeInterface()
      default:
        throw Error('Invalid exchange selected')
    }
  })()

  // setup parser handler
  tickerWS.on('message', async (eventData: string) => {
    if (tickerWS.readyState !== WebSocket.OPEN) return
    try {
      tickCallback(exchangeDriver.parseTick(eventData))
    } catch (e) {
      tickerWS.close()
      throw e
    }
  })

  // setup ctrl+c handler for local dev
  process.once('SIGINT', async () => {
    // unsubscribe from ticker
    tickerWS.send(JSON.stringify(exchangeDriver.createStopRequest()))
    await new Promise(resolve => setTimeout(resolve, 10))
    tickerWS.close()
  })

  // sleep until WS is stable then subscribe
  while (tickerWS.readyState !== WebSocket.OPEN)
    await new Promise(resolve => setTimeout(resolve, 100))
  tickerWS.send(
    JSON.stringify(
      exchangeDriver.createTickSubRequest(
        (await exchangeDriver.getAvailablePairs(conf.apiUrl, conf.threshold)).map(p => p.tradename)
      )
    )
  )
  return tickerWS
}
