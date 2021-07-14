import * as util from 'util'
let isError = util.types.isNativeError

let mutateStepArray = (t: Step[], v: Step): Steps =>
  t.push(v) > 0 ? t : Error('Failed to expand array.')

// helper function to safely round a number
let safeRound = (num: number, decimals: number): number =>
  decimals === 0 ? Math.floor(num) : Number(num.toFixed(decimals))

// helper function to safely divide by 0
let safeDivide = (numA: number, numB: number): number => (numB !== 0 ? numA / numB : 0)

let safeBid = (sm: StepMaterial): number => (sm.pair.bid ?? 0) * (1 - sm.eta)

let safeAsk = (sm: StepMaterial): number => (sm.pair.ask ?? 0) * (1 + sm.eta)

let buildStep = (sm: StepMaterial): Step =>
  // if current exposure is in base asset then create a sell order else buy order
  sm.index === sm.pair.baseIndex
    ? {
        orderCreateRequest: {
          amount: sm.amount,
          direction: 'sell',
          event: 'create',
          orderType: 'market',
          pair: sm.pair.tradename,
        },
        price: safeBid(sm),
        index: sm.pair.quoteIndex,
        newAmount: sm.amount * (1 - (sm.pair.takerFee ?? 0)) * safeBid(sm),
      }
    : {
        orderCreateRequest: {
          amount: sm.amount,
          direction: 'buy',
          event: 'create',
          orderType: 'market',
          pair: sm.pair.tradename,
        },
        price: safeAsk(sm),
        index: sm.pair.baseIndex,
        newAmount: sm.amount,
      }

let calcStepAmount = (sm: StepMaterial): number =>
  sm.index === sm.pair.baseIndex
    ? safeRound(sm.amount, sm.pair.precision)
    : safeRound(
        safeDivide(sm.amount, (1 + (sm.pair.takerFee ?? 0)) * safeAsk(sm)),
        sm.pair.precision
      )

let buildNextStepInPlace = (ss: StepSnapshot, eta: number): Steps =>
  isError(ss) || ss === 0
    ? ss
    : mutateStepArray(
        ss.steps,
        buildStep({
          index: ss.index,
          pair: ss.pair,
          amount: calcStepAmount({ index: ss.index, pair: ss.pair, amount: ss.amount, eta }),
          eta,
        })
      )

let validatePair = (
  steps: ValidatedSteps,
  [index, amount]: [number, number],
  pair: IndexedPair
): StepSnapshot =>
  index !== pair.quoteIndex && index !== pair.baseIndex
    ? Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [index, pair.quoteIndex, pair.baseIndex].join(', ')
      )
    : amount < pair.ordermin
    ? 0 // mark as worthless if processing results in an impossible trade
    : { steps, pair, index, amount }

let extractState = (gwd: GraphWorkerData, steps: Steps, pairIndex: number | Error): StepSnapshot =>
  isError(steps) || steps === 0 // skip elements if an error was encountered or is worthless
    ? steps
    : isError(pairIndex) // error if pair lookup failed earlier
    ? pairIndex
    : validatePair(
        steps,
        steps.length === 0
          ? [gwd.initialAssetIndex, gwd.initialAmount]
          : [steps[steps.length - 1].index, steps[steps.length - 1].newAmount],
        gwd.pairs[pairIndex]
      )

let lookupPair = (gwd: GraphWorkerData, left: number, right: number): number | Error =>
  gwd.pairMap.get(`${gwd.assets[left]},${gwd.assets[right]}`) ??
  gwd.pairMap.get(`${gwd.assets[right]},${gwd.assets[left]}`) ??
  Error(`Invalid pair requested. quote: ${gwd.assets[left]}, ${gwd.assets[right]}`)

export let calcProfit = (gwd: GraphWorkerData, cycle: readonly number[]): Steps =>
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
