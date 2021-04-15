import type {
  ExchangeName,
  ExchangePair,
  OrderCancelRequest,
  OrderCreateRequest,
  PairPriceUpdate,
  PricedPair,
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
  Token,
} from 'exchange-models/kraken'

import WebSocket = require('ws')
import { Worker } from 'worker_threads'

export interface TradeDatum {
  assets: string[]
  pairs: PricedPair[]
  pairMap: Map<string, number>
  unSubRequest: object
  subRequest: object
}

export interface Config {
  exchangeName: ExchangeName
  initialAmount: number
  initialAsset: string
  eta: number
  key: Key
}

export interface Connections {
  tickws: WebSocket
  orderws: WebSocket
  worker: Worker
}

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

export interface Key {
  apiKey: string
  apiPrivateKey: string
}

export interface TickerExchangeDriver {
  createTickSubRequest: (pairs: string[]) => object
  parseTick: (eventData: string) => string | PairPriceUpdate
  createStopRequest: (pairs: string[]) => object
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
  getToken: (key: Key) => Promise<string>
}

export interface Recipe {
  initialAmount: number
  initialAssetIndex: number
  initialAssetName: string
  steps: OrderCreateRequest[]
  guardList?: string[]
}
