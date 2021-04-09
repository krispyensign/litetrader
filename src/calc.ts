import {
  TickerExchangeDriver,
  Recipe,
  PricedPair,
  PairPriceUpdate,
  IndexedPair,
  OrderCreateRequest,
  Dictionary,
  OrdersExchangeDriver,
} from './types'
import WebSocket = require('ws')

export async function sleep(timems: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, timems))
}

export function updatePair(pricedPairs: PricedPair[], pairUpdate: PairPriceUpdate | string): void {
  if (typeof pairUpdate === 'string') return
  const pair = pricedPairs.find(i => i.tradename === pairUpdate.tradeName)
  if (pair === undefined) throw Error(`Invalid pair encountered. ${pairUpdate.tradeName}`)
  pair.lastAskPrice = pair.ask
  pair.lastBidPrice = pair.bid
  pair.ask = pairUpdate.ask
  pair.bid = pairUpdate.bid
}

export function buildGraph(indexedPairs: IndexedPair[]): Dictionary<string[]> {
  const graph: Dictionary<string[]> = {}
  for (const pair of indexedPairs) {
    if (graph[pair.baseIndex.toString()] === undefined)
      graph[pair.baseIndex.toString()] = new Array<string>(pair.quoteIndex.toString())
    else graph[pair.baseIndex.toString()].push(pair.quoteIndex.toString())
    if (graph[pair.quoteIndex.toString()] === undefined)
      graph[pair.quoteIndex.toString()] = new Array<string>(pair.baseIndex.toString())
    else graph[pair.quoteIndex.toString()].push(pair.baseIndex.toString())
  }
  return graph
}

export async function setupData(
  tickDriver: TickerExchangeDriver
): Promise<[string[], IndexedPair[], Map<string, number>]> {
  // get pairs from exchange
  const pairs = await tickDriver.getAvailablePairs(),
    // extract assets from pairs
    assets = [
      ...pairs.reduce<Set<string>>(
        (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
        new Set()
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
    ])

  // return the constructed items
  return [assets, indexedPairs, pairMap]
}

// helper function to safely round a number
function safeRound(num: number, decimals: number): number {
  return decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))
}

// helper function to safely divide by 0
function safeDivide(numA: number, numB: number): number {
  return numB !== 0 ? numA / numB : 0
}

export function calcProfit(
  initialAssetIndex: number,
  initialAmount: number,
  cycle: string[],
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  eta: number,
  orderId: string
): [number, Recipe] | number {
  const pairList = cycle.slice(1).map((value, index) => {
      // try first/second else second/first
      const tempA = assets[Number(cycle[index])],
        tempB = assets[Number(value)],
        indo = pairMap.get(`${tempA},${tempB}`) ?? pairMap.get(`${tempB},${tempA}`)

      // if not found then fail
      if (indo === undefined) throw Error(`Invalid pair requested. quote: ${tempA}, ${tempB}`)

      // return the lookup value on success
      return pairs[indo]
    }),
    // setup a recipe object to return just in case calculation shows profitable
    recipe: Recipe = {
      initialAmount: initialAmount,
      initialAssetIndex: initialAssetIndex,
      initialAssetName: assets[initialAssetIndex],
      guardList: pairList.map(p => p.tradename),
      steps: new Array<OrderCreateRequest>(),
    }
  let // start with initially provided index and amount
    currentAsset = initialAssetIndex,
    currentAmount = initialAmount,
    step: OrderCreateRequest

  // for each trade index of a trade
  for (const pair of pairList) {
    // validate the bid and ask are populated by this point
    if (pair.ask === undefined || pair.bid === undefined)
      throw Error('ask bid spread is not defined')

    // if there was an issue and the assets were improperly populated
    if (currentAsset !== pair.baseIndex && currentAsset !== pair.quoteIndex) {
      throw Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [currentAsset, pair.quoteIndex, pair.baseIndex].join(', ')
      )
    }

    // mark as 0 if processing results in an impossible trade
    currentAmount = currentAmount > pair.ordermin ? currentAmount : 0

    // if current exposure is in base asset then create a sell order
    if (currentAsset === pair.baseIndex) {
      // construct a step for the recipe
      step = {
        // round to correct units (placing order in base currency units)
        amount: safeRound(currentAmount, pair.decimals),
        // this is a sell
        direction: 'sell',
        event: 'create',
        orderType: 'market',
        pair: pair.tradename,
        price: pair.bid,
        orderId: orderId,
      }
      recipe.steps.push(step)

      // change the current asset from the base to the quote
      currentAsset = pair.quoteIndex
      // result amount is in quote currency units
      currentAmount = step.amount * pair.bid * (1 - pair.takerFee) * (1 - eta)
    }
    // if current exposure is in quote asset then create a buy order
    else {
      // construct a step for the recipe
      step = {
        amount: safeRound(
          safeDivide(currentAmount, pair.ask) * (1 + pair.takerFee) * (1 + eta),
          pair.decimals
        ),
        direction: 'buy',
        event: 'create',
        orderId: orderId,
        orderType: 'market',
        pair: pair.tradename,
        price: pair.ask,
      }
      recipe.steps.push(step)

      // set the current asset to the next base code
      currentAsset = pair.baseIndex
      // calculate the next current amount using the derived price
      currentAmount = step.amount
    }
  }

  // if profitable return the amount and recipe else just the amount
  // this will cause the recipe to get garbage collected seperately
  if (currentAmount > initialAmount) return [currentAmount, recipe]
  return currentAmount
}

export async function findProfit(
  line: string,
  initialAssetIndex: number,
  initialAmount: number,
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  eta: number,
  orderws: WebSocket,
  token: string,
  order: OrdersExchangeDriver
): Promise<void> {
  // split a string 1,2,3,... into [1, 2, 3, ...]
  const cycle = line.split(',')

  // can only trade the approved asset
  if (Number(cycle[0]) !== initialAssetIndex) return

  // cannot hedge so skip anything less than 4
  if (cycle.length < 4) return

  // calc profit, hopefully something good is found
  const result = calcProfit(
    initialAssetIndex,
    initialAmount,
    cycle,
    assets,
    pairs,
    pairMap,
    eta,
    '0'
  )

  // if not just an amount and is a cycle then do stuff
  if (typeof result !== 'number') {
    const [, recipe] = result
    console.log(recipe.steps)
    console.profile('send')
    for (const step of recipe.steps) {
      orderws.send(order.createOrderRequest(token, step))
      await sleep(2)
    }
    console.profileEnd('send')
  }
}
