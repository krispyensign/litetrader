import type { OrderCreateRequest, IndexedPair } from './types'
import type { GraphWorkerData } from './callbacks'
import { isError } from './helpers.js'

type Steps = Step[] | Error | 0
type CleanSteps = Step[]
type StepSnapshot =
  | {
      steps: CleanSteps
      pair: IndexedPair
      index: number
      amount: number
    }
  | Error
  | 0
type Step = {
  req: OrderCreateRequest
  index: number
  amount: number
}
type PreviousState = {
  steps: Steps
  initialAssetIndex: number
  initialAmount: number
}

const validatePair = (
  steps: CleanSteps,
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
      0
    : { steps: steps, pair: pair, index: state[0], amount: state[1] }

const extractState = (
  gwd: GraphWorkerData,
  ps: PreviousState,
  pairIndex: number | undefined,
  cycle: readonly number[],
  index: number,
  value: number
): StepSnapshot =>
  // skip elements if an error was encountered or is worthless
  isError(ps.steps)
    ? ps.steps
    : ps.steps === 0
    ? ps.steps
    : pairIndex === undefined
    ? Error(`Invalid pair requested. quote: ${gwd.assets[cycle[index]]}, ${gwd.assets[value]}`)
    : validatePair(
        ps.steps,
        ps.steps.length === 0
          ? [ps.initialAssetIndex, ps.initialAmount]
          : [ps.steps[ps.steps.length - 1].index, ps.steps[ps.steps.length - 1].amount],
        gwd.pairs[pairIndex]
      )

const lookup = (
  d: GraphWorkerData,
  cycle: readonly number[],
  index: number,
  value: number
): number | undefined =>
  d.pairMap.get(`${d.assets[cycle[index]]},${d.assets[value]}`) ??
  d.pairMap.get(`${d.assets[value]},${d.assets[cycle[index]]}`)

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
      {
        req: {
          amount: stepAmount,
          direction: 'sell',
          event: 'create',
          orderType: 'market',
          pair: pair.tradename,
          price: pair.bid,
        },

        // change the current asset from the base to the quote
        index: pair.quoteIndex,
        // result amount is in quote currency units
        amount: stepAmount * pair.bid * (1 - pair.takerFee) * (1 - eta),
      }
    : // if current exposure is in quote asset then create a buy order
      {
        req: {
          amount: stepAmount,
          direction: 'buy',
          event: 'create',
          orderType: 'market',
          pair: pair.tradename,
          price: pair.ask,
        },

        // set the current asset to the next base code
        index: pair.baseIndex,
        // calculate the next current amount using the derived price
        amount: stepAmount,
      }

const mutateArray = <T>(t: T[], v: T): T[] => {
  t.push(v)
  return t
}

const constructNextStepInPlace = (state: StepSnapshot, eta: number): Steps =>
  isError(state)
    ? state
    : state === 0
    ? state
    : mutateArray(
        state.steps,
        createStep(
          state.index,
          state.pair,
          calcStepAmount(state.index, state.pair, state.amount, eta),
          eta
        )
      )

export const calcProfit = (d: GraphWorkerData, cycle: readonly number[]): Steps =>
  // start with initially provided index and amount
  cycle.slice(1).reduce<Steps>(
    (steps, element, index) =>
      constructNextStepInPlace(
        extractState(
          d,
          {
            steps: steps,
            initialAssetIndex: d.initialAssetIndex,
            initialAmount: d.initialAmount,
          },
          lookup(d, cycle, index, element),
          cycle,
          index,
          element
        ),
        d.eta
      ),
    []
  )
