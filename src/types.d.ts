import type {
  ExchangeName,
  ExchangePair,
  OrderCreateRequest,
  OrderCancelRequest,
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
  parseEvent(eventData: string): string | [string, any]
  getReqId(parsedEvent: unknown): string
  isEvent(parsedEvent: unknown): boolean
  createOrderRequest(token: string, order: OrderCreateRequest): unknown
  cancelOrderRequest(token: string, cancel: OrderCancelRequest): unknown
  getWebSocketUrl: () => string
}
