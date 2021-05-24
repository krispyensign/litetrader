import * as ccxt from 'ccxt'
import { ExchangePair } from '../types'

const exchange = new ccxt.kraken()
exchange.apiKey = 'YOUR_KRAKEN_API_KEY'
exchange.secret = 'YOUR_KRAKEN_SECRET_KEY'

export const getAvailablePairs = async (): Promise<readonly ExchangePair[]> =>
  exchange.fetchTickers().then((tickers: ccxt.Dictionary<ccxt.Ticker>) =>
    exchange.loadMarkets().then((markets: ccxt.Dictionary<ccxt.Market>) =>
      Object.entries(markets).map(
        ([marketName, market]: [string, ccxt.Market], index: number): ExchangePair => ({
          baseName: market.base,
          quoteName: market.quote,
          index: index,
          name: marketName,
          tradename: market.symbol,
          ordermin: market.limits.amount['min'],
          makerFee: market.maker,
          takerFee: market.taker,
          precision: market.precision.amount,
          precisionMode: exchange.precisionMode,
          volume: tickers[marketName].baseVolume + tickers[marketName].quoteVolume,
          ask: tickers[marketName].ask,
          bid: tickers[marketName].bid,
        })
      )
    )
  )
