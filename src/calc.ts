import type { Recipe, PricedPair, PairPriceUpdate, OrderCreateRequest } from './types'

export function updatePair(pricedPairs: PricedPair[], pairUpdate: PairPriceUpdate | string): void {
  if (typeof pairUpdate === 'string') return
  const pair = pricedPairs.find(i => i.tradename === pairUpdate.tradeName)
  if (pair === undefined) throw Error(`Invalid pair encountered. ${pairUpdate.tradeName}`)
  pair.lastAskPrice = pair.ask
  pair.lastBidPrice = pair.bid
  pair.ask = pairUpdate.ask
  pair.bid = pairUpdate.bid
}

// helper function to safely round a number
function safeRound(num: number, decimals: number): number {
  return decimals === 0 ? Math.round(num) : Number(num.toPrecision(decimals))
}

// helper function to safely divide by 0
function safeDivide(numA: number, numB: number): number {
  return numB !== 0 ? numA / numB : 0
}

export function calcProfit(
  initialAssetIndex: number,
  initialAmount: number,
  cycle: number[],
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  eta: number,
  orderId: string
): [number, Recipe] | number {
  const pairList = cycle.slice(1).map((value, index) => {
      // try first/second else second/first
      const tempA = assets[cycle[index]],
        tempB = assets[value],
        indo = pairMap.get(`${tempA},${tempB}`) ?? pairMap.get(`${tempB},${tempA}`)

      // if not found then fail
      if (indo === undefined) throw Error(`Invalid pair requested. quote: ${tempA}, ${tempB}`)

      // return the lookup value on success
      return pairs[indo]
    }),
    // setup a recipe object to return just in case calculation shows profitable
    recipe: Recipe = {
      initialAmount: initialAmount,
      initialAssetIndex: initialAssetIndex,
      initialAssetName: assets[initialAssetIndex],
      steps: new Array<OrderCreateRequest>(),
    }

  let // start with initially provided index and amount
    currentAsset = initialAssetIndex,
    currentAmount = initialAmount

  // for each trade index of a trade
  for (const pair of pairList) {
    // validate the bid and ask are populated by this point
    if (pair.ask === undefined || pair.bid === undefined)
      throw Error('ask bid spread is not defined')

    // if there was an issue and the assets were improperly populated
    if (currentAsset !== pair.baseIndex && currentAsset !== pair.quoteIndex) {
      throw Error(
        'Invalid logic somewhere! Current Tuple State:' +
          [currentAsset, pair.quoteIndex, pair.baseIndex].join(', ')
      )
    }

    // mark as 0 if processing results in an impossible trade
    currentAmount = currentAmount > pair.ordermin ? currentAmount : 0

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
      const step: OrderCreateRequest = {
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
