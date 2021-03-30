import { ExchangePair, IndexedPair, PairPriceUpdate, PricedPair } from 'exchange-models/exchange'

export let getPairByAssets = (
  first: string,
  second: string,
  pairs: PricedPair[],
  pairLookup: Map<string, number>
): PricedPair => {
  // try first/second else second/first
  let index = pairLookup.get(`${first},${second}`) ?? pairLookup.get(`${second},${first}`)

  // if not found then fail
  if (index === undefined) throw Error(`Invalid pair requested. quote: ${first}, ${second}`)

  // return the lookup value on success
  return pairs[index]
}

export let fastLookup = (
  key: string,
  mapping: Map<string, number>,
  resources: PricedPair[]
): PricedPair => {
  // try to look it up
  let resourceIndex = mapping.get(key)

  // try to resolve the resource from the calculated index
  let resource = resourceIndex !== undefined ? resources[resourceIndex] : null

  // error if the lookup failed
  if (resource === undefined || resource === null) throw Error(`Invalid pair encountered. ${key}`)

  // return the resource on success
  return resource
}

export let updatePair = (
  pairMap: Map<string, number>,
  indexedPairs: PricedPair[],
  pairUpdate: PairPriceUpdate | string
): void => {
  if (typeof pairUpdate === 'string') return
  console.log(pairUpdate)
  let pair = fastLookup(pairUpdate.tradeName!, pairMap, indexedPairs)
  pair.ask = pairUpdate.ask
  pair.bid = pairUpdate.bid
}

export let setupAssetsFromPairs = (pairs: ExchangePair[]): string[] => {
  // add baseName and quoteName as unique items
  return [
    ...pairs.reduce<Set<string>>(
      (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
      new Set()
    ),
  ]
}

export let setupLookupMapFromPairs = (pairs: ExchangePair[]): Map<string, number> => {
  return new Map<string, number>(
    pairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
  )
}

export let setupMapFromPairs = (pairs: ExchangePair[]): Map<string, number> => {
  // create a mapping of pair names -> index for fast lookup
  return new Map<string, number>(pairs.map((pair, index) => [pair.tradename, index]))
}

export let setupPairsWithAssetCodes = (pairs: ExchangePair[], assets: string[]): IndexedPair[] => {
  // for each pair create a new pair with a base and quote index
  let indexedpairs = pairs.map((pair: ExchangePair) => {
    // attempt to get the baseIndex
    let baseIndex = assets.indexOf(pair.baseName)
    if (baseIndex === undefined)
      throw Error(`${pair.baseName}: baseIndex of pair ${pair.index}, ${pair.name} missing`)

    // attempt to get the quoteIndex
    let quoteIndex = assets.indexOf(pair.quoteName)
    if (quoteIndex === undefined)
      throw Error(`${pair.quoteName}: quoteIndex of pair ${pair.index}, ${pair.name} missing`)

    // update the pair with the new values
    return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
  })

  // return as updated pairs with indices
  return indexedpairs
}
