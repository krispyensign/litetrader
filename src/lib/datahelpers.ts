let buildAssets = (tradePairs: ExchangePair[]): string[] => [
  ...tradePairs.reduce(
    (prev, pair) => prev.add(pair.baseName).add(pair.quoteName),
    new Set<string>()
  ),
]

let buildIndexedPairs = (tradePairs: ExchangePair[], assets: string[]): IndexedPair[] =>
  tradePairs.map(pair => ({
    ...pair,
    baseIndex: assets.indexOf(pair.baseName),
    quoteIndex: assets.indexOf(pair.quoteName),
  }))

let buildPairMap = (tradePairs: ExchangePair[]): Map<string, number> =>
  new Map([
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.tradename, index])),
    ...new Map<string, number>(tradePairs.map((pair, index) => [pair.name, index])),
    ...new Map<string, number>(
      tradePairs.map(pair => [[pair.baseName, pair.quoteName].join(','), pair.index])
    ),
  ])

let getIndex = async (initialAssetIndexF: number, initialAsset: string): Promise<number> =>
  initialAssetIndexF === -1
    ? Promise.reject(Error(`invalid asset ${initialAsset}`))
    : Promise.resolve(initialAssetIndexF)

// validate initialasset before continuing
let getInitialAssetIndex = async (assets: string[], initialAsset: string): Promise<number> =>
  await getIndex(
    assets.findIndex(a => a === initialAsset),
    initialAsset
  )

export let setupData = async (
  tradePairs: ExchangePair[],
  initialAsset: string
): Promise<[readonly string[], IndexedPair[], Map<string, number>, number]> => [
  buildAssets(tradePairs),
  buildIndexedPairs(tradePairs, buildAssets(tradePairs)),
  buildPairMap(tradePairs),
  await getInitialAssetIndex(buildAssets(tradePairs), initialAsset),
]
