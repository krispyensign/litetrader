import ccxt from 'ccxt'
import ccxws from 'ccxws'
import * as bannedConfig from './../lib/bannedPairs.json'
export { startSubscription, stopSubscription, getAvailablePairs }

let createSubscriptionCallback =
  (pairs: IndexedPair[], pairMap: Map<string, number>) =>
  async (snap: ccxws.Level2Data, market: ccxws.Market): Promise<void> => {
    let pairIndex = pairMap.get(market.id)
    if (pairIndex === undefined)
      return Promise.reject(Error(`Invalid pair encountered. ${market.id}`))
    pairs[pairIndex].volume ??= (snap.asks[0]?.count ?? 0) + (snap.bids[0]?.count ?? 0)
    pairs[pairIndex].ask = Number(snap.asks[0]?.price ?? pairs[pairIndex].ask ?? 0)
    pairs[pairIndex].bid = Number(snap.bids[0]?.price ?? pairs[pairIndex].bid ?? 0)
    // console.log({ id: pairs[pairIndex].name, a: pairs[pairIndex].ask, b: pairs[pairIndex].bid })
  }

let startSubscription = async (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  wsExchange: unknown
): Promise<unknown> => {
  let ex: ccxws.Exchange = wsExchange as ccxws.Exchange
  ex.on('l2snapshot', createSubscriptionCallback(pairs, pairMap))
  ex.on('l2update', createSubscriptionCallback(pairs, pairMap))
  pairs.forEach(
    pair => (
      ex.subscribeLevel2Snapshots({
        base: pair.baseName,
        id: pair.name,
        quote: pair.quoteName,
        type: 'spot',
      }),
      ex.subscribeLevel2Updates({
        base: pair.baseName,
        id: pair.name,
        quote: pair.quoteName,
        type: 'spot',
      })
    )
  )
  return wsExchange
}

let stopSubscription = (pairs: IndexedPair[], wsExchange: unknown): void =>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let getAvailablePairs = async (apiExchange: unknown, _key: Key): Promise<ExchangePair[]> =>
  (apiExchange as ccxt.Exchange).loadMarkets().then(markets =>
    Object.entries(markets)
      .filter(
        ([, market]) =>
          market.symbol !== undefined &&
          market.active &&
          bannedConfig.pairs.find(id => market.id === id) === undefined
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
          precisionMode: (apiExchange as ccxt.Exchange).precisionMode,
        })
      )
  )
