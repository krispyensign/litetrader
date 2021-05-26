type OrderModule = readonly [
  (token: string, cancel: OrderCancelRequest) => string,
  (token: string, order: OrderCreateRequest) => string,
  (parsedEvent: unknown) => string,
  string,
  (event: unknown) => boolean,
  (eventData: string) => string,
  (key: Key, nonce: number) => Promise<string>
]

type GraphWorkerData = {
  initialAssetIndex: number
  initialAmount: number
  assets: readonly string[]
  pairs: IndexedPair[]
  pairMap: ReadonlyMap<string, number>
  eta: number
  token: string
}

type Config = {
  readonly exchangeName: ExchangeName
  readonly initialAmount: number
  readonly initialAsset: string
  readonly eta: number
  readonly key: Key
}

type ExchangeName = 'kraken' | 'binance' | 'cexio' | 'coinbase'

type Steps = Step[] | Error | 0

type ValidatedSteps = Step[]

type StepSnapshot =
  | {
      steps: ValidatedSteps
      pair: IndexedPair
      index: number
      amount: number
    }
  | Error
  | 0

type Step = {
  orderCreateRequest: OrderCreateRequest
  index: number
  amount: number
}

type StepMaterial = {
  index: number
  pair: IndexedPair
  amount: number
  eta: number
}

type PairPriceUpdate = {
  readonly tradeName: string
  readonly ask: number
  readonly bid: number
}

type OrderCancelRequest = {
  readonly event: 'cancel'
  readonly orderId: string
}

type OrderCreateRequest = {
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

type ExchangePair = {
  readonly index: number
  readonly name: string
  readonly tradename: string
  readonly precision: number
  readonly precisionMode?: number
  readonly baseName: string
  readonly quoteName: string
  readonly makerFee: number
  readonly takerFee: number
  readonly volume: number
  readonly ordermin: number
  readonly ask: number
  readonly bid: number
}

type IndexedPair = {
  readonly index: number
  readonly name: string
  readonly tradename: string
  readonly precision: number
  readonly precisionMode?: number
  readonly baseName: string
  readonly quoteName: string
  readonly makerFee: number
  readonly takerFee: number
  volume: number
  readonly ordermin: number
  ask: number
  bid: number
  readonly quoteIndex: number
  readonly baseIndex: number
}

type Dictionary<T> = {
  [key: string]: T
}

type Key = {
  readonly apiKey: string
  readonly apiPrivateKey: string
}
