import type { ExchangeName } from 'exchange-models/exchange'

import type { AssetPair } from 'exchange-models/kraken'

export type { ExchangeName } from 'exchange-models/exchange'

export type {
  AddOrder,
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

export interface PairPriceUpdate {
  tradeName: string
  ask: number
  bid: number
}

export type TickModule = [
  (pairs: string[]) => string,
  (pairs: string[]) => string,
  (threshold?: number | undefined) => Promise<ExchangePair[]>,
  () => string,
  (tickData?: string | undefined) => string | PairPriceUpdate
]

export type OrderModule = [
  (token: string, cancel: OrderCancelRequest) => string,
  (token: string, order: OrderCreateRequest) => string,
  (parsedEvent: unknown) => string,
  () => string,
  (event: unknown) => boolean,
  (eventData: string) => string
]

export interface OrderCancelRequest {
  event: 'cancel'
  orderId: string
}

export interface OrderCreateRequest {
  event: 'create'
  requestId?: string
  orderId?: string
  pair: string
  /**
   * Which way a trade goes
   */
  direction: 'buy' | 'sell'
  /**
   * What kind of order
   */
  orderType: 'market' | 'limit'
  amount: number
  price?: number
}

export interface ExchangePair {
  index: number
  name: string
  tradename: string
  decimals: number
  baseName: string
  quoteName: string
  makerFee: number
  takerFee: number
  volume: number
  ordermin: number
  ask: number
  bid: number
}

export interface IndexedPair {
  index: number
  name: string
  tradename: string
  decimals: number
  baseName: string
  quoteName: string
  makerFee: number
  takerFee: number
  volume: number
  ordermin: number
  ask: number
  bid: number
  quoteIndex: number
  baseIndex: number
}

export interface Config {
  exchangeName: ExchangeName
  initialAmount: number
  initialAsset: string
  eta: number
  key: Key
}

export interface Dictionary<T> {
  [key: string]: T
}

export type AssetPairsResponse = [string, Partial<AssetPair>][]

export interface ResponseWrapper<T = object> {
  error: string[]
  result: T
}

export interface Key {
  apiKey: string
  apiPrivateKey: string
}

export interface Recipe {
  initialAmount: number
  initialAssetIndex: number
  initialAssetName: string
  steps: OrderCreateRequest[]
  guardList?: string[]
}
