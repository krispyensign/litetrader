export type Label = number | string

export interface LazyIterable<T> {
  [Symbol.iterator](): IterableIterator<T>
}

abstract class Lazy<T, U, V> implements LazyIterable<U> {
  public abstract [Symbol.iterator](): IterableIterator<U>
  protected fn?: (value: T) => V
  protected it: Iterable<T>
  constructor(it: Iterable<T>, fn?: (value: T) => V) {
    this.it = it
    this.fn = fn
  }
}

// remove items
class LazyFilter<T> extends Lazy<T, T, boolean> {
  *[Symbol.iterator](): IterableIterator<T> {
    for (let item of this.it) {
      if (this.fn!(item)) {
        yield item
      }
    }
  }
}

// transform
class LazyMap<T, U> extends Lazy<T, U, U> {
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of this.it) {
      yield this.fn!(item)
    }
  }
}

// filter then transform
class LazyFilterMap<T, U> extends Lazy<T, U, U> {
  private fnFilter: (value: T) => boolean
  constructor(it: Iterable<T>, fn: (value: T) => U, fnFilter: (value: T) => boolean) {
    super(it, fn)
    this.fnFilter = fnFilter
  }
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of this.it) {
      if (!this.fnFilter(item)) continue
      else yield this.fn!(item)
    }
  }
}

// transform then filter
class LazyMapFilter<T, U> extends Lazy<T, U, U> {
  private fnFilter: (value: U) => boolean

  constructor(it: Iterable<T>, fn: (value: T) => U, fnFilter: (value: U) => boolean) {
    super(it, fn)
    this.fnFilter = fnFilter
  }

  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of this.it) {
      let t = this.fn!(item)
      if (!this.fnFilter(t)) continue
      else yield t
    }
  }
}

// flatten shallow
class LazyFlatten<T> extends Lazy<Iterable<T>, T, T> {
  *[Symbol.iterator](): IterableIterator<T> {
    for (let subIt of this.it) {
      for (let v of subIt) {
        yield v
      }
    }
  }
}

// transform then flatten shallow
class LazyFlatMap<T, U> extends Lazy<T, U, Iterable<U>> {
  *[Symbol.iterator](): IterableIterator<U> {
    for (let item of this.it) {
      for (let subItem of this.fn!(item)) {
        yield subItem
      }
    }
  }
}

// take just 1
class LazyPeek<T> extends Lazy<T, T, T> {
  *[Symbol.iterator](): IterableIterator<T> {
    for (let item of this.it) {
      yield item
      break
    }
  }
}

export function mapFilterl<T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: U) => boolean
): LazyIterable<U> {
  return new LazyMapFilter(it, fn, fnFilter)
}

export function filterMapl<T, U>(
  it: Iterable<T>,
  fn: (value: T) => U,
  fnFilter: (value: T) => boolean
): LazyIterable<U> {
  return new LazyFilterMap(it, fn, fnFilter)
}

export function filterl<T>(it: Iterable<T>, fn: (value: T) => boolean): LazyIterable<T> {
  return new LazyFilter(it, fn)
}

export function mapl<T, U>(it: Iterable<T>, fn: (value: T) => U): LazyIterable<U> {
  return new LazyMap(it, fn)
}

export function flattenl<T>(it: Iterable<Iterable<T>>): LazyIterable<T> {
  return new LazyFlatten(it)
}

export function flatMapl<T, U>(it: Iterable<T>, fn: (value: T) => Iterable<U>): LazyIterable<U> {
  return new LazyFlatMap(it, fn)
}

export function partitionl<T>(
  it: LazyIterable<T>,
  fn: (value: T) => boolean
): [LazyIterable<T>, LazyIterable<T>] {
  let nfn = (value: T): boolean => !fn(value)
  return [new LazyFilter(it, fn), new LazyFilter(it, nfn)]
}

export function peekl<T>(it: LazyIterable<T>): LazyIterable<T> {
  return new LazyPeek(it, undefined)
}

export function getValue<T>(it: LazyIterable<T>): T[] {
  return [...it]
}

export function hasValue<T>(it: LazyIterable<T>): boolean {
  for (let item of it) {
    if (item !== null) {
      return true
    } else {
      return false
    }
  }
  return false
}
