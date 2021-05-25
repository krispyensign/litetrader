type LazyIterable<T> = {
  [Symbol.iterator](): IterableIterator<T>
}

const filterMapl = <T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: T) => boolean
): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) {
      if (!fnFilter(item)) continue
      else yield fn!(item)
    }
  },
})

const filterl = <T>(it: Iterable<T>, fn: (value: T) => boolean): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const item of it) {
      if (fn!(item)) {
        yield item
      }
    }
  },
})

const flatMapl = <T, U>(it: Iterable<T>, fn: (value: T) => Iterable<U>): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) {
      for (const subItem of fn!(item)) {
        yield subItem
      }
    }
  },
})

const partitionl = <T>(
  it: LazyIterable<T>,
  fn: (value: T) => boolean
): readonly [LazyIterable<T>, LazyIterable<T>] => [
  filterl(it, fn),
  filterl(it, (value: T): boolean => !fn(value)),
]

const peekl = <T>(it: LazyIterable<T>): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const item of it) {
      yield item
      break
    }
  },
})

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
    if (hasValue(peekl(cycles))) for (const cycle of cycles) yield cycle

    // if nothing at all was found then break
    if (!hasValue(peekl(paths))) break

    // start to find the next size up paths
    candidatePaths = growPaths(paths, neighbors)
  }
}