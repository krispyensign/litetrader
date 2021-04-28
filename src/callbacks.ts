import WebSocket from 'ws'
import { Worker } from 'worker_threads'
import { calcProfit } from './calc.js'
import type { OrderCreateRequest, PairPriceUpdate, IndexedPair } from './types/types'

export const createTickCallback = (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  parseTick: (arg: string) => PairPriceUpdate | string
) => (x: WebSocket.MessageEvent): void => {
  const pairUpdate = parseTick(x.toLocaleString())
  if (typeof pairUpdate === 'string') return
  const pairIndex = pairMap.get(pairUpdate.tradeName)
  if (pairIndex === undefined) throw Error(`Invalid pair encountered. ${pairUpdate.tradeName}`)
  pairs[pairIndex].ask = pairUpdate.ask
  pairs[pairIndex].bid = pairUpdate.bid
}

export const createShutdownCallback = (
  tickws: WebSocket,
  orderws: WebSocket,
  worker: Worker,
  unSubRequest: string
): (() => void) => {
  let isUnsubscribe = false
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

export const createGraphProfitCallback = (
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
    if (cycle[0] !== initialAssetIndex)
      console.log(`filter failed ${cycle[0]}, ${initialAssetIndex}}`)

    // calc profit, hopefully something good is found
    const result = calcProfit(initialAssetIndex, initialAmount, cycle, assets, pairs, pairMap, eta)

    // occassionally print to console if 10000 or so cycles have been processed
    count += 1
    if (count % 10000 === 0) console.log(`${count / 10000}: ${cycle} : ${result}`)

    // if not just an amount and is a cycle then do stuff
    if (typeof result !== 'number') {
      // don't allow any other processes to send while this one is sending
      if (isSending) return
      isSending = true

      // send orders
      const [amount, recipe] = result
      for (const step of recipe.steps) orderws.send(createOrderRequest(token, step))

      // log value and die for now
      console.log(`amounts: ${initialAmount} -> ${amount}`)
      console.log(recipe.steps)
      shutdownCallback()
      // isSending = false
    }
  }
}
