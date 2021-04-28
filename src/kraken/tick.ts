import type {
  PairPriceUpdate,
  ExchangePair,
  ResponseWrapper,
  AssetPairsResponse,
  AssetPair,
  Publication,
  Ticker,
} from '../types/types'

import got from 'got'
import { AssetTicksResponse } from '../types/kraken'

// setup the global constants
const krakenTickerPath = '/0/public/Ticker'
const krakenPairsPath = '/0/public/AssetPairs'
const krakenApiUrl = 'https://api.kraken.com'
const krakenWsUrl = 'wss://ws.kraken.com'

const getJson = async <T>(url: string): Promise<T | Error> => {
  let result: T | Error
  try {
    const innerResult: T | undefined = await got(url).json<T>()
    if (innerResult !== undefined) result = innerResult
    else result = new Error('Failed to get back response from url: ' + url)
  } catch (e) {
    result = e
  }
  return result
}

const isObject = (o: unknown): o is object => {
  return o !== null && o !== undefined && typeof o === 'object'
}

const compareTypes = (o: unknown, ...propertyNames: string[]): boolean | string => {
  // check if object is undefined
  if (isObject(o)) {
    // loop through supplied propertynames
    for (const prop of propertyNames) {
      // if property is not in object then return that property
      if (!(prop in o)) return prop.toString()
    }
    // return true if all properties requested are on object
    return true
  }
  return false
}

const isTickerPayload = (payload: unknown): payload is Ticker => {
  if (!payload) return false
  const result = compareTypes(payload, 'a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o')
  if (!result || typeof result === 'string') return false
  const tickerPayload = payload as Ticker
  return (
    typeof tickerPayload.a === 'object' &&
    tickerPayload.a.length > 0 &&
    typeof tickerPayload.b === 'object' &&
    tickerPayload.b.length > 0
  )
}

const isPublication = (event: unknown): event is Publication => {
  return (event as Publication).length !== undefined && (event as Publication).length === 4
}

const isKrakenPair = (pairName: string, pair?: unknown): pair is AssetPair => {
  if (!pair) return false
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
  if (!tick) return false
  const result = compareTypes(tick, 'a', 'b', 't')
  if (!result) throw Error(`Failed to correctly populate tick ${pairName}.`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

const isError = (err: unknown): err is Error => {
  return (
    typeof err === 'object' &&
    (err as Error).message !== undefined &&
    (err as Error).stack !== undefined
  )
}

export const parseTick = (tickData?: string): string | PairPriceUpdate => {
  // make sure we got something if not failure during ws message
  if (!tickData) throw Error('TickData missing. Cannot parse.')

  // parse it
  const event = JSON.parse(tickData)
  if (!event) throw Error(`Failed to parse ${tickData}`)

  // check to make sure its not an error.  Something wrong with code itself
  // so need to hard error on this one
  if ('errorMessage' in event) throw Error(event.errorMessage)

  // if its not a publication (unlikely) return the tick as a string for logging
  if (!isPublication(event)) return tickData

  // split out the publication to the pair and the payload
  const pair = event[3]
  const payload = event[1]

  // check if the payload is a ticker if so then return back an update object
  if (isTickerPayload(payload))
    return {
      tradeName: pair,
      ask: payload.a[0],
      bid: payload.b[0],
    }

  // for now return all other publications as strings for logging
  return tickData
}

export const getAvailablePairs = async (threshold?: number): Promise<ExchangePair[]> => {
  // get the tradeable asset pairs
  if (threshold === undefined || threshold === null) threshold = 0
  const assetPairsResult = await getJson<ResponseWrapper>(krakenApiUrl + krakenPairsPath)

  if (isError(assetPairsResult)) throw assetPairsResult

  // parse the tradeable assetPairs into tuples of name/assetPair
  const assetPairs = Object.entries(assetPairsResult.result) as AssetPairsResponse

  // get the last tick for each asset pair
  const assetPairTicksResult = await getJson<AssetTicksResponse>(
    krakenApiUrl + krakenTickerPath + '?pair=' + assetPairs.map(pair => pair[0]).join(',')
  )
  if (isError(assetPairTicksResult)) throw assetPairTicksResult

  // rename for easy reading
  const assetPairTicks = assetPairTicksResult.result

  return (
    assetPairs

      // skip those pairs that do not support websocket streaming
      // and skip those pairs whose t value is greater than threshold
      // additionally skip all pairs that were not parseable
      .filter(
        ([name, pair]) =>
          pair.wsname &&
          isKrakenPair(name, pair) &&
          isLastTick(name, assetPairTicks[name]) &&
          assetPairTicks[name].t?.[0] !== undefined &&
          assetPairTicks[name].t![0] > threshold!
      )

      // convert from array of kraken pairs to exchange pairs
      .map(
        ([name, pair], index): ExchangePair => ({
          index: index,
          tradename: pair.wsname!,
          name: name,
          decimals: pair.pair_decimals!,
          baseName: pair.base!,
          quoteName: pair.quote!,
          makerFee: Number(pair.fees_maker![0][1]) / 100,
          takerFee: Number(pair.fees![0][1]) / 100,
          volume: assetPairTicks[name].t![0],
          ask: assetPairTicks[name].a![0],
          bid: assetPairTicks[name].b![0],
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
