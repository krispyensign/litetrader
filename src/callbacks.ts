import { calcProfit } from './calc'
import WebSocket = require('ws')
import type { OrderCreateRequest, PairPriceUpdate, IndexedPair } from './types'
import { Worker } from 'worker_threads'

let updatePair = (
  pairMap: Map<string, number>,
  pair: IndexedPair[],
  pairUpdate: PairPriceUpdate | string
): void => {
  if (typeof pairUpdate === 'string') return
  if (pairUpdate.tradeName === undefined) throw Error('Missing tradename from update')
  let pairIndex = pairMap.get(pairUpdate.tradeName)
  if (pairIndex === undefined) throw Error(`Invalid pair encountered. ${pairUpdate.tradeName}`)
  pair[pairIndex].ask = pairUpdate.ask
  pair[pairIndex].bid = pairUpdate.bid
}

export let newTickCallback = (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  parseTick: (arg: string) => PairPriceUpdate | string
) => {
  return (x: WebSocket.MessageEvent): void => {
    return updatePair(pairMap, pairs, parseTick(x.toLocaleString()))
  }
}

export let newShutdownCallback = (
  tickws: WebSocket,
  orderws: WebSocket,
  worker: Worker,
  unSubRequest: string
): (() => void) => {
  let isUnsubscribe = new Boolean(false)
  return (): void => {
    // only run once
    if (isUnsubscribe) return
    isUnsubscribe = true

    // unsubsribe from everything
    tickws.send(unSubRequest)

    // kill the connections ( will also kill detached threads and thus the app )
    tickws.close()
    orderws.close()
    worker.terminate()
    console.log('shutdown complete')
  }
}

export let newGraphProfitCallback = (
  initialAssetIndex: number,
  initialAmount: number,
  assets: string[],
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  eta: number,
  orderws: WebSocket,
  token: string,
  createOrderRequest: (token: string, step: OrderCreateRequest) => string,
  shutdownCallback: () => void
): ((arg: number[]) => Promise<void>) => {
  let count = 0
  let isSending = false

  return async (cycle: number[]): Promise<void> => {
    // filter paths that don't start with initial index
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

    // occassionally print to console if 10000 or so cycles have been processed
    count += 1
    if (count % 10000 === 0) console.log(`${count / 10000}: ${cycle} : ${result}`)

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      // don't allow any other processes to send while this one is sending
      if (isSending) {
        return
      }
      isSending = true

      // send orders
      console.time('send')
      let [amount, recipe] = result
      for (let step of recipe.steps) {
        orderws.send(createOrderRequest(token, step))
      }
      console.timeEnd('send')

      // log value and die for now
      console.log('====')
      console.log(`amounts: ${initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      isSending = false
      shutdownCallback()
      process.abort()
    }
  }
}
