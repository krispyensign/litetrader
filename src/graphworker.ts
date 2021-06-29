import { Mutex } from 'async-mutex'
import * as util from 'util'
import { parentPort, workerData } from 'worker_threads'
import { createOrderRequest, sendData } from './exchange/auth.js'
import { setCallback } from './exchange/kraken.js'
import { findCycles } from './graphlib.js'
import { calcProfit } from './profitcalc.js'

const isError = util.types.isNativeError

const createOrderCallback = (
  result: Step[],
  d: GraphWorkerData,
  t: GraphWorkerTimer,
  graphCount: number,
  ws: unknown,
  shutdownCallback: () => Promise<void>
): ((data: string) => Promise<void>) => {
  let seq = 0
  return async (data: string): Promise<void> => {
    // shortcircuit and shutdown (for now) if all processed
    if (++seq >= result.length) {
      // log and die for now
      const t2 = Date.now()
      console.log(data)
      for (const trade of result) {
        const pair = d.pairs.find(p => p.tradename === trade.orderCreateRequest.pair)
        console.log({
          n: pair?.name,
          a: pair?.ask,
          b: pair?.bid,
          e: trade.price,
          m: trade.orderCreateRequest.amount,
          nm: trade.newAmount,
          s: trade.orderCreateRequest.direction,
        })
      }
      console.log(`amounts: ${d.initialAmount} -> ${result[result.length - 1].newAmount}`)
      console.log(`total latency: ${t2 - t.t1!}ms`)
      console.log(`mean latency: ${(t2 - t.t1!) / result.length}ms`)
      console.log(`total calc time: ${t.t3! - t.startTime.getTime()}ms`)
      console.log(`# trades evaluated: ${graphCount}`)
      await shutdownCallback()
      return
    }

    // send the next order
    sendData(createOrderRequest(d.token, result[seq].orderCreateRequest), ws)
    console.log(data)
  }
}

export const createGraphProfitCallback = (
  d: GraphWorkerData,
  ws: unknown,
  mutex: Mutex,
  shutdownCallback: () => Promise<void>
): ((arg: readonly number[]) => void) => {
  const startTime = new Date(Date.now())
  let graphCount = 0
  return async (cycle: readonly number[]): Promise<unknown> => {
    // calc the profit
    graphCount++
    const t1 = Date.now()
    const result = calcProfit(d, cycle)

    // check if there was an error
    if (isError(result)) return Promise.reject(result)

    // check if the calc was profitable
    if (result === 0) return
    if (result[result.length - 1].newAmount <= d.initialAmount) {
      if (graphCount % 10000 === 0)
        console.log({
          count: graphCount,
          cycle: cycle,
          amount: result[result.length - 1].newAmount,
        })
      return
    }

    // lock the processs so no other orders are placed
    await mutex.acquire()
    const t3 = Date.now()

    // send the initial order
    sendData(createOrderRequest(d.token, result[0].orderCreateRequest), ws)
    const orderCallback = createOrderCallback(
      result,
      d,
      {
        t1,
        t3,
        startTime,
      },
      graphCount,
      ws,
      shutdownCallback
    )

    // set the callback to place more orders with each response
    setCallback(ws, orderCallback)
    return
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
