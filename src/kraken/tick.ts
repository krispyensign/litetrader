import type { ExchangePair, PairPriceUpdate } from 'exchange-models/exchange'
import type { Subscribe, Unsubscribe } from 'exchange-models/kraken'
import { HttpClient } from 'socket-comms-libs'
import type { TickerExchangeDriver } from '../types'
import { isError, isKrakenPair, isLastTick, isPublication, isTicker } from './type-helpers'
import type { AssetPairsResponse, AssetTicksResponse, ResponseWrapper } from './types'

let krakenTickerPath = '/0/public/Ticker'
let krakenPairsPath = '/0/public/AssetPairs'
// let krakenTokenPath = '/0/private/GetWebSocketsToken'

let parseTick = (tickData?: string): string | PairPriceUpdate => {
  // make sure we got something if not failure during ws message
  if (!tickData) throw Error('TickData missing. Cannot parse.')

  // parse it
  let event = JSON.parse(tickData)
  if (!event) throw Error(`Failed to parse ${tickData}`)

  // check to make sure its not an error.  Something wrong with code itself
  // so need to hard error on this one
  if ('errorMessage' in event) throw event.errorMessage

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

let getAvailablePairs = async (
  krakenApiUrl: string,
  threshold: number
): Promise<ExchangePair[]> => {
  // get the tradeable asset pairs
  let assetPairsResult = await HttpClient.getJson<ResponseWrapper>(krakenApiUrl + krakenPairsPath)

  if (isError(assetPairsResult)) throw assetPairsResult

  // parse the tradeable assetPairs into tuples of name/assetPair
  let assetPairs = Object.entries(assetPairsResult.result) as AssetPairsResponse

  // get the last tick for each asset pair
  let assetPairTicksResult = await HttpClient.getJson<AssetTicksResponse>(
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
          assetPairTicks[name].t![0] > threshold
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

export let getExchangeInterface = (): TickerExchangeDriver => ({
  createStopRequest: (): Unsubscribe => ({
    event: 'unsubscribe',
    subscription: {
      name: '*',
    },
  }),
  createTickSubRequest: (instruments: string[]): Subscribe => ({
    event: 'subscribe',
    pair: instruments,
    subscription: {
      name: 'ticker',
    },
  }),
  getAvailablePairs: getAvailablePairs,
  parseTick: parseTick,
})
