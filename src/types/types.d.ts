import type { ExchangeName } from 'exchange-models/exchange'
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

export type PairPriceUpdate = {
  tradeName: string
  ask: number
  bid: number
}

export type TickModule = [
  (pairs: string[]) => string,
  (pairs: string[]) => string,
  (threshold?: number | undefined) => Promise<ExchangePair[]>,
  () => string,
  (tickData?: string | undefined) => string | PairPriceUpdate | Error
]

export type OrderModule = [
  (token: string, cancel: OrderCancelRequest) => string,
  (token: string, order: OrderCreateRequest) => string,
  (parsedEvent: unknown) => string,
  () => string,
  (event: unknown) => boolean,
  (eventData: string) => string
]

export type OrderCancelRequest = {
  event: 'cancel'
  orderId: string
}

export type OrderCreateRequest = {
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

export type ExchangePair = {
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

export type IndexedPair = {
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

export type Config = {
  exchangeName: ExchangeName
  initialAmount: number
  initialAsset: string
  eta: number
  key: Key
}

export type Dictionary<T> = {
  [key: string]: T
}

export type Key = {
  apiKey: string
  apiPrivateKey: string
}

export type Recipe = {
  initialAmount: number
  initialAssetIndex: number
  initialAssetName: string
  steps: OrderCreateRequest[]
  guardList?: string[]
}
