declare module 'ccxws' {
  export type ConnectionEventType =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'closing'
    | 'closed'
    | 'reconnecting'

  export type ExchangeEventType =
    | 'ticker'
    | 'candle'
    | 'trade'
    | 'l2snapshot'
    | 'l2update'
    | 'l3snapshot'
    | 'l3update'
    | 'error'

  export type EventType = ConnectionEventType | ExchangeEventType

  export enum CandlePeriod {
    _1m = '_1m',
    _2m = '_2m',
    _3m = '_3m',
    _5m = '_5m',
    _15m = '_15m',
    _30m = '_30m',
    _1h = '_1h',
    _2h = '_2h',
    _4h = '_4h',
    _6h = '_6h',
    _8h = '_8h',
    _12h = '_12h',
    _1d = '_1d',
    _3d = '_3d',
    _1w = '_1w',
    _2w = '_2w',
    _1M = '_1M',
  }

  export type Ticker = {
    exchange: string
    base: string
    quote: string
    timestamp: number
    last: string
    open: string
    low: string
    high: string
    volume: string
    quoteVolume: string
    change: string
    changePercent: string
    bid: string
    bidVolume: string
    ask: string
    askVolume: string
  }

  export type Trade = {
    exchange: string
    base: string
    quote: string
    tradeId: string
    unix: number
    side: string
    price: string
    amount: string
    buyOrderId?: string
    sellOrderId?: string
  }

  export type Candle = {
    timestampMs: number
    open: string
    high: string
    low: string
    close: string
    volume: string
  }

  export type LevelData<T> = {
    exchange: string
    base: string
    quote: string
    timestampMs?: number
    sequenceId?: number
    asks: T[]
    bids: T[]
  }

  export type Level2Point = {
    price: string
    size: string
    count?: number
  }

  export type Level3Point = {
    orderId: string
    price: string
    size: string
    meta?: unknown
  }

  export type Level2Data = LevelData<Level2Point>

  export type Level3Data = LevelData<Level3Point>

  export type Market = {
    id: string
    base: string
    quote: string
    type?: string
  }

  export type EventCallbackMap = {
    connecting: () => void
    connected: () => void
    disconnected: () => void
    closing: () => void
    closed: () => void
    reconnecting: () => void
    error: (error: Error) => void
    ticker: (ticker: Ticker, market: Market) => void
    trade: (trade: Trade, market: Market) => void
    candle: (candle: Candle, market: Market) => void
    l2snapshot: (snapshot: Level2Data, market: Market) => void
    l2update: (snapshot: Level2Data, market: Market) => void
    l3snapshot: (snapshot: Level3Data, market: Market) => void
    l3update: (snapshot: Level3Data, market: Market) => void
  }

  export type ExchangeOptions = {
    wssPath?: string
    watcherMs?: number
    apiKey?: string
    apiSecret?: string
  }

  export class Exchange {
    constructor(options?: ExchangeOptions)

    candlePeriod: keyof CandlePeriod
    hasTickers: boolean
    hasTrades: boolean
    hasCandles: boolean
    hasLevel2Snapshots: boolean
    hasLevel2Updates: boolean
    hasLevel3Snapshots: boolean
    hasLevel3Updates: boolean
    on<T extends EventType>(event: T, callback: EventCallbackMap[T]): void
    subscribeTicker(market: Market): void
    unsubscribeTicker(market: Market): void
    subscribeTrades(market: Market): void
    unsubscribeTrades(market: Market): void
    subscribeCandles(market: Market): void
    unsubscribeCandles(market: Market): void
    subscribeLevel2Snapshots(market: Market): void
    unsubscribeLevel2Snapshots(market: Market): void
    subscribeLevel2Updates(market: Market): void
    unsubscribeLevel2Updates(market: Market): void
    subscribeLevel3Snapshots(market: Market): void
    unsubscribeLevel3Snapshots(market: Market): void
    subscribeLevel3Updates(market: Market): void
    unsubscribeLevel3Updates(market: Market): void
  }

  export class Bibox extends Exchange {}

  export class Binance extends Exchange {}

  export class BinanceFuturesCoinM extends Exchange {}

  export class BinanceFuturesUsdtM extends Exchange {}

  export class BinanceJe extends Exchange {}

  export class BinanceUs extends Exchange {}

  export class Bitfinex extends Exchange {}

  export class Bitflyer extends Exchange {}

  export class Bithumb extends Exchange {}

  export class BitMEX extends Exchange {}

  export class Bitstamp extends Exchange {}

  export class Bittrex extends Exchange {}

  export class Cex extends Exchange {}

  export class CoinbasePro extends Exchange {}

  export class Coinex extends Exchange {}

  export class Deribit extends Exchange {}

  export class Digifinex extends Exchange {}

  export class Ethfinex extends Exchange {}

  export class ErisX extends Exchange {}

  export class Ftx extends Exchange {}

  export class FtxUs extends Exchange {}

  export class Gateio extends Exchange {}

  export class Gemini extends Exchange {}

  export class HitBTC extends Exchange {}

  export class Huobi extends Exchange {}

  export class HuobiFutures extends Exchange {}

  export class HuobiSwaps extends Exchange {}

  export class HuobiJapan extends Exchange {}

  export class HuobiKorea extends Exchange {}

  export class HuobiRussia extends Exchange {}

  export class Kucoin extends Exchange {}

  export class Kraken extends Exchange {}

  export class LedgerX extends Exchange {}

  export class Liquid extends Exchange {}

  export class OKEx extends Exchange {}

  export class Poloniex extends Exchange {}

  export class Upbit extends Exchange {}

  export class Zb extends Exchange {}
}
