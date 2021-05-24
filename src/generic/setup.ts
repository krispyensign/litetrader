import type { Dictionary, Ticker, Market } from 'ccxt'
import type { ExchangePair, IndexedPair } from '../types'
import * as ccxt from 'ccxt'
import * as ccxws from 'ccxws'

const apiExchange = new ccxt.kraken({
  substituteCommonCurrencyCodes: false,
})

const wsExchange = new ccxws.Kraken({
  apiKey: 'apiKey',
  apiSecret: 'apiSecret',
})

export const getAvailablePairs = async (): Promise<readonly ExchangePair[]> =>
  apiExchange.fetchTickers().then((tickers: Dictionary<Ticker>) =>
    apiExchange.loadMarkets().then((markets: Dictionary<Market>) =>
      Object.entries<Market>(markets)
        .filter(([marketName]) => tickers[marketName] !== undefined)
        .map(
          ([marketName, market], index): ExchangePair => ({
            baseName: market.baseId,
            quoteName: market.quoteId,
            index: index,
            name: marketName,
            tradename: market.symbol,
            ordermin: market.limits.amount['min'],
            makerFee: market.maker,
            takerFee: market.taker,
            precision: market.precision.amount,
            precisionMode: apiExchange.precisionMode,
            volume: (tickers[marketName].baseVolume ?? 0) + (tickers[marketName].quoteVolume ?? 0),
            ask: tickers[marketName].ask,
            bid: tickers[marketName].bid,
          })
        )
    )
  )

export const startSubscription = (pairs: IndexedPair[]): void =>
  pairs.forEach(pair =>
    wsExchange.subscribeTicker({
      base: pair.baseName,
      id: pair.name,
      quote: pair.quoteName,
      type: 'spot',
    })
  )
