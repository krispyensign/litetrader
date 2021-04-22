import {
  filterl,
  filterMapl,
  flatMapl,
  hasValue,
  Label,
  LazyIterable,
  partitionl,
  peekl,
} from './lib.js'

/*
  path[-1] !== nbr  | path.includes(nbr)  |  path[0] === nbr  | result
            T         T                       T                 T  <-- a cycle
            T         T                       F                 F  <-- already in path discard
            T         F                       *                 F  <-- Not possible
            T         F                       F                 T  <-- new item
            F         *                       *                 F  <-- self loop discard remaining
                                                                       checks
*/
function growPaths(
  paths: Iterable<Label[]>,
  neighbors: Map<Label, Label[]>
): LazyIterable<Label[]> {
  return flatMapl(
    filterl(
      paths,
      // only perform grow operation if there are neighbors
      path => neighbors.has(path[path.length - 1])
    ),

    currentPath =>
      filterMapl(
        // loop through each neighbor of the last element of the current path
        neighbors.get(currentPath[currentPath.length - 1])!.values(),

        // letruct new paths with remaining neighbors
        neighbor => currentPath.concat(neighbor),

        // discard nbrs that don't meet the criteria for a cycle or path
        neighbor =>
          // assert that the current neighbor isn't a loop
          currentPath[currentPath.length - 1] !== neighbor &&
          // if the neighbor completes the circuit or is not already included
          currentPath.includes(neighbor) === (currentPath[0] === neighbor)
      )
  )
}

export function* findCycles(
  startAssets: Label[],
  neighbors: Map<Label, Label[]>
): Generator<Label[], void, unknown> {
  let candidatePaths = growPaths(
    startAssets.map(val => [val]),
    neighbors
  )

  while (true) {
    // partition into cycles and paths
    let [cycles, paths] = partitionl(candidatePaths, path => path[0] === path[path.length - 1])

    // report back the cycles
    if (hasValue(peekl(cycles))) for (let cycle of cycles) yield cycle

    // if nothing at all was found then break
    if (!hasValue(peekl(paths))) break

    // start to find the next size up paths
    candidatePaths = growPaths(paths, neighbors)
  }
}
