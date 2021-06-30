import ccxt from 'ccxt'
import ccxws from 'ccxws'

const bannedPairIds = [
  'AUDUSD',
  'AUDJPY',
  'EURJPY',
  'GBPUSD',
  'ZGBPZUSD',
  'EURUSD',
  'ZEURZUSD',
  'USDJPY',
  'ZUSDZJPY',
  'SANDUSD',
  'SANDEUR',
  'MKRUSD',
  'MKRGBP',
  'MINAUSD',
  'MINAGBP',
  'EURGBP',
  'RENUSD',
  'RENEUR',
  'ENJUSD',
  'ENJEUR',
  'USDCHF',
  'EURCHF',
  'SUSHIUSD',
  'SUSHIEUR',
  'EURUSD',

  'GRTAUD',
  'GRTETH',
  'GRTEUR',
  'GRTGBP',
  'GRTUSD',
  'GRTXBT',

  'LPTUSD',
  'LPTEUR',
  'EURCAD',
  'USDCAD',
  'FLOWUSD',
  'FLOWEUR',
  'XRPEUR',
  'XRPUSD',
  'EURUSD',
  'USDJPY',
  'RARIUSD',
  'RARIEUR',
  'XRPAUD',
  'XRPETH',
  'XRPGBP',
  'XRPUSDT',
  'XXRPXXBT',
  'XXRPZCAD',
  'XXRPZEUR',
  'XXRPZJPY',
  'XXRPZUSD',

  'BNTUSD',
  'BNTGBP',
  'BNTEUR',
  'BNTXBT',
  'EWTZUSD',
  'EWTEUR',
  'GHSTUSD',
  'GHSTEUR',
  'ZUSDZCAD',
  'XREPZEUR',
  'XREPZUSD',
  'ZEURZAUD',
  'EURAUD',

  'RENUSD',
  'RENGBP',
  'RENEUR',
  'RENXBT',

  'SRMUSD',
  'SRMGBP',
  'SRMEUR',
  'SRMXBT',

  'ZRXUSD',
  'ZRXGBP',
  'ZRXEUR',
  'ZRXXBT',
]

export const startSubscription = (pairs: IndexedPair[], wsExchange: ccxws.Exchange): void =>
  pairs.forEach(
    pair => (
      wsExchange.subscribeLevel2Snapshots({
        base: pair.baseName,
        id: pair.name,
        quote: pair.quoteName,
        type: 'spot',
      }),
      wsExchange.subscribeLevel2Updates({
        base: pair.baseName,
        id: pair.name,
        quote: pair.quoteName,
        type: 'spot',
      })
    )
  )

export const stopSubscription = (pairs: IndexedPair[], wsExchange: unknown): void =>
  pairs.forEach(
    pair => (
      (wsExchange as ccxws.Exchange).unsubscribeLevel2Snapshots({
        base: pair.baseName,
        id: pair.name,
        quote: pair.quoteName,
        type: 'spot',
      }),
      (wsExchange as ccxws.Exchange).unsubscribeLevel2Updates({
        base: pair.baseName,
        id: pair.name,
        quote: pair.quoteName,
        type: 'spot',
      })
    )
  )

export const createSubscriptionCallback =
  (pairs: IndexedPair[], pairMap: Map<string, number>) =>
  async (snap: ccxws.Level2Data, market: ccxws.Market): Promise<void> => {
    const pairIndex = pairMap.get(market.id)
    if (pairIndex === undefined)
      return Promise.reject(Error(`Invalid pair encountered. ${market.id}`))
    pairs[pairIndex].volume ??= (snap.asks[0]?.count ?? 0) + (snap.bids[0]?.count ?? 0)
    pairs[pairIndex].ask = Number(snap.asks[0]?.price ?? pairs[pairIndex].ask ?? 0)
    pairs[pairIndex].bid = Number(snap.bids[0]?.price ?? pairs[pairIndex].bid ?? 0)
    return
  }

export const getAvailablePairs = async (apiExchange: ccxt.Exchange): Promise<ExchangePair[]> =>
  apiExchange.loadMarkets().then(markets =>
    Object.entries(markets)
      .filter(
        ([, market]) =>
          market.symbol !== undefined &&
          market.active &&
          bannedPairIds.find(id => market.id === id) === undefined
      )
      .map(
        ([, market], index): ExchangePair => ({
          baseName: market.baseId,
          quoteName: market.quoteId,
          index: index,
          name: market.id,
          tradename: market.symbol,
          ordermin: market.limits.amount['min'],
          makerFee: market.maker ?? 0.005,
          takerFee: market.taker ?? 0.005,
          precision: market.precision.amount ?? 8,
          precisionMode: apiExchange.precisionMode,
        })
      )
  )
