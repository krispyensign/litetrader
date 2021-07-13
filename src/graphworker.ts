import { Mutex } from 'async-mutex'
import * as util from 'util'
import { parentPort, workerData } from 'worker_threads'
import { createOrderRequest, sendData } from './services/configure.js'
import { findCycles } from './lib/graphlib.js'
import { setCallback } from './services/oanda.js'
import { calcProfit } from './lib/profitcalclib.js'

export { createGraphProfitCallback, graphWorker }

let isError = util.types.isNativeError

function createOrderCallback(
  result: Step[],
  d: GraphWorkerData,
  t: GraphWorkerTimer,
  graphCount: number,
  ws: unknown,
  key: Key,
  shutdownCallback: () => Promise<void>
): (data: string) => Promise<void> {
  // initialize sequence number for callback branching
  let seq = 0

  return async (data: string): Promise<void> => {
    // continue to process if not complete
    if (++seq < result.length) {
      // send the next order
      sendData(createOrderRequest(d.token, result[seq].orderCreateRequest), ws, key)
      return console.log(data)
    }

    // record the time the last order response came in
    let t2 = Date.now()
    console.log(data)

    // loop through each trade of the result processed
    result
      // get the corresponding indexpair for the trade
      .map((trade: Step): [Step, IndexedPair?] => [
        trade,
        d.pairs.find(p => p.tradename === trade.orderCreateRequest.pair),
      ])
      // log the difference between the predicted and actual prices
      .map(([trade, pair]: [Step, IndexedPair?]) => ({
        n: pair?.name,
        a: pair?.ask,
        b: pair?.bid,
        e: trade.price,
        m: trade.orderCreateRequest.amount,
        nm: trade.newAmount,
        s: trade.orderCreateRequest.direction,
      }))
      // just display for now
      .forEach(val => console.log(val))

    // log all the data
    console.log(
      `amounts: ${d.initialAmount} -> ${result[result.length - 1].newAmount}
        total latency: ${t2 - t.t1!}ms
        mean latency: ${(t2 - t.t1!) / result.length}ms
        total calc time: ${t.t3! - t.startTime.getTime()}ms
        # trades evaluated: ${graphCount}`
    )

    // die for now
    return await shutdownCallback()
  }
}

function createGraphProfitCallback(
  d: GraphWorkerData,
  ws: unknown,
  mutex: Mutex,
  key: Key,
  shutdownCallback: () => Promise<void>
): (arg: readonly number[]) => void {
  // global start time to understand how long search took
  let startTime = new Date(Date.now())
  // global graph count to understand how many sub graphs were evaluated
  let graphCount = 0

  return async (cycle: readonly number[]): Promise<unknown> => {
    // calc the profit
    graphCount++
    let t1 = Date.now()
    let result = calcProfit(d, cycle)

    // check if there was an error
    if (isError(result)) return Promise.reject(result)

    // check if the calc was profitable, log every 10k if not
    if (result === 0 || result[result.length - 1].newAmount <= d.initialAmount) {
      if (graphCount % 10000 === 0)
        console.log({
          count: graphCount,
          cycle: cycle,
          amount: result === 0 ? 0 : result[result.length - 1].newAmount,
        })
      return
    }

    // lock the processs so no other orders are placed
    await mutex.acquire()
    let t3 = Date.now()

    // send the initial order
    // console.log(result)
    sendData(createOrderRequest(d.token, result[0].orderCreateRequest), ws, key)

    // set the callback to place more orders with each response
    return setCallback(
      ws,
      createOrderCallback(
        result,
        d,
        {
          t1,
          t3,
          startTime,
        },
        graphCount,
        ws,
        key,
        shutdownCallback
      )
    )
  }
}

function graphWorker(): true {
  // create a cycles generator
  let cycles = findCycles<number>(
    // bug: only supports one vertex for now
    [workerData.initialAssetIndex],

    // convert json object to map
    new Map<number, readonly number[]>(
      Object.entries(workerData.graph as Dictionary<readonly number[]>).map(([k, v]) => [
        Number(k),
        v,
      ])
    )
  )

  // post each cycle found to main loop to be processed by the GraphProfitCallback
  for (let cycle of cycles) parentPort?.postMessage(cycle)

  return true
}
