import {
  ExchangeName,
  ExchangePair,
  OrderCancelRequest,
  OrderCreateRequest,
  PairPriceUpdate,
} from 'exchange-models/exchange'

import type { AssetPair, Ticker } from 'exchange-models/kraken'

export type {
  IndexedPair,
  PricedPair,
  ExchangePair,
  PairPriceUpdate,
  OrderCancelRequest,
  OrderCreateRequest,
  ExchangeName,
} from 'exchange-models/exchange'

export type {
  AddOrder,
  AddOrderStatus,
  CancelOrder,
  CancelOrderStatus,
  SubscriptionStatus,
  Subscribe,
  Unsubscribe,
  AssetPair,
  Ticker,
  Publication,
} from 'exchange-models/kraken'

export interface Dictionary<T> {
  [key: string]: T
}

export type AssetPairsResponse = [string, Partial<AssetPair>][]
export type AssetTicksResponse = ResponseWrapper<Dictionary<Partial<Ticker>>>

export interface ResponseWrapper<T = object> {
  error: string[]
  result: T
}

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
  parseEvent(eventData: string): string | [string, unknown]
  getReqId(parsedEvent: unknown): string
  isEvent(parsedEvent: unknown): boolean
  createOrderRequest(token: string, order: OrderCreateRequest): unknown
  cancelOrderRequest(token: string, cancel: OrderCancelRequest): unknown
  getWebSocketUrl: () => string
}

export interface Recipe {
  initialAmount: number
  initialAssetIndex: number
  initialAssetName: string
  steps: OrderCreateRequest[]
  guardList: string[]
}
