export type ExchangeName = 'kraken' | 'binance' | 'cexio' | 'coinbase'

export type Steps = Step[] | Error | 0

export type ValidatedSteps = Step[]

export type StepSnapshot =
  | {
      steps: ValidatedSteps
      pair: IndexedPair
      index: number
      amount: number
    }
  | Error
  | 0

export type Step = {
  orderCreateRequest: OrderCreateRequest
  index: number
  amount: number
}

export type StepMaterial = {
  index: number
  pair: IndexedPair
  amount: number
  eta: number
}

export type PairPriceUpdate = {
  readonly tradeName: string
  readonly ask: number
  readonly bid: number
}

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

export type Dictionary<T> = {
  [key: string]: T
}

export type Key = {
  readonly apiKey: string
  readonly apiPrivateKey: string
}
