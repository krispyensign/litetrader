import type { ExchangeName, ExchangePair, PairPriceUpdate } from 'exchange-models/exchange'
import type { Subscribe } from 'exchange-models/kraken'

export interface TickerConfiguration {
  threshold: number
  wsUrl: string
  apiUrl: string
  exchangeName: ExchangeName
}

export interface TickerExchangeDriver {
  createTickSubRequest: { (instruments: string[]): Subscribe }
  parseTick: { (eventData: string): string | PairPriceUpdate }
  createStopRequest: { (): object }
  getAvailablePairs: {
    (exchangeApiUrl: string, threshold: number): Promise<ExchangePair[]>
  }
}

export interface OrdersExchangeDriver {
  getReqId(parsedEvent: unknown): string
  isEvent(parsedEvent: unknown): boolean
}
