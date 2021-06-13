type ExchangeName = 'kraken' | 'binance' | 'cexio' | 'coinbase'

type Dictionary<T> = {
  [key: string]: T
}

type Key = {
  readonly apiKey: string
  readonly apiPrivateKey: string
  readonly passphrase: string
}

type Config = {
  readonly exchangeName: ExchangeName
  readonly initialAmount: number
  readonly initialAsset: string
  readonly eta: number
  readonly key: Key
}

type OrderModule = readonly [
  (token: string, order: OrderCreateRequest) => string,
  (key: Key, nonce: number) => Promise<string>,
  () => WebSocket,
  (ws: WebSocket) => void,
  (data: string, ws: WebSocket) => void
]

type Closeable = { close(): void }

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
  readonly volume?: number
  readonly ordermin: number
  readonly ask?: number
  readonly bid?: number
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
  volume?: number
  readonly ordermin: number
  ask?: number
  bid?: number
  readonly quoteIndex: number
  readonly baseIndex: number
}
