import {
  ExchangePair,
  IndexedPair,
  OrderCreateRequest,
  PairPriceUpdate,
  PricedPair,
} from 'exchange-models/exchange'
import { TickerExchangeDriver } from './types'

let getPairByAssets = (
  first: string,
  second: string,
  pairs: PricedPair[],
  pairLookup: Map<string, number>
): PricedPair => {
  // try first/second else second/first
  let index = pairLookup.get(`${first},${second}`) ?? pairLookup.get(`${second},${first}`)

  // if not found then fail
  if (index === undefined) throw Error(`Invalid pair requested. quote: ${first}, ${second}`)

  // return the lookup value on success
  return pairs[index]
}

let fastLookup = (
  key: string,
  mapping: Map<string, number>,
  resources: PricedPair[]
): PricedPair => {
  // try to look it up
  let resourceIndex = mapping.get(key)

  // try to resolve the resource from the calculated index
  let resource = resourceIndex !== undefined ? resources[resourceIndex] : null

  // error if the lookup failed
  if (resource === undefined || resource === null) throw Error(`Invalid pair encountered. ${key}`)

  // return the resource on success
  return resource
}

export let updatePair = (
  pairMap: Map<string, number>,
  indexedPairs: PricedPair[],
  pairUpdate: PairPriceUpdate | string
): void => {
  if (typeof pairUpdate === 'string') return
  console.log(pairUpdate)
  let pair = fastLookup(pairUpdate.tradeName!, pairMap, indexedPairs)
  pair.ask = pairUpdate.ask
  pair.bid = pairUpdate.bid
}

let setupAssetsFromPairs = (pairs: ExchangePair[]): string[] => {
  // add baseName and quoteName as unique items
  return [
    ...pairs.reduce<Set<string>>(
      (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
      new Set()
    ),
  ]
}

let setupLookupMapFromPairs = (pairs: ExchangePair[]): Map<string, number> => {
  return new Map<string, number>(
    pairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
  )
}

let setupMapFromPairs = (pairs: ExchangePair[]): Map<string, number> => {
  // create a mapping of pair names -> index for fast lookup
  return new Map<string, number>(pairs.map((pair, index) => [pair.tradename, index]))
}

let setupPairsWithAssetCodes = (pairs: ExchangePair[], assets: string[]): IndexedPair[] => {
  // for each pair create a new pair with a base and quote index
  let indexedpairs = pairs.map((pair: ExchangePair) => {
    // attempt to get the baseIndex
    let baseIndex = assets.indexOf(pair.baseName)
    if (baseIndex === undefined)
      throw Error(`${pair.baseName}: baseIndex of pair ${pair.index}, ${pair.name} missing`)

    // attempt to get the quoteIndex
    let quoteIndex = assets.indexOf(pair.quoteName)
    if (quoteIndex === undefined)
      throw Error(`${pair.quoteName}: quoteIndex of pair ${pair.index}, ${pair.name} missing`)

    // update the pair with the new values
    return { ...pair, baseIndex: baseIndex, quoteIndex: quoteIndex }
  })

  // return as updated pairs with indices
  return indexedpairs
}

export let setupData = async (
  tickDriver: TickerExchangeDriver
): Promise<[string[], IndexedPair[], Map<string, number>]> => {
  let pairs = await tickDriver.getAvailablePairs()
  let assets = setupAssetsFromPairs(pairs)
  let indexedPairs = setupPairsWithAssetCodes(pairs, assets)
  let pairMap = new Map([
    ...setupMapFromPairs(indexedPairs),
    ...setupLookupMapFromPairs(indexedPairs),
  ])
  return [assets, indexedPairs, pairMap]
}

let safeRound = (num: number, decimals: number): number => {
  return decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))
}

let safeDivide = (numA: number, numB: number): number => {
  return numB !== 0 ? numA / numB : 0
}

let calcProfit = (
  initialAssetIndex: number,
  cycle: string[],
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  initialAmount: number,
  marketOnly: boolean,
  eta: number
): number => {
  let currentAsset = initialAssetIndex
  let currentAmount = initialAmount
  let price = 0
  let first = true
  let pairList = cycle
    .slice(1)
    .map((value, index) =>
      getPairByAssets(assets[Number(cycle[index])], assets[Number(value)], pairs, pairMap)
    )

  // for each trade index of a trade
  for (let pair of pairList) {
    // get the pair associated with the index

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

    let fee = first && !marketOnly ? pair.makerFee : pair.takerFee

    // if current exposure is in base asset then create a sell order
    if (currentAsset === pair.baseIndex) {
      // change the current asset from the base to the quote
      currentAsset = pair.quoteIndex

      // if first then get the ask for a limit order else get the bid for a market
      price = first && !marketOnly ? pair.ask : pair.bid

      // calculate the next current amount using the derived price
      currentAmount = safeRound(currentAmount, pair.decimals) * price * (1 - fee) * (1 - eta)
    }
    // if current exposure is in quote asset then create a buy order
    else {
      // set the current asset to the next base code
      currentAsset = pair.baseIndex

      // if first then get the bid for a limit order else get the ask for a market
      price = first && !marketOnly ? pair.bid : pair.ask

      // calculate the next current amount using the derived price
      currentAmount = safeRound(
        safeDivide(currentAmount, price * (1 + fee) * (1 + eta)),
        pair.decimals
      )
    }

    // no longer first if it was
    first = false
  }

  // return current amount
  return currentAmount
}

interface Recipe {
  initialAmount: number
  initialAssetIndex: number
  initialAssetName: string
  steps: OrderCreateRequest[]
  guardList: string[]
}

let createRecipe = (
  cycle: string[],
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  initialAmount: number
): Recipe => {
  let pairList = cycle
    .slice(1)
    .map((value, index) =>
      getPairByAssets(assets[Number(cycle[index])], assets[Number(value)], pairs, pairMap)
    )

  return {
    initialAmount: initialAmount,
    initialAssetIndex: Number(cycle[0]),
    initialAssetName: assets[Number(cycle[0])],
    steps: pairList.map(
      (pair: PricedPair): OrderCreateRequest => ({
        amount: 0,
        direction: 'buy',
        event: 'create',
        orderId: '0',
        orderType: 'market',
        pair: pair.tradename,
        price: 0,
      })
    ),
    guardList: pairList.map((pair: PricedPair): string => pair.tradename),
  }
}

// calculates if a recipe is profitable or not
let calcAndUpdateRecipe = (
  recipe: Recipe,
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  marketOnly: boolean,
  eta: number
): [number, Recipe] => {
  // initialize everything
  let currentAsset = recipe.initialAssetIndex
  let currentAmount = recipe.initialAmount
  let price = 0
  let first = true

  // for each trade index of a trade
  for (let step of recipe.steps) {
    // get the pair associated with the index
    let pair = fastLookup(step.pair, pairMap, pairs)

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

    // calculate the fee being collected by the exchange
    let fee = first && !marketOnly ? pair.makerFee : pair.takerFee

    // if current exposure is in base asset then create a sell order
    if (currentAsset === pair.baseIndex) {
      // change the current asset from the base to the quote
      currentAsset = pair.quoteIndex

      // if first then get the ask for a limit order else get the bid for a market
      price = first && !marketOnly ? pair.ask : pair.bid

      // round to correct units (placing order in base currency units)
      step.amount = safeRound(currentAmount, pair.decimals)

      // this is a sell
      step.direction = 'sell'

      // calculate the next current amount using the derived price
      // result amount is in quote currency units
      currentAmount = step.amount * price * (1 - fee) * (1 - eta)
    }
    // if current exposure is in quote asset then create a buy order
    else {
      // set the current asset to the next base code
      currentAsset = pair.baseIndex

      // if first then get the bid for a limit order else get the ask for a market
      price = first && !marketOnly ? pair.bid : pair.ask

      // calculate the next current amount using the derived price
      currentAmount = step.amount = safeRound(
        safeDivide(currentAmount, price) * (1 + fee) * (1 + eta),
        pair.decimals
      )

      // this is a buy
      step.direction = 'buy'
    }

    // no longer first if it was
    step.orderType = first ? 'limit' : 'market'
    first = false

    // update the step with the derived price
    step.price = price
  }

  // return current amount
  return [currentAmount, recipe]
}

export let findProfitable = (
  initialAssetIndex: number,
  cycle: string[],
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  initialAmount: number,
  marketOnly: boolean,
  eta: number
): [number, Recipe] | number => {
  // check if the cycle starts with the desired asset
  if (Number(cycle[0]) !== initialAssetIndex) throw Error('Invalid initial asset index')
  // perform calc but don't create a recipe yet
  let amount = calcProfit(
    initialAssetIndex,
    cycle,
    assets,
    pairs,
    pairMap,
    initialAmount,
    marketOnly,
    eta
  )

  // validate profitable and cycle is at least 3 elements long
  if (amount > initialAmount && cycle.length > 2) {
    // create a recipe if profitable
    let recipe: Recipe = createRecipe(cycle, assets, pairs, pairMap, initialAmount)

    // check once more before bombing
    let recalcResult: [number, Recipe] = calcAndUpdateRecipe(recipe, pairs, pairMap, true, eta)
    amount = recalcResult[0]
    recipe = recalcResult[1]
    if (amount > initialAmount) return [amount, recipe]
  }
  return amount
}
