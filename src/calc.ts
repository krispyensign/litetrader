import type { IndexedPair, Step, StepMaterial, Steps, StepSnapshot, ValidatedSteps } from './types'
import type { GraphWorkerData } from './callbacks'
import { isError } from './helpers.js'

const validatePair = (
  steps: ValidatedSteps,
  [index, amount]: [number, number],
  pair: IndexedPair | Error
): StepSnapshot =>
  isError(pair)
    ? pair
    : index !== pair.quoteIndex && index !== pair.baseIndex
    ? Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [index, pair.quoteIndex, pair.baseIndex].join(', ')
      )
    : amount < pair.ordermin
    ? 0 // mark as worthless if processing results in an impossible trade
    : { steps, pair, index, amount }

const extractState = (
  gwd: GraphWorkerData,
  steps: Steps,
  pairIndex: number | Error
): StepSnapshot =>
  isError(steps) || steps === 0 // skip elements if an error was encountered or is worthless
    ? steps
    : isError(pairIndex) // error if pair lookup failed earlier
    ? pairIndex
    : validatePair(
        steps,
        steps.length === 0
          ? [gwd.initialAssetIndex, gwd.initialAmount]
          : [steps[steps.length - 1].index, steps[steps.length - 1].amount],
        gwd.pairs[pairIndex]
      )

const lookupPair = (gwd: GraphWorkerData, left: number, right: number): number | Error =>
  gwd.pairMap.get(`${gwd.assets[left]},${gwd.assets[right]}`) ??
  gwd.pairMap.get(`${gwd.assets[right]},${gwd.assets[left]}`) ??
  Error(`Invalid pair requested. quote: ${gwd.assets[left]}, ${gwd.assets[right]}`)

const mutateArray = <T>(t: T[], v: T): T[] | Error =>
  t.push(v) > 0 ? t : Error('Failed to expand array.')

// helper function to safely round a number
const safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.floor(num) : Number(num.toFixed(decimals))

// helper function to safely divide by 0
const safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

const calcStepAmount = (sm: StepMaterial): number =>
  sm.index === sm.pair.baseIndex
    ? safeRound(sm.amount, sm.pair.precision)
    : safeRound(
        safeDivide(sm.amount, sm.pair.ask * (1 + sm.pair.takerFee) * (1 + sm.eta)),
        sm.pair.precision
      )

const buildStep = (sm: StepMaterial): Step =>
  // if current exposure is in base asset then create a sell order else buy order
  sm.index === sm.pair.baseIndex
    ? {
        orderCreateRequest: {
          amount: sm.amount,
          direction: 'sell',
          event: 'create',
          orderType: 'market',
          pair: sm.pair.tradename,
          price: sm.pair.bid,
        },

        index: sm.pair.quoteIndex,
        amount: sm.amount * sm.pair.bid * (1 - sm.pair.takerFee) * (1 - sm.eta),
      }
    : {
        orderCreateRequest: {
          amount: sm.amount,
          direction: 'buy',
          event: 'create',
          orderType: 'market',
          pair: sm.pair.tradename,
          price: sm.pair.ask,
        },

        index: sm.pair.baseIndex,
        amount: sm.amount,
      }

const buildNextStepInPlace = (ss: StepSnapshot, eta: number): Steps =>
  isError(ss) || ss === 0
    ? ss
    : mutateArray(
        ss.steps,
        buildStep({
          index: ss.index,
          pair: ss.pair,
          amount: calcStepAmount({ index: ss.index, pair: ss.pair, amount: ss.amount, eta }),
          eta,
        })
      )

export const calcProfit = (gwd: GraphWorkerData, cycle: readonly number[]): Steps =>
  cycle
    .slice(1)
    .reduce<Steps>(
      (steps, value, index) =>
        buildNextStepInPlace(
          extractState(gwd, steps, lookupPair(gwd, cycle[index], value)),
          gwd.eta
        ),
      []
    )
