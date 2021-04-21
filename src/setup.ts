import { tickSelector } from './helpers'
import type { Dictionary, ExchangeName, IndexedPair } from './types'

export let buildGraph = (indexedPairs: IndexedPair[]): Dictionary<number[]> => {
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

export let setupData = async (
  exchangeName: ExchangeName
): Promise<[string[], IndexedPair[], Map<string, number>]> => {
  let tick = tickSelector(exchangeName)
  // get pairs from exchange
  let tradePairs = await tick.getAvailablePairs()

  // extract assets from pairs
  let assets = [
    ...tradePairs.reduce(
      (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
      new Set<string>()
    ),
  ]

  // convert pairs to internal index pair format
  let pairs = tradePairs.map(pair => {
    let baseIndex = assets.indexOf(pair.baseName)
    let quoteIndex = assets.indexOf(pair.quoteName)

    if (baseIndex === -1 || quoteIndex === -1)
      throw Error(`${pair.baseName}: ${baseIndex} / ${pair.quoteName}: ${quoteIndex} missing`)

    // update the pair with the new values
    return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
  })
  // create a mapping of baseNamequoteName and baseName,quoteName
  let pairMap = new Map([
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.tradename, index])),
    ...new Map<string, number>(
      tradePairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
    ),
  ])
  return [assets, pairs, pairMap]
}
