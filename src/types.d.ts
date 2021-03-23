import type { ExchangeName, ExchangePair, PairPriceUpdate } from 'exchange-models/exchange'
import type { Subscribe } from 'exchange-models/kraken'

export interface TickerConfiguration {
  threshold: number
  wsUrl: string
  apiUrl: string
  exchangeName: ExchangeName
}

export interface TickerExchangeInterface {
  createTickSubRequest: { (instruments: string[]): Subscribe }
  parseTick: { (eventData: string): string | PairPriceUpdate }
  createStopRequest: { (): object }
  getAvailablePairs: {
    (exchangeApiUrl: string, threshold: number): Promise<ExchangePair[]>
  }
}
