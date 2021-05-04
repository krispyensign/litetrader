import { isError } from './helpers.js'
import type { Recipe, OrderCreateRequest, IndexedPair } from './types/types'

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

const translateSequence = (
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>
): IndexedPair[] =>
  cycle.slice(1).map((value, index) => {
    // try first/second else second/first
    const tempA = assets[cycle[index]]
    const tempB = assets[value]
    const indo = pairMap.get(`${tempA},${tempB}`) ?? pairMap.get(`${tempB},${tempA}`)

    // if not found then fail
    if (indo === undefined) throw Error(`Invalid pair requested. quote: ${tempA}, ${tempB}`)

    // return the lookup value on success
    return pairs[indo]
  })

const createRecipe = (
  initialAmount: number,
  initialAssetIndex: number,
  assets: string[]
): Recipe => ({
  initialAmount: initialAmount,
  initialAssetIndex: initialAssetIndex,
  initialAssetName: assets[initialAssetIndex],
  steps: new Array<OrderCreateRequest>(),
})

export const validateSequence = (asset: number, pairList: IndexedPair[]): IndexedPair[] | Error => {
  for (const pair of pairList) {
    // if there was an issue and the assets were improperly populated
    if (asset !== pair.baseIndex && asset !== pair.quoteIndex)
      return Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [asset, pair.quoteIndex, pair.baseIndex].join(', ')
      )
    else if (asset === pair.baseIndex) asset = pair.quoteIndex
    else asset = pair.baseIndex
  }
  return pairList
}

export const calcProfit = (
  initialAssetIndex: number,
  initialAmount: number,
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  eta: number
): [number, Recipe] | number | Error => {
  // setup a recipe object to return just in case calculation shows profitable
  const recipe = createRecipe(initialAmount, initialAssetIndex, assets)

  // start with initially provided index and amount
  let currentAsset = initialAssetIndex
  let currentAmount = initialAmount

  const pairList = validateSequence(
    initialAssetIndex,
    translateSequence(cycle, assets, pairs, pairMap)
  )
  if (isError(pairList)) return pairList
  for (const pair of pairList) {
    // mark as 0 if processing results in an impossible trade
    currentAmount = currentAmount > pair.ordermin ? currentAmount : 0
    if (currentAmount === 0) break

    // if current exposure is in base asset then create a sell order
    if (currentAsset === pair.baseIndex) {
      // construct a step for the recipe
      const step: OrderCreateRequest = {
        // round to correct units (placing order in base currency units)
        amount: safeRound(currentAmount, pair.decimals),
        // this is a sell
        direction: 'sell',
        event: 'create',
        orderType: 'market',
        pair: pair.tradename,
        price: pair.bid,
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
      const step: OrderCreateRequest = {
        amount: safeRound(
          safeDivide(currentAmount, pair.ask) * (1 + pair.takerFee) * (1 + eta),
          pair.decimals
        ),
        direction: 'buy',
        event: 'create',
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
