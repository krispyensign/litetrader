import type { TickerResponse } from '../types/kraken'
import type { AssetPair, Dictionary, ExchangePair } from '../types/types'
import { compareTypes, unwrapJson } from './common.js'

const krakenTickerPath = '/0/public/Ticker'
const krakenPairsPath = '/0/public/AssetPairs'
const krakenWsUrl = 'wss://ws.kraken.com'
const krakenApiUrl = 'https://api.kraken.com'

const extractReason = async (
  context: 'pair' | 'tick',
  pairName: string,
  result: string | boolean
): Promise<true> =>
  result === false
    ? Promise.reject(new Error(`Failed to correctly populate ${context} ${pairName}`))
    : typeof result === 'string'
    ? Promise.reject(new Error(`Missing resource ${result} on ${context} ${pairName}.`))
    : true

const isKrakenPair = async (pairName: string, pair?: unknown): Promise<boolean> =>
  extractReason(
    'pair',
    pairName,
    compareTypes(pair, ['wsname', 'base', 'quote', 'fees_maker', 'fees', 'pair_decimals'])
  )

const isLastTick = async (pairName: string, tick?: unknown): Promise<boolean> =>
  extractReason('tick', pairName, compareTypes(tick, ['a', 'b', 't']))

const createExchangePair = (
  name: string,
  index: number,
  pair: AssetPair,
  assetPairTicks: Dictionary<TickerResponse>
): ExchangePair => ({
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

export const getAvailablePairs = async (threshold = 0): Promise<readonly ExchangePair[]> =>
  // get the tradeable asset pairs
  unwrapJson<Dictionary<AssetPair>>(krakenApiUrl + krakenPairsPath)
    .then(assetPairsRes => Object.entries(assetPairsRes))
    .then(assetPairs =>
      unwrapJson<Dictionary<TickerResponse>>(
        krakenApiUrl + krakenTickerPath + '?pair=' + assetPairs.map(pair => pair[0]).join(',')
      ).then(assetPairTicks =>
        assetPairs

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
          .map(([name, pair], index) => createExchangePair(name, index, pair, assetPairTicks))
      )
    )

export const createStopRequest = (pairs: readonly string[]): string =>
  JSON.stringify({
    event: 'unsubscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export const createTickSubRequest = (pairs: readonly string[]): string =>
  JSON.stringify({
    event: 'subscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export const webSocketUrl = krakenWsUrl
