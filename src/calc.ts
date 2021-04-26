import type { Recipe, OrderCreateRequest, IndexedPair } from './types/types'

// helper function to safely round a number
let safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
let safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

let translateSequence = (
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>
): IndexedPair[] =>
  cycle.slice(1).map((value, index) => {
    // try first/second else second/first
    let tempA = assets[cycle[index]]
    let tempB = assets[value]
    let indo = pairMap.get(`${tempA},${tempB}`) ?? pairMap.get(`${tempB},${tempA}`)

    // if not found then fail
    if (indo === undefined) throw Error(`Invalid pair requested. quote: ${tempA}, ${tempB}`)

    // return the lookup value on success
    return pairs[indo]
  })

let createRecipe = (
  initialAmount: number,
  initialAssetIndex: number,
  assets: string[]
): Recipe => ({
  initialAmount: initialAmount,
  initialAssetIndex: initialAssetIndex,
  initialAssetName: assets[initialAssetIndex],
  steps: new Array<OrderCreateRequest>(),
})

export let calcProfit = (
  initialAssetIndex: number,
  initialAmount: number,
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  eta: number,
  orderId: string
): [number, Recipe] | number => {
  // setup a recipe object to return just in case calculation shows profitable
  let recipe = createRecipe(initialAmount, initialAssetIndex, assets)

  // start with initially provided index and amount
  let currentAsset = initialAssetIndex
  let currentAmount = initialAmount

  let pairList = translateSequence(cycle, assets, pairs, pairMap)
  for (let pair of pairList) {
    // if there was an issue and the assets were improperly populated
    if (currentAsset !== pair.baseIndex && currentAsset !== pair.quoteIndex)
      throw Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [currentAsset, pair.quoteIndex, pair.baseIndex].join(', ')
      )

    // mark as 0 if processing results in an impossible trade
    currentAmount = currentAmount > pair.ordermin ? currentAmount : 0

    if (currentAmount === 0) break

    // if current exposure is in base asset then create a sell order
    if (currentAsset === pair.baseIndex) {
      // construct a step for the recipe
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
      // construct a step for the recipe
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
