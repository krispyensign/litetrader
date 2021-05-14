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
  orderCreateRequest: OrderCreateRequest
  index: number
  amount: number
}
type PreviousState = {
  steps: Steps
  initialAssetIndex: number
  initialAmount: number
}
type CyclePointer = {
  cycle: readonly number[]
  index: number
  value: number
}
type StepMaterial = {
  index: number
  pair: IndexedPair
  amount: number
  eta: number
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
  cp: CyclePointer
): StepSnapshot =>
  // skip elements if an error was encountered or is worthless
  isError(ps.steps)
    ? ps.steps
    : ps.steps === 0
    ? ps.steps
    : pairIndex === undefined
    ? Error(
        `Invalid pair requested. quote: ${gwd.assets[cp.cycle[cp.index]]}, ${gwd.assets[cp.value]}`
      )
    : validatePair(
        ps.steps,
        ps.steps.length === 0
          ? [ps.initialAssetIndex, ps.initialAmount]
          : [ps.steps[ps.steps.length - 1].index, ps.steps[ps.steps.length - 1].amount],
        gwd.pairs[pairIndex]
      )

const lookup = (d: GraphWorkerData, cp: CyclePointer): number | undefined =>
  d.pairMap.get(`${d.assets[cp.cycle[cp.index]]},${d.assets[cp.value]}`) ??
  d.pairMap.get(`${d.assets[cp.value]},${d.assets[cp.cycle[cp.index]]}`)

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

const calcStepAmount = (sm: StepMaterial): number =>
  sm.index === sm.pair.baseIndex
    ? safeRound(sm.amount, sm.pair.decimals)
    : safeRound(
        safeDivide(sm.amount, sm.pair.ask) * (1 + sm.pair.takerFee) * (1 + sm.eta),
        sm.pair.decimals
      )

const createStep = (sm: StepMaterial): Step =>
  // if current exposure is in base asset then create a sell order
  sm.index === sm.pair.baseIndex
    ? // construct a step for the recipe
      {
        orderCreateRequest: {
          amount: sm.amount,
          direction: 'sell',
          event: 'create',
          orderType: 'market',
          pair: sm.pair.tradename,
          price: sm.pair.bid,
        },

        // change the current asset from the base to the quote
        index: sm.pair.quoteIndex,
        // result amount is in quote currency units
        amount: sm.amount * sm.pair.bid * (1 - sm.pair.takerFee) * (1 - sm.eta),
      }
    : // if current exposure is in quote asset then create a buy order
      {
        orderCreateRequest: {
          amount: sm.amount,
          direction: 'buy',
          event: 'create',
          orderType: 'market',
          pair: sm.pair.tradename,
          price: sm.pair.ask,
        },

        // set the current asset to the next base code
        index: sm.pair.baseIndex,
        // calculate the next current amount using the derived price
        amount: sm.amount,
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
        createStep({
          index: state.index,
          pair: state.pair,
          amount: calcStepAmount({
            index: state.index,
            pair: state.pair,
            amount: state.amount,
            eta: eta,
          }),
          eta: eta,
        })
      )

export const calcProfit = (gwd: GraphWorkerData, cycle: readonly number[]): Steps =>
  // start with initially provided index and amount
  cycle.slice(1).reduce<Steps>(
    (steps, value, index) =>
      constructNextStepInPlace(
        extractState(
          gwd,
          {
            steps: steps,
            initialAssetIndex: gwd.initialAssetIndex,
            initialAmount: gwd.initialAmount,
          },
          lookup(gwd, { cycle, index, value }),
          {
            cycle,
            index,
            value,
          }
        ),
        gwd.eta
      ),
    []
  )
