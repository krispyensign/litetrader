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

export const getExchangeApi = async (exchangeName: ExchangeName): Promise<ccxt.Exchange> =>
  exchangeName === 'kraken'
    ? new ccxt.kraken()
    : exchangeName === 'coinbase'
    ? new ccxt.coinbase()
    : Promise.reject(Error('unknown exchange ' + exchangeName))

export const getExchangeWs = async (exchangeName: ExchangeName): Promise<ccxws.Exchange> =>
  exchangeName === 'kraken'
    ? new ccxws.Kraken()
    : exchangeName === 'coinbase'
    ? new ccxws.CoinbasePro()
    : Promise.reject(Error('unknown exchange ' + exchangeName))

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

export const createSnapshotCallback =
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
          ordermin: market.limits.amount['min'] ?? Number(market.info?.['min_size'] ?? 0),
          makerFee: market.maker ?? 0.005,
          takerFee: market.taker ?? 0.005,
          precision: market.precision.amount ?? 8,
          precisionMode: apiExchange.precisionMode,
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

const getIndex = async (initialAssetIndexF: number, initialAsset: string): Promise<number> =>
  initialAssetIndexF === -1
    ? Promise.reject(Error(`invalid asset ${initialAsset}`))
    : Promise.resolve(initialAssetIndexF)

// validate initialasset before continuing
const getInitialAssetIndex = async (assets: string[], initialAsset: string): Promise<number> =>
  await getIndex(
    assets.findIndex(a => a === initialAsset),
    initialAsset
  )

export const setupData = async (
  tradePairs: ExchangePair[],
  initialAsset: string
): Promise<[readonly string[], IndexedPair[], Map<string, number>, number]> => [
  buildAssets(tradePairs),
  buildIndexedPairs(tradePairs, buildAssets(tradePairs)),
  buildPairMap(tradePairs),
  await getInitialAssetIndex(buildAssets(tradePairs), initialAsset),
]
