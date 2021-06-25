import { Mutex } from 'async-mutex'
import * as util from 'util'
import { parentPort, workerData } from 'worker_threads'
import { createOrderRequest, sendData } from './exchange/auth.js'
import { setCallback } from './exchange/kraken.js'
import { calcProfit } from './profitcalc.js'

let graphCount = 0
const isError = util.types.isNativeError

const filterMapl = <T, U>(it: Iterable<T>, fnFilter: FnFilter<T>, fn: Fn<T, U>): Lazy<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it)
      if (!fnFilter(item)) continue
      else yield fn(item)
  },
})

const filterl = <T>(it: Iterable<T>, fn: FnFilter<T>): Lazy<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const item of it) if (fn(item)) yield item
  },
})

const flatMapl = <T, U>(it: Iterable<T>, fn: FnMulti<T, U>): Lazy<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) for (const subItem of fn(item)) yield subItem
  },
})

const partitionl = <T>(it: Lazy<T>, fn: FnFilter<T>): readonly [Lazy<T>, Lazy<T>] => [
  filterl(it, fn),
  filterl(it, (value: T): boolean => !fn(value)),
]

const hasValue = <T>(it: Lazy<T>): boolean => {
  for (const item of it) return item !== null
  return false
}

/*
  path[-1] !== nbr  | path.includes(nbr)  |  path[0] === nbr  | result
            T         T                       T                 T  <--  a cycle
            T         T                       F                 F  <--  already in path discard
            T         F                       *                 F  <--  Not possible
            T         F                       F                 T  <--  new item
            F         *                       *                 F  <--  self loop discard remaining
                                                                        checks
*/

const growPaths = <T>(
  paths: Iterable<readonly T[]>,
  neighbors: ReadonlyMap<T, readonly T[]>
): Lazy<readonly T[]> =>
  flatMapl(
    // only perform grow operation if there are neighbors
    filterl(paths, path => neighbors.has(path[path.length - 1])),

    currentPath =>
      filterMapl(
        // loop through each neighbor of the last element of the current path
        neighbors.get(currentPath[currentPath.length - 1])!.values(),
        // discard nbrs that don't meet the criteria for a cycle or path
        neighbor =>
          currentPath[currentPath.length - 1] !== neighbor &&
          currentPath.includes(neighbor) === (currentPath[0] === neighbor),
        // build new paths with remaining neighbors
        neighbor => currentPath.concat(neighbor)
      )
  )

export function* findCycles<T>(
  startAssets: readonly T[],
  neighbors: ReadonlyMap<T, readonly T[]>
): Generator<readonly T[], void, unknown> {
  let candidatePaths = growPaths(
    startAssets.map(val => [val]),
    neighbors
  )

  while (true) {
    // partition into cycles and paths
    const [cycles, paths] = partitionl(candidatePaths, path => path[0] === path[path.length - 1])

    // report back the cycles
    if (hasValue(cycles)) for (const cycle of cycles) yield cycle

    // if nothing at all was found then break
    if (!hasValue(paths)) break

    // start to find the next size up paths
    candidatePaths = growPaths(paths, neighbors)
  }
}

export const buildGraph = (indexedPairs: readonly IndexedPair[]): Dictionary<readonly number[]> =>
  indexedPairs

    // create edge list
    .reduce(
      (edgeList, ip) =>
        edgeList.concat([[ip.baseIndex, ip.quoteIndex]]).concat([[ip.quoteIndex, ip.baseIndex]]),
      new Array<readonly [number, number]>()
    )
    // create adjacency map from edge list
    .reduce(
      (adjMap, edge) =>
        adjMap[edge[0].toString()] !== undefined
          ? ((adjMap[edge[0].toString()] = adjMap[edge[0].toString()]!.concat(edge[1])), adjMap)
          : ((adjMap[edge[0].toString()] = [edge[1]]), adjMap),
      {} as Dictionary<readonly number[]>
    )

const logResult = (
  result: Step[],
  t1: number,
  startTime: Date,
  d: GraphWorkerData,
  t3: number
): void => {
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
}

export const createGraphProfitCallback =
  (
    d: GraphWorkerData,
    ws: unknown,
    mutex: Mutex,
    shutdownCallback: () => Promise<void>,
    startTime: Date
  ): ((arg: readonly number[]) => void) =>
  async (cycle: readonly number[]): Promise<void> => {
    // calc profit, hopefully something good is found
    const t1 = Date.now()
    graphCount++
    const result = calcProfit(d, cycle)

    // if not just an amount and is a cycle then do stuff
    return isError(result)
      ? Promise.reject(result)
      : // check if the result is worthless
      result === 0
      ? Promise.resolve()
      : // check if the last state object amount > initialAmount
      result[result.length - 1].amount > d.initialAmount
      ? mutex.acquire().then(async () => {
          // send orders
          const t3 = Date.now()
          let seq = 0
          sendData(createOrderRequest(d.token, result[seq].orderCreateRequest), ws)
          setCallback(ws, async () =>
            ++seq < result.length
              ? sendData(createOrderRequest(d.token, result[seq].orderCreateRequest), ws)
              : (logResult(result, t1, startTime, d, t3), await shutdownCallback())
          )
        })
      : Promise.resolve()
  }

export const worker = (): true => {
  // post each cycle
  for (const cycle of findCycles(
    [workerData.initialAssetIndex],
    new Map<number, readonly number[]>(
      Object.entries(workerData.graph as Dictionary<readonly number[]>).map(([k, v]) => [
        Number(k),
        v,
      ])
    )
  ))
    parentPort?.postMessage(cycle)

  return true
}
