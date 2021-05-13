import type { OrderCreateRequest, IndexedPair } from './types/types'
import { isError } from './helpers.js'

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

const hasValue = (currentAmount: number, ordermin: number): number =>
  (currentAmount = currentAmount > ordermin ? currentAmount : 0)

const lookup = (
  assets: readonly string[],
  cycle: readonly number[],
  pairMap: ReadonlyMap<string, number>,
  pairs: readonly IndexedPair[],
  index: number,
  value: number
): IndexedPair | Error => {
  const indo =
    pairMap.get(`${assets[cycle[index]]},${assets[value]}`) ??
    pairMap.get(`${assets[value]},${assets[cycle[index]]}`)
  return indo === undefined
    ? Error(`Invalid pair requested. quote: ${assets[cycle[index]]}, ${assets[value]}`)
    : pairs[indo]
}

const createStep = (
  currentAsset: number,
  pair: IndexedPair,
  stepAmount: number,
  eta: number
): [OrderCreateRequest, number, number] =>
  // if current exposure is in base asset then create a sell order
  currentAsset === pair.baseIndex
    ? // construct a step for the recipe
      [
        {
          amount: stepAmount,
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
    : // if current exposure is in quote asset then create a buy order
      [
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

const calcStepAmount = (
  currentAsset: number,
  pair: IndexedPair,
  currentAmount: number,
  eta: number
): number | Error =>
  currentAsset === pair.baseIndex
    ? safeRound(currentAmount, pair.decimals)
    : currentAsset === pair.quoteIndex
    ? safeRound(
        safeDivide(currentAmount, pair.ask) * (1 + pair.takerFee) * (1 + eta),
        pair.decimals
      )
    : Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [currentAsset, pair.quoteIndex, pair.baseIndex].join(', ')
      )

const extractState = (
  prev: [OrderCreateRequest, number, number][],
  initialAssetIndex: number,
  initialAmount: number
): [number, number] =>
  prev.length === 0
    ? [initialAssetIndex, initialAmount]
    : [prev[prev.length - 1][1], prev[prev.length - 1][2]]

export const calcProfit = (
  initialAssetIndex: number,
  initialAmount: number,
  cycle: readonly number[],
  assets: readonly string[],
  pairs: IndexedPair[],
  pairMap: ReadonlyMap<string, number>,
  eta: number
): readonly [OrderCreateRequest, number, number][] | Error | 'worthless' =>
  // start with initially provided index and amount
  cycle
    .slice(1)
    .reduce<[OrderCreateRequest, number, number][] | Error | 'worthless'>(
      (prev, element, index) => {
        if (isError(prev)) return prev
        if (prev === 'worthless') return prev

        const pair = lookup(assets, cycle, pairMap, pairs, index, element)
        if (isError(pair)) return pair

        const [currentAsset, currentAmount] = extractState(prev, initialAssetIndex, initialAmount)

        // mark as 0 if processing results in an impossible trade
        if (hasValue(currentAmount, pair.ordermin) === 0) return 'worthless'

        const stepAmount = calcStepAmount(currentAsset, pair, currentAmount, eta)
        if (isError(stepAmount)) return stepAmount

        // const prestep =  createStep(currentAsset, pair, )
        prev.push(createStep(currentAsset, pair, stepAmount, eta))
        return prev
      },
      new Array<[OrderCreateRequest, number, number]>()
    )
