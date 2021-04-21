import type { ExchangeName, OrderCreateRequest } from 'exchange-models/exchange'

import type { AssetPair, Ticker } from 'exchange-models/kraken'

export type {
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
import readline = require('readline')

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
  ask?: number
  bid?: number
  quoteIndex: number
  baseIndex: number
}

export interface TradeDatum {
  assets: string[]
  pairs: IndexedPair[]
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
  buildGraph: string
}

export interface Connections {
  tickws: WebSocket
  orderws: WebSocket
  worker: readline.Interface
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
