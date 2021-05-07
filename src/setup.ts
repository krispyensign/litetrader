/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-expression-statement */
/* eslint-disable functional/no-conditional-statement */
/* eslint-disable functional/prefer-readonly-type */
import type { Dictionary, ExchangePair, IndexedPair } from './types/types'

export const buildGraph = (indexedPairs: readonly IndexedPair[]): Dictionary<readonly number[]> =>
  indexedPairs.reduce((graph, pair) => {
    if (graph[pair.baseIndex.toString()] === undefined)
      graph[pair.baseIndex.toString()] = new Array<number>()
    graph[pair.baseIndex.toString()].push(pair.quoteIndex)

    if (graph[pair.quoteIndex.toString()] === undefined)
      graph[pair.quoteIndex.toString()] = new Array<number>()
    graph[pair.quoteIndex.toString()].push(pair.baseIndex)

    return graph
  }, {} as Dictionary<number[]>)

// export const buildGraphF = (
//   indexedPairs: readonly IndexedPair[]
// ): Dictionary<readonly number[]> => {
//   indexedPairs.reduce(
//     (prev, ip) =>
//       prev.concat([[ip.baseIndex, ip.quoteIndex]]).concat([[ip.quoteIndex, ip.baseIndex]]),
//     new Array<[number, number]>()
//   )
//   return indexedPairs.reduce((graph, pair) => {
//     if (graph[pair.baseIndex.toString()] === undefined)
//       graph[pair.baseIndex.toString()] = new Array<number>()
//     graph[pair.baseIndex.toString()].push(pair.quoteIndex)

//     if (graph[pair.quoteIndex.toString()] === undefined)
//       graph[pair.quoteIndex.toString()] = new Array<number>()
//     graph[pair.quoteIndex.toString()].push(pair.baseIndex)

//     return graph
//   }, {} as Dictionary<number[]>)
// }

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
