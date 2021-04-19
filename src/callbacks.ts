import { calcProfit } from './calc'
import WebSocket = require('ws')
import { OrderCreateRequest, PairPriceUpdate, PricedPair } from './types'
import readline = require('readline')

let sleep = async (timems: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, timems))
}

let setBool = (bool: Boolean, newVal: boolean): Boolean => {
  bool.valueOf = (): boolean => newVal
  return bool
}

let updatePair = (
  pairMap: Map<string, number>,
  pricedPairs: PricedPair[],
  pairUpdate: PairPriceUpdate | string
): void => {
  if (typeof pairUpdate === 'string') return
  if (pairUpdate.tradeName === undefined) throw Error('Missing tradename from update')
  let pairIndex = pairMap.get(pairUpdate.tradeName)
  if (pairIndex === undefined) throw Error(`Invalid pair encountered. ${pairUpdate.tradeName}`)
  let pair = pricedPairs[pairIndex]
  pair.lastAskPrice = pair.ask
  pair.lastBidPrice = pair.bid
  pair.ask = pairUpdate.ask
  pair.bid = pairUpdate.bid
}

export let newTickCallback = (
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  parseTick: (arg: string) => PairPriceUpdate | string
) => {
  return (x: WebSocket.MessageEvent): void => {
    return updatePair(pairMap, pairs, parseTick(x.toLocaleString()))
  }
}

export let newShutdownCallback = (
  isUnsubscribe: Boolean,
  tickws: WebSocket,
  orderws: WebSocket,
  worker: readline.Interface,
  unSubRequest: string
) => {
  return (): void => {
    // only run once
    if (isUnsubscribe.valueOf()) return
    setBool(isUnsubscribe, true)

    // unsubsribe from everything
    tickws.send(unSubRequest)

    // kill the connections ( will also kill detached threads and thus the app )
    tickws.close()
    orderws.close()
    worker.close()
    console.log('shutdown complete')
  }
}

export let newGraphProfitCallback = (
  initialAssetIndex: number,
  initialAmount: number,
  assets: string[],
  pairs: PricedPair[],
  pairMap: Map<string, number>,
  eta: number,
  isSending: Boolean,
  orderws: WebSocket,
  token: string,
  createOrderRequest: (token: string, step: OrderCreateRequest) => string,
  shutdownCallback: () => void
) => {
  let count = 0
  return async (cycleData: string): Promise<void> => {
    if (cycleData === 'done') {
      shutdownCallback()
      return
    }

    let cycle: number[] = JSON.parse(cycleData)

    if (cycle[0] !== initialAssetIndex) {
      console.log(`filter failed ${cycle[0]}, ${initialAssetIndex}}`)
    }

    // calc profit, hopefully something good is found
    let result = calcProfit(
      initialAssetIndex,
      initialAmount,
      cycle,
      assets,
      pairs,
      pairMap,
      eta,
      '0'
    )

    count += 1
    if (count % 10000 === 0) console.log(`${count / 10000}: ${cycle} : ${result}`)

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      if (isSending) {
        console.log('blocked send while already sending')
        return
      }
      setBool(isSending, true)
      console.time('send')
      let [amount, recipe] = result
      console.log(`amounts: ${initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      for (let step of recipe.steps) {
        orderws.send(createOrderRequest(token, step))
        await sleep(1)
      }
      console.timeEnd('send')
      setBool(isSending, false)
    }
  }
}
