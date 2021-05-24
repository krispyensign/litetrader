import type { Dictionary, Ticker, Market } from 'ccxt'
import type { ExchangePair } from '../types'
import { kraken } from 'ccxt'

const exchange = new kraken({
  substituteCommonCurrencyCodes: false,
})

export const getAvailablePairs = async (): Promise<readonly ExchangePair[]> =>
  exchange.fetchTickers().then((tickers: Dictionary<Ticker>) =>
    exchange.loadMarkets().then((markets: Dictionary<Market>) =>
      Object.entries(markets)
        .filter(([marketName]: [string, Market]) => tickers[marketName] !== undefined)
        .map(
          ([marketName, market]: [string, Market], index: number): ExchangePair => ({
            baseName: market.baseId,
            quoteName: market.quoteId,
            index: index,
            name: marketName,
            tradename: market.symbol,
            ordermin: market.limits.amount['min'],
            makerFee: market.maker,
            takerFee: market.taker,
            precision: market.precision.amount,
            precisionMode: exchange.precisionMode,
            volume: (tickers[marketName].baseVolume ?? 0) + (tickers[marketName].quoteVolume ?? 0),
            ask: tickers[marketName].ask,
            bid: tickers[marketName].bid,
          })
        )
    )
  )
