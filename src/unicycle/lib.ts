
export interface LazyIterable<T> {
  [Symbol.iterator](): IterableIterator<T>
}

export let mapFilterl = <T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: U) => boolean
): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of it) {
      let t = fn!(item)
      if (!fnFilter(t)) continue
      else yield t
    }
  },
})

export let filterMapl = <T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: T) => boolean
): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of it) {
      if (!fnFilter(item)) continue
      else yield fn!(item)
    }
  },
})

export let filterl = <T>(it: Iterable<T>, fn: (value: T) => boolean): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (let item of it) {
      if (fn!(item)) {
        yield item
      }
    }
  },
})

export let mapl = <T, U>(it: Iterable<T>, fn: (value: T) => U): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of it) {
      yield fn!(item)
    }
  },
})

export let flattenl = <T>(it: Iterable<Iterable<T>>): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (let subIt of it) {
      for (let v of subIt) {
        yield v
      }
    }
  },
})

export let flatMapl = <T, U>(it: Iterable<T>, fn: (value: T) => Iterable<U>): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of it) {
      for (let subItem of fn!(item)) {
        yield subItem
      }
    }
  },
})

export let partitionl = <T>(
  it: LazyIterable<T>,
  fn: (value: T) => boolean
): [LazyIterable<T>, LazyIterable<T>] => [
  filterl(it, fn),
  filterl(it, (value: T): boolean => !fn(value)),
]

export let peekl = <T>(it: LazyIterable<T>): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (let item of it) {
      yield item
      break
    }
  },
})

export let getValue = <T>(it: LazyIterable<T>): T[] => [...it]

export let hasValue = <T>(it: LazyIterable<T>): boolean => {
  for (let item of it) return item !== null
  return false
}
