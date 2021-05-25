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

export const getAvailablePairs = async (apiExchange: ccxt.Exchange): Promise<ExchangePair[]> =>
  apiExchange.fetchTickers().then(tickers =>
    apiExchange.loadMarkets().then(markets =>
      Object.entries(markets)
        .filter(([marketName]) => tickers[marketName] !== undefined)
        .map(
          ([marketName, market], index): ExchangePair => ({
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
            volume: (tickers[marketName].baseVolume ?? 0) + (tickers[marketName].quoteVolume ?? 0),
            ask: tickers[marketName].ask,
            bid: tickers[marketName].bid,
          })
        )
    )
  )

export const startSubscription = (pairs: IndexedPair[], wsExchange: unknown): void =>
  pairs.forEach(pair =>
    (wsExchange as ccxws.Exchange).subscribeTicker({
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
