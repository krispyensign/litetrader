import { ExchangeName } from 'exchange-models/exchange'
import { tickSelector } from './helpers'
import { IndexedPair } from './types'

export let buildGraph = (indexedPairs: IndexedPair[]): number[][] => {
  let graph = indexedPairs.reduce((graph, pair) => {
    if (graph[pair.baseIndex] === undefined) graph[pair.baseIndex] = new Array<number>()
    graph[pair.baseIndex].push(pair.quoteIndex)

    if (graph[pair.quoteIndex] === undefined) graph[pair.quoteIndex] = new Array<number>()
    graph[pair.quoteIndex].push(pair.baseIndex)

    return graph
  }, new Array<number[]>())
  return graph
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
    let // attempt to get the baseIndex
      baseIndex = assets.indexOf(pair.baseName),
      quoteIndex = assets.indexOf(pair.quoteName)

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
