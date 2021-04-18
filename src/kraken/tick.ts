import { getJson } from '../helpers'
import type {
  PairPriceUpdate,
  ExchangePair,
  ResponseWrapper,
  AssetPairsResponse,
  AssetTicksResponse,
  AssetPair,
  Publication,
  Ticker,
} from '../types'

// setup the global constants
let krakenTickerPath = '/0/public/Ticker'
let krakenPairsPath = '/0/public/AssetPairs'
let krakenApiUrl = 'https://api.kraken.com'
let krakenWsUrl = 'wss://ws.kraken.com'

let compareTypes = <U>(o: object, ...propertyNames: (keyof U)[]): boolean | string | undefined => {
  // check if object is undefined
  if (!o) return undefined
  // loop through supplied propertynames
  for (let prop of propertyNames) {
    // if property is not in object then return that property
    if (!(prop in o)) return prop.toString()
  }
  // return true if all properties requested are on object
  return true
}

let isTicker = (payload: object): payload is Ticker => {
  if (!payload) return false
  let result = compareTypes<Ticker>(payload, 'a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o')
  if (!result || typeof result === 'string') return false
  return result
}

let isPublication = (event: object): event is Publication => {
  return (event as Publication).length !== undefined && (event as Publication).length === 4
}

let isKrakenPair = (pairName: string, pair?: Partial<AssetPair>): pair is AssetPair => {
  if (!pair) return false
  let result = compareTypes(pair, 'wsname', 'base', 'quote', 'fees_maker', 'fees', 'pair_decimals')
  if (!result) throw Error(`Failed to correctly populate pair ${pairName}`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

let isLastTick = (pairName: string, tick?: Partial<Ticker>): tick is Ticker => {
  if (!tick) return false
  let result = compareTypes(tick, 'a', 'b', 't')
  if (!result) throw Error(`Failed to correctly populate tick ${pairName}.`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

let isError = (err: unknown): err is Error => {
  return (
    typeof err === 'object' &&
    (err as Error).message !== undefined &&
    (err as Error).stack !== undefined
  )
}

export let parseTick = (tickData?: string): string | PairPriceUpdate => {
  // make sure we got something if not failure during ws message
  if (!tickData) throw Error('TickData missing. Cannot parse.')

  // parse it
  let event = JSON.parse(tickData)
  if (!event) throw Error(`Failed to parse ${tickData}`)

  // check to make sure its not an error.  Something wrong with code itself
  // so need to hard error on this one
  if ('errorMessage' in event) throw Error(event.errorMessage)

  // if its not a publication (unlikely) return the tick as a string for logging
  if (!isPublication(event)) return tickData

  // split out the publication to the pair and the payload
  let pair = event[3]
  let payload = event[1]

  // check if the payload is a ticker if so then return back an update object
  if (isTicker(payload))
    return {
      tradeName: pair,
      ask: payload.a?.[0], // ask price
      bid: payload.b?.[0], // bid price
    }

  // for now return all other publications as strings for logging
  return tickData
}

export let getAvailablePairs = async (threshold?: number): Promise<ExchangePair[]> => {
  // get the tradeable asset pairs
  if (threshold === undefined || threshold === null) threshold = 0
  let assetPairsResult = await getJson<ResponseWrapper>(krakenApiUrl + krakenPairsPath)

  if (isError(assetPairsResult)) throw assetPairsResult

  // parse the tradeable assetPairs into tuples of name/assetPair
  let assetPairs = Object.entries(assetPairsResult.result) as AssetPairsResponse

  // get the last tick for each asset pair
  let assetPairTicksResult = await getJson<AssetTicksResponse>(
    krakenApiUrl + krakenTickerPath + '?pair=' + assetPairs.map(pair => pair[0]).join(',')
  )
  if (isError(assetPairTicksResult)) throw assetPairTicksResult

  // rename for easy reading
  let assetPairTicks = assetPairTicksResult.result

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
          assetPairTicks[name]?.t?.[0] !== undefined &&
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
export let createStopRequest = (pairs: string[]): string =>
  JSON.stringify({
    event: 'unsubscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })
export let createTickSubRequest = (pairs: string[]): string =>
  JSON.stringify({
    event: 'subscribe',
    pair: pairs,
    subscription: {
      name: 'ticker',
    },
  })

export let getWebSocketUrl = (): string => krakenWsUrl
