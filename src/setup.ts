import type { Dictionary, ExchangePair, IndexedPair } from './types/types'

export const buildGraph = (indexedPairs: IndexedPair[]): Dictionary<number[]> => {
  return indexedPairs.reduce((graph, pair) => {
    if (graph[pair.baseIndex.toString()] === undefined)
      graph[pair.baseIndex.toString()] = new Array<number>()
    graph[pair.baseIndex.toString()].push(pair.quoteIndex)

    if (graph[pair.quoteIndex.toString()] === undefined)
      graph[pair.quoteIndex.toString()] = new Array<number>()
    graph[pair.quoteIndex.toString()].push(pair.baseIndex)

    return graph
  }, {} as Dictionary<number[]>)
}

export const setupData = async (
  getAvailablePairs: (threshold?: number) => Promise<ExchangePair[]>
): Promise<[string[], IndexedPair[], Map<string, number>]> => {
  // get pairs from exchange
  const tradePairs = await getAvailablePairs()

  // extract assets from pairs
  const assets = [
    ...tradePairs.reduce(
      (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
      new Set<string>()
    ),
  ]

  // convert pairs to internal index pair format
  const pairs = tradePairs.map(pair => {
    const baseIndex = assets.indexOf(pair.baseName)
    const quoteIndex = assets.indexOf(pair.quoteName)

    if (baseIndex === -1 || quoteIndex === -1)
      throw Error(`${pair.baseName}: ${baseIndex} / ${pair.quoteName}: ${quoteIndex} missing`)

    // update the pair with the new values
    return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
  })

  // create a mapping of baseNamequoteName and baseName,quoteName
  const pairMap = new Map([
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.tradename, index])),
    ...new Map<string, number>(
      tradePairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
    ),
  ])

  return [assets, pairs, pairMap]
}
