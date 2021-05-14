import type { OrderCreateRequest, PairPriceUpdate, IndexedPair } from './types'
import WebSocket from 'ws'
import { Worker } from 'worker_threads'
import { calcProfit } from './calc.js'
import { isError } from './helpers.js'
import { Mutex } from 'async-mutex'

export type GraphWorkerData = {
  initialAssetIndex: number
  initialAmount: number
  assets: readonly string[]
  pairs: IndexedPair[]
  pairMap: ReadonlyMap<string, number>
  eta: number
  token: string
}

export const createTickCallback = (
  pairs: IndexedPair[],
  pairMap: ReadonlyMap<string, number>,
  parseTick: (arg: string) => PairPriceUpdate | string | Error
) => async (x: WebSocket.MessageEvent): Promise<void> => {
  const pairUpdate = parseTick(x.toLocaleString())
  if (typeof pairUpdate === 'string') return
  if (isError(pairUpdate)) {
    console.log(pairUpdate)
    return Promise.reject(pairUpdate)
  }
  const pairIndex = pairMap.get(pairUpdate.tradeName)
  if (pairIndex === undefined)
    return Promise.reject(Error(`Invalid pair encountered. ${pairUpdate.tradeName}`))
  pairs[pairIndex].ask = pairUpdate.ask
  pairs[pairIndex].bid = pairUpdate.bid
  return
}

export const createShutdownCallback = (
  tickws: WebSocket,
  orderws: WebSocket,
  worker: Worker,
  unSubRequest: string,
  mutex: Mutex
): (() => void) => async (): Promise<void> =>
  mutex.acquire().then(() => {
    // unsubsribe from everything
    tickws.send(unSubRequest)

    // kill the connections ( will also kill detached threads and thus the app )
    tickws.close()
    orderws.close()
    worker.terminate()
    console.log('shutdown complete')
  })

export const createGraphProfitCallback = (
  d: GraphWorkerData,
  orderws: WebSocket,
  mutex: Mutex,
  createOrderRequest: (token: string, step: OrderCreateRequest) => string,
  shutdownCallback: () => void
): ((arg: readonly number[]) => Promise<void>) => async (
  cycle: readonly number[]
): Promise<void> => {
  // calc profit, hopefully something good is found
  const t1 = Date.now()
  const result = calcProfit(d, cycle)

  // if not just an amount and is a cycle then do stuff
  return isError(result)
    ? Promise.reject(result)
    : // check if the result is worthless
    result === 0
    ? Promise.resolve()
    : // check if the last state object amount > initialAmount
    result[result.length - 1].amount > d.initialAmount
    ? mutex.runExclusive(() => {
        // send orders
        result.forEach(step => orderws.send(createOrderRequest(d.token, step.req)))
        const t2 = Date.now()

        // log value and die for now
        console.log(result)
        console.log(`amounts: ${d.initialAmount} -> ${result[result.length - 1].amount}`)
        console.log(`time: ${t2 - t1}`)
        shutdownCallback()
        // isSending = false
      })
    : Promise.resolve()
}
