import { Mutex } from 'async-mutex'
import * as util from 'node:util'
import { parentPort, workerData } from 'worker_threads'
import { calcProfit } from './profitcalc.js'
import WebSocket from 'ws'

let graphCount = 0
const startTime = Date.now()
const isError = util.types.isNativeError

type LazyIterable<T> = {
  [Symbol.iterator](): IterableIterator<T>
}

const filterMapl = <T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: T) => boolean
): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it)
      if (!fnFilter(item)) continue
      else yield fn!(item)
  },
})

const filterl = <T>(it: Iterable<T>, fn: (value: T) => boolean): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const item of it) if (fn!(item)) yield item
  },
})

const flatMapl = <T, U>(it: Iterable<T>, fn: (value: T) => Iterable<U>): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) for (const subItem of fn!(item)) yield subItem
  },
})

const partitionl = <T>(
  it: LazyIterable<T>,
  fn: (value: T) => boolean
): readonly [LazyIterable<T>, LazyIterable<T>] => [
  filterl(it, fn),
  filterl(it, (value: T): boolean => !fn(value)),
]

const hasValue = <T>(it: LazyIterable<T>): boolean => {
  for (const item of it) return item !== null
  return false
}

type Label = number | string

/*
  path[-1] !== nbr  | path.includes(nbr)  |  path[0] === nbr  | result
            T         T                       T                 T  <--  a cycle
            T         T                       F                 F  <--  already in path discard
            T         F                       *                 F  <--  Not possible
            T         F                       F                 T  <--  new item
            F         *                       *                 F  <--  self loop discard remaining
                                                                        checks
*/

const growPaths = (
  paths: Iterable<readonly Label[]>,
  neighbors: ReadonlyMap<Label, readonly Label[]>
): LazyIterable<readonly Label[]> =>
  flatMapl(
    filterl(
      paths,
      // only perform grow operation if there are neighbors
      path => neighbors.has(path[path.length - 1])
    ),

    currentPath =>
      filterMapl(
        // loop through each neighbor of the last element of the current path
        neighbors.get(currentPath[currentPath.length - 1])!.values(),

        // build new paths with remaining neighbors
        neighbor => currentPath.concat(neighbor),

        // discard nbrs that don't meet the criteria for a cycle or path
        neighbor =>
          // assert that the current neighbor isn't a loop
          currentPath[currentPath.length - 1] !== neighbor &&
          // if the neighbor completes the circuit or is not already included
          currentPath.includes(neighbor) === (currentPath[0] === neighbor)
      )
  )

export function* findCycles(
  startAssets: readonly Label[],
  neighbors: ReadonlyMap<Label, readonly Label[]>
): Generator<readonly Label[], void, unknown> {
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

export const buildGraph = (indexedPairs: readonly IndexedPair[]): Dictionary<readonly number[]> => {
  return (
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
  )
}

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
  )) {
    parentPort?.postMessage(cycle)
  }
  return true
}
