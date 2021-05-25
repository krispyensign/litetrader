import WebSocket from 'ws'
import { Worker } from 'worker_threads'
import { calcProfit } from './calc.js'
import { Mutex } from 'async-mutex'
import { stopSubscription } from './tick.js'
import * as util from 'node:util'

let graphCount = 0
const startTime = Date.now()
const isError = util.types.isNativeError

export const createShutdownCallback = (
  orderws: WebSocket,
  worker: Worker,
  mutex: Mutex,
  pairs: IndexedPair[],
  wsExchange: { close: () => void }
): (() => void) => async (): Promise<void> =>
  mutex.acquire().then(() => {
    // unsubsribe from everything
    stopSubscription(pairs, wsExchange)

    // kill the connections ( will also kill detached threads and thus the app )
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
  graphCount++

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
        const t3 = Date.now()
        result.forEach(step => orderws.send(createOrderRequest(d.token, step.orderCreateRequest)))
        const t2 = Date.now()

        // log value and die for now
        console.log(result)
        console.log(`amounts: ${d.initialAmount} -> ${result[result.length - 1].amount}`)
        console.log(`time: ${t2 - t1}ms`)
        console.log(`calcTime: ${t3 - startTime}ms`)
        console.log(`count: ${graphCount}`)
        shutdownCallback()
        // isSending = false
      })
    : Promise.resolve()
}
