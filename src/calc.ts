import type {
  ExchangePair,
  IndexedPair,
  OrderCreateRequest,
  PairPriceUpdate,
  PricedPair,
} from 'exchange-models/exchange'
import type { TickerExchangeDriver, Recipe } from './types'

export let updatePair = (
  indexedPairs: PricedPair[],
  pairUpdate: PairPriceUpdate | string
): void => {
  if (typeof pairUpdate === 'string') return
  let pair = indexedPairs.find(i => i.tradename === pairUpdate.tradeName)
  if (pair === undefined) throw Error(`Invalid pair encountered. ${pairUpdate.tradeName}`)
  pair.ask = pairUpdate.ask
  pair.bid = pairUpdate.bid
}

export let setupData = async (
  tickDriver: TickerExchangeDriver
): Promise<[string[], IndexedPair[], Map<string, number>]> => {
  let pairs = await tickDriver.getAvailablePairs()
  let assets = [
    ...pairs.reduce<Set<string>>(
      (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
      new Set()
    ),
  ]
  let indexedPairs = pairs.map((pair: ExchangePair) => {
    // attempt to get the baseIndex
    let baseIndex = assets.indexOf(pair.baseName)
    if (baseIndex === -1)
      throw Error(`${pair.baseName}: baseIndex of pair ${pair.index}, ${pair.name} missing`)

    // attempt to get the quoteIndex
    let quoteIndex = assets.indexOf(pair.quoteName)
    if (quoteIndex === -1)
      throw Error(`${pair.quoteName}: quoteIndex of pair ${pair.index}, ${pair.name} missing`)

    // update the pair with the new values
    return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
  })
  let pairMap = new Map([
    ...new Map<string, number>(indexedPairs.map((pair, index) => [pair.tradename, index])),
    ...new Map<string, number>(
      indexedPairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
    ),
  ])
  return [assets, indexedPairs, pairMap]
}

let safeRound = (num: number, decimals: number): number => {
  return decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))
}

let safeDivide = (numA: number, numB: number): number => {
  return numB !== 0 ? numA / numB : 0
}

export let calcProfit = (
  initialAssetIndex: number,
  initialAmount: number,
  cycle: string[],
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  eta: number,
  orderId: string
): [number, Recipe] | number => {
  // initialize everything
  let pairList = cycle.slice(1).map((value, index) => {
    // try first/second else second/first
    let tempA = assets[Number(cycle[index])]
    let tempB = assets[Number(value)]
    let indo = pairMap.get(`${tempA},${tempB}`) ?? pairMap.get(`${tempB},${tempA}`)

    // if not found then fail
    if (indo === undefined) throw Error(`Invalid pair requested. quote: ${tempA}, ${tempB}`)

    // return the lookup value on success
    return pairs[indo]
  })

  let recipe: Recipe = {
    initialAmount: initialAmount,
    initialAssetIndex: initialAssetIndex,
    initialAssetName: assets[initialAssetIndex],
    guardList: pairList.map(p => p.tradename),
    steps: new Array<OrderCreateRequest>(),
  }
  let currentAsset = initialAssetIndex
  let currentAmount = initialAmount

  // for each trade index of a trade
  for (let pair of pairList) {
    // validate the bid and ask are populated by this point
    if (pair.ask === undefined || pair.bid === undefined)
      throw Error('ask bid spread is not defined')

    // if there was an issue and the assets were improperly populated
    if (currentAsset !== pair.baseIndex && currentAsset !== pair.quoteIndex) {
      throw Error(
        'ERROR: Invalid logic somewhere! CurrentAsset' +
          currentAsset +
          ',' +
          pair.quoteIndex +
          ':' +
          pair.baseIndex
      )
    }

    // mark as 0 if processing results in an impossible trade
    currentAmount = currentAmount > pair.ordermin ? currentAmount : 0

    // if current exposure is in base asset then create a sell order
    if (currentAsset === pair.baseIndex) {
      let step: OrderCreateRequest = {
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
      let step: OrderCreateRequest = {
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
