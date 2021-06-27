import { Mutex } from 'async-mutex'
import * as util from 'util'
import { parentPort, workerData } from 'worker_threads'
import { createOrderRequest, sendData } from './exchange/auth.js'
import { setCallback } from './exchange/kraken.js'
import { findCycles } from './graphlib.js'
import { calcProfit } from './profitcalc.js'

const isError = util.types.isNativeError

export function createGraphProfitCallback(
  d: GraphWorkerData,
  ws: unknown,
  mutex: Mutex,
  shutdownCallback: () => Promise<void>
): (arg: readonly number[]) => void {
  const startTime = new Date(Date.now())
  let graphCount = 0
  return async (cycle: readonly number[]): Promise<unknown> => {
    const result = calcProfit(d, cycle)
    const t1 = Date.now()
    graphCount++

    // check if there was an error
    if (isError(result)) return Promise.reject(result)

    // check if the calc was worthless
    if (result === 0) return Promise.resolve()

    // if result is profitable then process
    if (result[result.length - 1].amount > d.initialAmount) {
      // lock the processs so no other orders are placed
      const t3 = Date.now()
      await mutex.acquire()

      // start sequence
      let seq = 0

      // send the initial order
      sendData(createOrderRequest(d.token, result[seq].orderCreateRequest), ws)

      // set the callback to place more orders with each response
      setCallback(ws, async () => {
        // shortcircuit and shutdown (for now) if all processed
        if (++seq >= result.length) {
          // log and die for now
          const t2 = Date.now()
          for (const trade of result) {
            const pair = d.pairs.find(p => p.tradename === trade.orderCreateRequest.pair)
            console.log({
              n: pair?.name,
              a: pair?.ask,
              b: pair?.bid,
              e: trade.price,
              m: trade.orderCreateRequest.amount,
              nm: trade.amount,
              s: trade.orderCreateRequest.direction,
            })
          }
          console.log(`amounts: ${d.initialAmount} -> ${result[result.length - 1].amount}`)
          console.log(`total latency: ${t2 - t1}ms`)
          console.log(`mean latency: ${(t2 - t1) / result.length}ms`)
          console.log(`total calc time: ${t3 - startTime.getTime()}ms`)
          console.log(`# trades evaluated: ${graphCount}`)
          await shutdownCallback()
          return
        }

        // send the next order
        sendData(createOrderRequest(d.token, result[seq].orderCreateRequest), ws)
      })
    }
    return Promise.resolve()
  }
}

export const worker = (): true => {
  // loop through each cycle and post
  for (const cycle of findCycles(
    [workerData.initialAssetIndex],
    new Map<number, readonly number[]>(
      Object.entries(workerData.graph as Dictionary<readonly number[]>).map(([k, v]) => [
        Number(k),
        v,
      ])
    )
  )) {
    parentPort?.postMessage(cycle)
  }

  return true
}
