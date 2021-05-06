import type { Recipe, OrderCreateRequest, IndexedPair } from './types/types'

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

// lookup a pair given two elements in a cycle
const lookup = async (
  pairMap: Map<string, number>,
  assets: string[],
  cycle: number[],
  index: number,
  value: number
): Promise<number> =>
  // try first/second else second/first
  pairMap.get(`${assets[cycle[index]]},${assets[value]}`) ??
  pairMap.get(`${assets[value]},${assets[cycle[index]]}`) ??
  // if not found then fail
  Promise.reject(
    new Error(`Invalid pair requested. quote: ${assets[cycle[index]]}, ${assets[value]}`)
  )

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

const isConnected = (asset: number, pair: IndexedPair): number | Promise<never> =>
  asset !== pair.baseIndex && asset !== pair.quoteIndex
    ? Promise.reject(
        new Error(
          'Invalid logic somewhere! Current Tuple State:' +
            [asset, pair.quoteIndex, pair.baseIndex].join(', ')
        )
      )
    : asset

const validateSequence = (asset: number, pairList: IndexedPair[]): IndexedPair[] =>
  pairList.reduce<{ asset: number; pairList: IndexedPair[] }>(
    (tup, pair) => ({
      // if there was an issue and the assets were improperly populated
      asset: isConnected(asset, pair) ? pair.quoteIndex : pair.baseIndex,
      pairList: tup.pairList,
    }),
    { pairList, asset }
  ).pairList

export const calcProfit = async (
  initialAssetIndex: number,
  initialAmount: number,
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  eta: number
): Promise<[number, Recipe] | number | Error> => {
  // setup a recipe object to return just in case calculation shows profitable
  const recipe = createRecipe(initialAmount, initialAssetIndex, assets)

  // start with initially provided index and amount
  let currentAsset = initialAssetIndex
  let currentAmount = initialAmount

  for (const pair of validateSequence(
    initialAssetIndex,
    await Promise.all(
      cycle
        .slice(1)
        .map(async (value, index) => pairs[await lookup(pairMap, assets, cycle, index, value)])
    )
  )) {
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
