type GraphWorkerData = {
  initialAssetIndex: number
  initialAmount: number
  assets: readonly string[]
  pairs: IndexedPair[]
  pairMap: ReadonlyMap<string, number>
  eta: number
  token: string
}

type GraphWorkerTimer = {
  t1?: number
  t2?: number
  t3?: number
  startTime: Date
}

type Lazy<T> = {
  [Symbol.iterator](): IterableIterator<T>
}

type Fn<T, U> = (value: T) => U

type FnFilter<T> = (value: T) => boolean

type FnMulti<T, U> = (value: T) => Iterable<U>

type Label = number | string
