import type { Dictionary, ExchangePair, IndexedPair } from './types'

export const buildGraph = (indexedPairs: readonly IndexedPair[]): Dictionary<readonly number[]> =>
  Object.fromEntries(
    indexedPairs

      // create edge list
      .reduce(
        (prev, ip) =>
          prev.concat([[ip.baseIndex, ip.quoteIndex]]).concat([[ip.quoteIndex, ip.baseIndex]]),
        new Array<readonly [number, number]>()
      )
      // create adjacency map from edge list
      .reduce(
        (nbrMap, edge) =>
          nbrMap.has(edge[0].toString())
            ? nbrMap.set(edge[0].toString(), nbrMap.get(edge[0].toString())!.concat(edge[1]))
            : nbrMap.set(edge[0].toString(), [edge[1]]),
        new Map<string, readonly number[]>()
      )
  )

const validateTradePairs = async (
  tradePairs: readonly ExchangePair[],
  assets: readonly string[]
): Promise<readonly ExchangePair[]> => {
  const missingPair = tradePairs.find(
    pair => assets.indexOf(pair.baseName) === -1 || assets.indexOf(pair.quoteName) === -1
  )

  return missingPair !== undefined
    ? Promise.reject(
        new Error(
          `${missingPair.baseName}: ${assets.indexOf(missingPair.baseName)} / ${
            missingPair.quoteName
          }: ${assets.indexOf(missingPair.quoteName)} missing`
        )
      )
    : tradePairs
}

export const setupData = async (
  getAvailablePairs: (threshold?: number) => Promise<readonly ExchangePair[]>
): Promise<[readonly string[], IndexedPair[], Map<string, number>]> => {
  // get pairs from exchange
  const tradePairs = await getAvailablePairs()

  // extract assets from pairs
  const assets = [
    ...tradePairs.reduce(
      (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
      new Set<string>()
    ),
  ]

  // validate then convert pairs to internal index pair format
  // update the pair with the new values
  const pairs = (await validateTradePairs(tradePairs, assets)).map(pair => ({
    ...pair,
    baseIndex: assets.indexOf(pair.baseName),
    quoteIndex: assets.indexOf(pair.quoteName),
  }))

  // create a mapping of baseNamequoteName and baseName,quoteName
  const pairMap = new Map([
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.tradename, index])),
    ...new Map<string, number>(
      tradePairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
    ),
  ])

  return [assets, pairs, pairMap]
}
