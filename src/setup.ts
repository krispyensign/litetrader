import { IndexedPair, Dictionary, TickerExchangeDriver } from './types'

export function buildGraph(indexedPairs: IndexedPair[]): Dictionary<string[]> {
  return indexedPairs.reduce((graph, pair) => {
    if (graph[pair.baseIndex.toString()] === undefined)
      graph[pair.baseIndex.toString()] = new Array<string>(pair.quoteIndex.toString())
    else graph[pair.baseIndex.toString()].push(pair.quoteIndex.toString())
    if (graph[pair.quoteIndex.toString()] === undefined)
      graph[pair.quoteIndex.toString()] = new Array<string>(pair.baseIndex.toString())
    else graph[pair.quoteIndex.toString()].push(pair.baseIndex.toString())
    return graph
  }, {} as Dictionary<string[]>)
}

export async function setupData(
  tickDriver: TickerExchangeDriver
): Promise<[string[], IndexedPair[], Map<string, number>, object, object]> {
  // get pairs from exchange
  const pairs = await tickDriver.getAvailablePairs(),
    // extract assets from pairs
    assets = [
      ...pairs.reduce(
        (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
        new Set<string>()
      ),
    ],
    // convert pairs to internal index pair format
    indexedPairs = pairs.map(pair => {
      // attempt to get the baseIndex
      const baseIndex = assets.indexOf(pair.baseName),
        quoteIndex = assets.indexOf(pair.quoteName)
      if (baseIndex === -1)
        throw Error(`${pair.baseName}: baseIndex of pair ${pair.index}, ${pair.name} missing`)

      // attempt to get the quoteIndex
      if (quoteIndex === -1)
        throw Error(`${pair.quoteName}: quoteIndex of pair ${pair.index}, ${pair.name} missing`)

      // update the pair with the new values
      return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
    }),
    // create a mapping of baseNamequoteName and baseName,quoteName
    pairMap = new Map([
      ...new Map<string, number>(indexedPairs.map((pair, index) => [pair.tradename, index])),
      ...new Map<string, number>(
        indexedPairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
      ),
    ]),
    stopRequest = tickDriver.createStopRequest(pairs.map(p => p.tradename)),
    subRequest = tickDriver.createTickSubRequest(pairs.map(p => p.tradename))

  // return the constructed items
  return [assets, indexedPairs, pairMap, stopRequest, subRequest]
}
