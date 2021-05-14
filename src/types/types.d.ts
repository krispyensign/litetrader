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
  readonly tradeName: string
  readonly ask: number
  readonly bid: number
}

export type TickModule = readonly [
  (pairs: readonly string[]) => string,
  (pairs: readonly string[]) => string,
  (threshold?: number | undefined) => Promise<readonly ExchangePair[]>,
  string,
  (tickData?: string | undefined) => string | PairPriceUpdate | Error
]

export type OrderModule = readonly [
  (token: string, cancel: OrderCancelRequest) => string,
  (token: string, order: OrderCreateRequest) => string,
  (parsedEvent: unknown) => string,
  string,
  (event: unknown) => boolean,
  (eventData: string) => string,
  (key: Key, nonce: number) => Promise<string>
]

export type OrderCancelRequest = {
  readonly event: 'cancel'
  readonly orderId: string
}

export type OrderCreateRequest = {
  readonly event: 'create'
  readonly requestId?: string
  readonly orderId?: string
  readonly pair: string
  /**
   * Which way a trade goes
   */
  readonly direction: 'buy' | 'sell'
  /**
   * What kind of order
   */
  readonly orderType: 'market' | 'limit'
  readonly amount: number
  readonly price?: number
}

export type ExchangePair = {
  readonly index: number
  readonly name: string
  readonly tradename: string
  readonly decimals: number
  readonly baseName: string
  readonly quoteName: string
  readonly makerFee: number
  readonly takerFee: number
  readonly volume: number
  readonly ordermin: number
  readonly ask: number
  readonly bid: number
}

export type IndexedPair = {
  readonly index: number
  readonly name: string
  readonly tradename: string
  readonly decimals: number
  readonly baseName: string
  readonly quoteName: string
  readonly makerFee: number
  readonly takerFee: number
  readonly volume: number
  readonly ordermin: number
  ask: number
  bid: number
  readonly quoteIndex: number
  readonly baseIndex: number
}

export type Config = {
  readonly exchangeName: ExchangeName
  readonly initialAmount: number
  readonly initialAsset: string
  readonly eta: number
  readonly key: Key
}

export type Dictionary<T> = {
  [key: string]: T
}

export type Key = {
  readonly apiKey: string
  readonly apiPrivateKey: string
}
