import type { ExchangeName, PairPriceUpdate } from 'exchange-models/exchange'
import WebSocket = require('ws')
import * as kraken from './kraken/tick'
import type { TickerExchangeDriver } from './types'

export let selectExchangeDriver = (exchangeName: ExchangeName): TickerExchangeDriver => {
  switch (exchangeName) {
    case 'kraken':
      return kraken.getExchangeInterface()
    default:
      throw Error('Invalid exchange selected')
  }
}

export let shutdownTickService = async (
  tickerWS: WebSocket,
  exchangeDriver: TickerExchangeDriver
): Promise<void> => {
  // unsubscribe from ticker
  tickerWS.send(JSON.stringify(await exchangeDriver.createStopRequest()))
}

export let tickService = async (
  exchangeDriver: TickerExchangeDriver,
  tickerWS: WebSocket,
  tickCallback: (arg: string | PairPriceUpdate) => void
): Promise<WebSocket> => {
  // setup parser handler
  tickerWS.on('message', async (eventData: string) =>
    tickCallback(exchangeDriver.parseTick(eventData))
  )

  // sleep until WS is stable then subscribe
  while (tickerWS.readyState !== WebSocket.OPEN)
    await new Promise(resolve => setTimeout(resolve, 100))
  tickerWS.send(JSON.stringify(await exchangeDriver.createTickSubRequest()))
  return tickerWS
}
