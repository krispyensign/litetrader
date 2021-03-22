import { ExchangeName, ExchangePair, PairPriceUpdate } from 'exchange-models/exchange'
import { Subscribe } from 'exchange-models/kraken'

export interface TickerConfiguration {
  threshold: number
  wsUrl: string
  apiUrl: string
  exchangeName: ExchangeName
}

interface TickerExchangeInterface {
  createTickSubRequest: { (instruments: string[]): Subscribe }
  isError: { (event: unknown): event is Error }
  parseEvent: { (eventData: string): string | Error | PairPriceUpdate }
  createStopRequest: { (): object }
  getAvailablePairs: {
    (exchangeApiUrl: string, threshold: number): Promise<Error | ExchangePair[]>
  }
}
