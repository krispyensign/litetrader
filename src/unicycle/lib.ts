export interface LazyIterable<T> {
  [Symbol.iterator](): IterableIterator<T>
}

export const mapFilterl = <T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: U) => boolean
): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) {
      const t = fn!(item)
      if (!fnFilter(t)) continue
      else yield t
    }
  },
})

export const filterMapl = <T, U>(
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

export const filterl = <T>(it: Iterable<T>, fn: (value: T) => boolean): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const item of it) {
      if (fn!(item)) {
        yield item
      }
    }
  },
})

export const mapl = <T, U>(it: Iterable<T>, fn: (value: T) => U): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) {
      yield fn!(item)
    }
  },
})

export const flattenl = <T>(it: Iterable<Iterable<T>>): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const subIt of it) {
      for (const v of subIt) {
        yield v
      }
    }
  },
})

export const flatMapl = <T, U>(
  it: Iterable<T>,
  fn: (value: T) => Iterable<U>
): LazyIterable<U> => ({
  *[Symbol.iterator](): IterableIterator<U> {
    for (const item of it) {
      for (const subItem of fn!(item)) {
        yield subItem
      }
    }
  },
})

export const partitionl = <T>(
  it: LazyIterable<T>,
  fn: (value: T) => boolean
): [LazyIterable<T>, LazyIterable<T>] => [
  filterl(it, fn),
  filterl(it, (value: T): boolean => !fn(value)),
]

export const peekl = <T>(it: LazyIterable<T>): LazyIterable<T> => ({
  *[Symbol.iterator](): IterableIterator<T> {
    for (const item of it) {
      yield item
      break
    }
  },
})

export const getValue = <T>(it: LazyIterable<T>): T[] => [...it]

export const hasValue = <T>(it: LazyIterable<T>): boolean => {
  for (const item of it) return item !== null
  return false
}
