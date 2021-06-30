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