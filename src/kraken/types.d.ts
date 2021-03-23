import type { AssetPair, Ticker } from 'exchange-models/kraken'

interface Dictionary<T> {
  [key: string]: T
}

type AssetPairsResponse = [string, Partial<AssetPair>][]
type AssetTicksResponse = ResponseWrapper<Dictionary<Partial<Ticker>>>

interface ResponseWrapper<T = object> {
  error: string[]
  result: T
}
