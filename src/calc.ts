import type { OrderCreateRequest, IndexedPair } from './types'
import type { GraphWorkerData } from './callbacks'
import { isError } from './helpers.js'

type Steps = Step[] | Error | 'worthless'
type CleanSteps = Step[]
type StepSnapshot = readonly [CleanSteps, IndexedPair, number, number] | Error | 'worthless'
type Step = [OrderCreateRequest, number, number]

const validatePair = (
  prev: CleanSteps,
  state: [number, number],
  pair: IndexedPair | Error
): StepSnapshot =>
  isError(pair)
    ? pair
    : state[0] !== pair.quoteIndex && state[0] !== pair.baseIndex
    ? Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [state[0], pair.quoteIndex, pair.baseIndex].join(', ')
      )
    : state[1] < pair.ordermin
    ? // mark as worthless if processing results in an impossible trade
      'worthless'
    : [prev, pair, ...state]

const extractState = (
  prev: Steps,
  initialAssetIndex: number,
  initialAmount: number,
  pair: IndexedPair | Error
): StepSnapshot =>
  // skip elements if an error was encountered or is worthless
  isError(prev)
    ? prev
    : prev === 'worthless'
    ? prev
    : validatePair(
        prev,
        prev.length === 0
          ? [initialAssetIndex, initialAmount]
          : [prev[prev.length - 1][1], prev[prev.length - 1][2]],
        pair
      )

const lookup = (
  d: GraphWorkerData,
  cycle: readonly number[],
  index: number,
  value: number
): IndexedPair | Error => {
  const indo =
    d.pairMap.get(`${d.assets[cycle[index]]},${d.assets[value]}`) ??
    d.pairMap.get(`${d.assets[value]},${d.assets[cycle[index]]}`)
  return indo === undefined
    ? Error(`Invalid pair requested. quote: ${d.assets[cycle[index]]}, ${d.assets[value]}`)
    : d.pairs[indo]
}

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

const calcStepAmount = (
  currentAsset: number,
  pair: IndexedPair,
  currentAmount: number,
  eta: number
): number =>
  currentAsset === pair.baseIndex
    ? safeRound(currentAmount, pair.decimals)
    : safeRound(
        safeDivide(currentAmount, pair.ask) * (1 + pair.takerFee) * (1 + eta),
        pair.decimals
      )

const createStep = (
  currentAsset: number,
  pair: IndexedPair,
  stepAmount: number,
  eta: number
): Step =>
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

export const calcProfit = (d: GraphWorkerData, cycle: readonly number[]): Steps =>
  // start with initially provided index and amount
  cycle.slice(1).reduce<Steps>((prev, element, index) => {
    const state = extractState(
      prev,
      d.initialAssetIndex,
      d.initialAmount,
      lookup(d, cycle, index, element)
    )
    if (isError(state) || state === 'worthless') return state
    const [prev2, pair, currentAsset, currentAmount] = state

    prev2.push(
      createStep(
        currentAsset,
        pair,
        calcStepAmount(currentAsset, pair, currentAmount, d.eta),
        d.eta
      )
    )
    return prev
  }, [])
