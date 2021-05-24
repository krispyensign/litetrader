import * as ccxt from 'ccxt'
import { ExchangePair } from '../types'

const exchange = new ccxt.kraken({
  substituteCommonCurrencyCodes: false,
})

export const getAvailablePairs = async (): Promise<readonly ExchangePair[]> =>
  exchange.fetchTickers().then((tickers: ccxt.Dictionary<ccxt.Ticker>) =>
    exchange.loadMarkets().then((markets: ccxt.Dictionary<ccxt.Market>) =>
      Object.entries(markets)
        .filter(([marketName]: [string, ccxt.Market]) => tickers[marketName] !== undefined)
        .map(
          ([marketName, market]: [string, ccxt.Market], index: number): ExchangePair => ({
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
