import { IndexedPair, TickerExchangeDriver, TradeDatum } from './types'

export let buildGraph = (indexedPairs: IndexedPair[]): number[][] => {
  let graph = indexedPairs.reduce((graph, pair) => {
    if (graph[pair.baseIndex] === undefined)
      graph[pair.baseIndex] = new Array<number>()
    graph[pair.baseIndex].push(pair.quoteIndex)
   
    if (graph[pair.quoteIndex] === undefined)
      graph[pair.quoteIndex] = new Array<number>()
    graph[pair.quoteIndex].push(pair.baseIndex)
    
    return graph
  }, new Array<number[]>())
  return graph
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
