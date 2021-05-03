import type { TickerResponse } from '../types/kraken'
import type { AssetPair, Dictionary, ExchangePair, Ticker } from '../types/types'
import {
  compareTypes,
  krakenApiUrl,
  krakenPairsPath,
  krakenTickerPath,
  krakenWsUrl,
  unwrapJson,
} from './common.js'
import { isError } from '../helpers.js'

const isKrakenPair = (pairName: string, pair?: unknown): pair is AssetPair => {
  const result = compareTypes(
    pair,
    'wsname',
    'base',
    'quote',
    'fees_maker',
    'fees',
    'pair_decimals'
  )
  if (!result) throw Error(`Failed to correctly populate pair ${pairName}`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

const isLastTick = (pairName: string, tick?: unknown): tick is Ticker => {
  const result = compareTypes(tick, 'a', 'b', 't')
  if (!result) throw Error(`Failed to correctly populate tick ${pairName}.`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

export const getAvailablePairs = async (threshold = 0): Promise<ExchangePair[] | Error> => {
  // get the tradeable asset pairs
  const assetPairsRes = await unwrapJson<Dictionary<AssetPair>>(krakenApiUrl + krakenPairsPath)
  if (isError(assetPairsRes)) return assetPairsRes

  // get the last tick for each asset pair
  const assetPairTicksRes = await unwrapJson<Dictionary<TickerResponse>>(
    krakenApiUrl + krakenTickerPath + '?pair=' +  Object.entries(assetPairsRes).map(pair => pair[0]).join(',')
  )
  if (isError(assetPairTicksRes)) return assetPairTicksRes
  const assetPairTicks = assetPairTicksRes

  return (
    Object.entries(assetPairsRes)

      // skip those pairs that do not support websocket streaming
      // and skip those pairs whose t value is greater than threshold
      // additionally skip all pairs that were not parseable
      .filter(
        ([name, pair]) =>
          pair.wsname &&
          isKrakenPair(name, pair) &&
          isLastTick(name, assetPairTicks[name]) &&
          assetPairTicks[name].t[0] >= threshold
      )

      // convert from array of kraken pairs to exchange pairs
      .map(
        ([name, pair], index): ExchangePair => ({
          index: index,
          tradename: pair.wsname,
          name: name,
          decimals: pair.pair_decimals,
          baseName: pair.base,
          quoteName: pair.quote!,
          makerFee: Number(pair.fees_maker[0][1]) / 100,
          takerFee: Number(pair.fees[0][1]) / 100,
          volume: assetPairTicks[name].t[0],
          ask: assetPairTicks[name].a[0],
          bid: assetPairTicks[name].b[0],
          ordermin: Number(pair.ordermin),
        })
      )
  )
}

export const createStopRequest = (pairs: string[]): string =>
  JSON.stringify({
    event: 'unsubscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export const createTickSubRequest = (pairs: string[]): string =>
  JSON.stringify({
    event: 'subscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export const getWebSocketUrl = (): string => krakenWsUrl
