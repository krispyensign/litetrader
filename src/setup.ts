import { IndexedPair, Dictionary, TickerExchangeDriver, TradeDatum } from './types'

export let buildGraph = (indexedPairs: IndexedPair[]): Dictionary<string[]> => {
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

export let setupData = async (tickDriver: TickerExchangeDriver): Promise<TradeDatum> => {
  // get pairs from exchange
  let pairs = await tickDriver.getAvailablePairs()

  // extract assets from pairs
  let assets = [
    ...pairs.reduce((prev, pair) => prev.add(pair.baseName).add(pair.quoteName), new Set<string>()),
  ]

  return {
    assets: assets,
    // convert pairs to internal index pair format
    pairs: pairs.map(pair => {
      let // attempt to get the baseIndex
        baseIndex = assets.indexOf(pair.baseName),
        quoteIndex = assets.indexOf(pair.quoteName)

      if (baseIndex === -1 || quoteIndex === -1)
        throw Error(`${pair.baseName}: ${baseIndex} / ${pair.quoteName}: ${quoteIndex} missing`)

      // update the pair with the new values
      return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
    }),
    // create a mapping of baseNamequoteName and baseName,quoteName
    pairMap: new Map([
      ...new Map<string, number>(pairs.map((pair, index) => [pair.tradename, index])),
      ...new Map<string, number>(
        pairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
      ),
    ]),
    unSubRequest: tickDriver.createStopRequest(pairs.map(p => p.tradename)),
    subRequest: tickDriver.createTickSubRequest(pairs.map(p => p.tradename)),
  }
}
