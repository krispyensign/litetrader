import { calcProfit, updatePair } from './calc'
import { Config, Connections, IndexedPair, OrdersExchangeDriver, TickerExchangeDriver, TradeDatum } from './types'
import WebSocket = require('ws')

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export let constructTickCallback = (tradeDatum: TradeDatum, tick: TickerExchangeDriver) => {
  return (x: WebSocket.MessageEvent): void => {
    return updatePair(tradeDatum.pairMap, tradeDatum.pairs, tick.parseTick(x.toLocaleString()))
  }
}

let setBool = (bool: Boolean, newVal: boolean): Boolean => {
  bool.valueOf = (): boolean => newVal
  return bool
}

export let constructShutdownCallback = (
  connections: Connections,
  tradeDatum: TradeDatum,
  isUnsubscribe: Boolean
) => {
  return (): void => {
    // only run once
    if (isUnsubscribe.valueOf()) return
    setBool(isUnsubscribe, true)

    // unsubsribe from everything
    connections.tickws.send(JSON.stringify(tradeDatum.unSubRequest))

    // kill the connections ( will also kill detached threads and thus the app )
    connections.tickws.close()
    connections.orderws.close()
    connections.worker.close()
    console.log('shutdown complete')
  }
}

export let constructGraphCallback = (
  initialAssetIndex: number,
  config: Config,
  tradeDatum: TradeDatum,
  isSending: Boolean,
  conns: Connections,
  order: OrdersExchangeDriver,
  token: string
) => {
  return async (cycleData: string): Promise<void> => {
    console.log('Graph callback called')
    console.log(typeof cycleData === 'string')
    let cycle = JSON.parse(cycleData)
    console.log(cycle)
    // calc profit, hopefully something good is found
    let result = calcProfit(
      initialAssetIndex,
      config.initialAmount,
      cycle,
      tradeDatum.assets,
      tradeDatum.pairs,
      tradeDatum.pairMap,
      config.eta,
      '0'
    )

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      if (isSending) {
        console.log('blocked send while already sending')
        return
      }
      setBool(isSending, true)
      console.time('send')
      let [amount, recipe] = result
      console.log(`amounts: ${config.initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      for (let step of recipe.steps) {
        conns.orderws.send(order.createOrderRequest(token, step))
        await sleep(2)
      }
      console.timeEnd('send')
      setBool(isSending, false)
    }
  }
}

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
