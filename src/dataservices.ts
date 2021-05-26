import ccxt from 'ccxt'
import ccxws from 'ccxws'

export const getExchangeApi = (exchangeName: ExchangeName): ccxt.Exchange => {
  if (exchangeName === 'kraken') return new ccxt.kraken()
  else throw Error('unknown exchange ' + exchangeName)
}

export const getExchangeWs = (exchangeName: ExchangeName): ccxws.Exchange => {
  if (exchangeName === 'kraken') return new ccxws.Kraken()
  else throw Error('unknown exchange ' + exchangeName)
}

export const startSubscription = (pairs: IndexedPair[], wsExchange: ccxws.Exchange): void =>
  pairs.forEach(pair =>
    wsExchange.subscribeTicker({
      base: pair.baseName,
      id: pair.name,
      quote: pair.quoteName,
      type: 'spot',
    })
  )

export const stopSubscription = (pairs: IndexedPair[], wsExchange: unknown): void => {
  pairs.forEach(pair =>
    (wsExchange as ccxws.Exchange).unsubscribeTicker({
      base: pair.baseName,
      id: pair.name,
      quote: pair.quoteName,
      type: 'spot',
    })
  )
  ;(wsExchange as ccxws.Exchange).close()
}

export const createTickCallback = (pairs: IndexedPair[], pairMap: Map<string, number>) => async (
  tick: ccxws.Ticker,
  market: ccxws.Market
): Promise<void> => {
  const pairIndex = pairMap.get(market.id)
  if (pairIndex === undefined)
    return Promise.reject(Error(`Invalid pair encountered. ${market.id}`))
  pairs[pairIndex].volume = Number(tick.askVolume) + Number(tick.bidVolume)
  pairs[pairIndex].ask = Number(tick.ask)
  pairs[pairIndex].bid = Number(tick.bid)
  return
}

export const getAvailablePairs = async (apiExchange: ccxt.Exchange): Promise<ExchangePair[]> =>
  apiExchange.loadMarkets().then(markets =>
    Object.entries(markets)
      .filter(([, market]) => market.symbol !== undefined)
      .map(
        ([, market], index): ExchangePair => ({
          baseName: market.baseId,
          quoteName: market.quoteId,
          index: index,
          name: market.id,
          tradename: market.symbol,
          ordermin: market.limits.amount['min'],
          makerFee: market.maker,
          takerFee: market.taker,
          precision: market.precision.amount,
          precisionMode: apiExchange.precisionMode,
          volume: 0,
          ask: 0,
          bid: 0,
        })
      )
  )

const buildAssets = (tradePairs: ExchangePair[]): string[] => [
  ...tradePairs.reduce(
    (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
    new Set<string>()
  ),
]

const buildIndexedPairs = (tradePairs: ExchangePair[], assets: string[]): IndexedPair[] =>
  tradePairs.map(pair => ({
    ...pair,
    baseIndex: assets.indexOf(pair.baseName),
    quoteIndex: assets.indexOf(pair.quoteName),
  }))

const buildPairMap = (tradePairs: ExchangePair[]): Map<string, number> =>
  new Map([
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.tradename, index])),
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.name, index])),
    ...new Map<string, number>(
      tradePairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
    ),
  ])

export const setupData = async (
  tradePairs: ExchangePair[]
): Promise<[readonly string[], IndexedPair[], Map<string, number>]> => [
  buildAssets(tradePairs),
  buildIndexedPairs(tradePairs, buildAssets(tradePairs)),
  buildPairMap(tradePairs),
]
