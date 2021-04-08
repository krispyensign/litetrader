import { getJson } from '../helpers'
import { isError, isKrakenPair, isLastTick, isPublication, isTicker } from './type-helpers'
import type {
  PairPriceUpdate,
  ExchangePair,
  ResponseWrapper,
  AssetPairsResponse,
  AssetTicksResponse,
  TickerExchangeDriver,
  Unsubscribe,
  Subscribe,
} from '../types'
export { getExchangeInterface }

const krakenTickerPath = '/0/public/Ticker',
  krakenPairsPath = '/0/public/AssetPairs',
  krakenApiUrl = 'https://api.kraken.com',
  krakenWsUrl = 'wss://ws.kraken.com'
// let krakenTokenPath = '/0/private/GetWebSocketsToken'

const parseTick = (tickData?: string): string | PairPriceUpdate => {
  // make sure we got something if not failure during ws message
  if (!tickData) throw Error('TickData missing. Cannot parse.')

  // parse it
  const event = JSON.parse(tickData)
  if (!event) throw Error(`Failed to parse ${tickData}`)

  // check to make sure its not an error.  Something wrong with code itself
  // so need to hard error on this one
  if ('errorMessage' in event) throw event.errorMessage

  // if its not a publication (unlikely) return the tick as a string for logging
  if (!isPublication(event)) return tickData

  // split out the publication to the pair and the payload
  const pair = event[3]
  const payload = event[1]

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

const getAvailablePairs = async (threshold?: number): Promise<ExchangePair[]> => {
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

const getExchangeInterface = (): TickerExchangeDriver => ({
  createStopRequest: async (): Promise<Unsubscribe> => ({
    event: 'unsubscribe',
    pair: (await getAvailablePairs()).map(p => p.tradename),
    subscription: {
      name: 'ticker',
    },
  }),
  createTickSubRequest: async (): Promise<Subscribe> => ({
    event: 'subscribe',
    pair: (await getAvailablePairs()).map(p => p.tradename),
    subscription: {
      name: 'ticker',
    },
  }),
  getAvailablePairs: getAvailablePairs,
  parseTick: parseTick,
  getWebSocketUrl: (): string => krakenWsUrl,
})
