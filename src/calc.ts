import type { Recipe, OrderCreateRequest, IndexedPair } from './types/types'

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

// try first/second else second/first fail if nothing found
const lookup = async (
  pairMap: Map<string, number>,
  assetA: string,
  assetB: string
): Promise<number> =>
  pairMap.get(`${assetA},${assetB}`) ??
  pairMap.get(`${assetB},${assetA}`) ??
  Promise.reject(new Error(`Invalid pair requested. quote: ${assetA}, ${assetB}`))

// if there was an issue and the assets were improperly populated
const validatePair = async (
  pair: IndexedPair,
  currentAsset: number
): Promise<[IndexedPair, number]> =>
  // if the current asset does not match either the quote or base of the next pair then error
  currentAsset !== pair.baseIndex && currentAsset !== pair.quoteIndex
    ? Promise.reject(
        new Error(
          'Invalid logic somewhere! Current Tuple State:' +
            [currentAsset, pair.quoteIndex, pair.baseIndex].join(', ')
        )
      )
    : // else determine which one matches
    currentAsset === pair.baseIndex
    ? // if base then quote
      [pair, pair.quoteIndex]
    : // if quote then base
      [pair, pair.baseIndex]

// given a sequence of numbers that form a cycle, recover the sequence of pairs
const translateSequence = async (
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  asset: number
): Promise<IndexedPair[]> =>
  (
    await cycle
      // skip the first element
      .slice(1)
      // sequentially resolve the pairs
      .reduce(
        async (prev, value, index, arr) =>
          (await prev).concat([
            await validatePair(
              // get the next pair to be validated
              pairs[await lookup(pairMap, assets[cycle[index]], assets[value])],
              // get the previous asset index as the new current index
              index === 0 ? asset : arr[index - 1]
            ),
          ]),
        Promise.resolve(new Array<[IndexedPair, number]>())
      )
  )

    // recover just the pairs and discard the assets
    .map(q => q[0])

// create an empty recipe
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

const considerBase = (
  pair: IndexedPair,
  stepAmount: number,
  eta: number
): [OrderCreateRequest, number, number] => [
  // construct a step for the recipe
  {
    // round to correct units (placing order in base currency units)
    amount: stepAmount,
    // this is a sell
    direction: 'sell',
    event: 'create',
    orderType: 'market',
    pair: pair.tradename,
    price: pair.bid,
  },
  // change the current asset from the base to the quote
  pair.quoteIndex,
  // result amount is in quote currency units
  stepAmount * pair.bid * (1 - pair.takerFee) * (1 - eta),
]

const considerQuote = (
  pair: IndexedPair,
  stepAmount: number
): [OrderCreateRequest, number, number] => [
  // construct a step for the recipe
  {
    amount: stepAmount,
    direction: 'buy',
    event: 'create',
    orderType: 'market',
    pair: pair.tradename,
    price: pair.ask,
  },

  // set the current asset to the next base code
  pair.baseIndex,
  // calculate the next current amount using the derived price
  stepAmount,
]

export const calcProfit = async (
  initialAssetIndex: number,
  initialAmount: number,
  cycle: number[],
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  eta: number
): Promise<[number, Recipe] | number> => {
  // setup a recipe object to return just in case calculation shows profitable
  const recipe = createRecipe(initialAmount, initialAssetIndex, assets)

  // start with initially provided index and amount
  let currentAsset = initialAssetIndex
  let currentAmount = initialAmount
  let step: OrderCreateRequest

  for (const pair of await translateSequence(cycle, assets, pairs, pairMap, initialAssetIndex)) {
    // mark as 0 if processing results in an impossible trade
    currentAmount = currentAmount > pair.ordermin ? currentAmount : 0
    if (currentAmount === 0) break
    ;[step, currentAsset, currentAmount] =
      currentAsset === pair.baseIndex
        ? // if current exposure is in base asset then create a sell order
          considerBase(pair, safeRound(currentAmount, pair.decimals), eta)
        : // if current exposure is in quote asset then create a buy order
          considerQuote(
            pair,
            safeRound(
              safeDivide(currentAmount, pair.ask) * (1 + pair.takerFee) * (1 + eta),
              pair.decimals
            )
          )
    recipe.steps.push(step)
  }

  // if profitable return the amount and recipe else just the amount
  // this will cause the recipe to get garbage collected seperately
  if (currentAmount > initialAmount) return [currentAmount, recipe]
  return currentAmount
}
