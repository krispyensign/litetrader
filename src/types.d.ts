import type { ExchangeName, ExchangePair, OrderCreate, PairPriceUpdate } from 'exchange-models/exchange'

export interface TickerConfiguration {
  threshold: number
  wsUrl: string
  apiUrl: string
  exchangeName: ExchangeName
}

export interface TickerExchangeDriver {
  createTickSubRequest: { (instruments: string[]): object }
  parseTick: { (eventData: string): string | PairPriceUpdate }
  createStopRequest: { (): object }
  getAvailablePairs: {
    (exchangeApiUrl: string, threshold: number): Promise<ExchangePair[]>
  }
}

export interface OrdersExchangeDriver {
  getReqId(parsedEvent: unknown): string
  isEvent(parsedEvent: unknown): boolean
  createOrderRequest(token: string, order: OrderCreate): unknown
}
