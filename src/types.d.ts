import type {
  ExchangeName,
  ExchangePair,
  OrderCreate,
  PairPriceUpdate,
} from 'exchange-models/exchange'

export interface TickerConfiguration {
  threshold: number
  wsUrl: string
  exchangeName: ExchangeName
}

export interface TickerExchangeDriver {
  createTickSubRequest: () => Promise<object>
  parseTick: (eventData: string) => string | PairPriceUpdate
  createStopRequest: () => Promise<object>
  getAvailablePairs: (threshold?: number) => Promise<ExchangePair[]>
  getWebSocketUrl: () => string
}

export interface OrdersExchangeDriver {
  getReqId(parsedEvent: unknown): string
  isEvent(parsedEvent: unknown): boolean
  createOrderRequest(token: string, order: OrderCreate): unknown
}
