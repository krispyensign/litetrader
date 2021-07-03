import got from 'got'
import { Duplex } from 'stream'
import { pipeline } from 'stream/promises'

const basePath = '/v3/accounts/'
const apiUrl = 'https://api.kraken.com'

let internalOrderCallback: (data: string) => void

const validateResponse = async <T>(response: OandaResponseWrapper): Promise<T> =>
  response.errorCode !== undefined
    ? Promise.reject(Error(response.errorMessage))
    : (response as unknown as T)

const postAuthEndpoint = async <T>(path: string, payload: string, key: Key): Promise<T> =>
  validateResponse(
    await got
      .post({
        url: apiUrl + path,
        headers: {
          Authorization: `Bearer ${key.apiKey}`,
        },
        timeout: 50000,
        method: 'POST',
        responseType: 'json',
        body: payload,
        isStream: false,
      })
      .json()
  )

const getAuthEndpoint = async <T>(path: string, key: Key): Promise<T> =>
  validateResponse(
    await got
      .get({
        url: apiUrl + path,
        headers: {
          Authorization: `Bearer ${key.apiKey}`,
        },
        timeout: 50000,
        method: 'GET',
        responseType: 'json',
        isStream: false,
      })
      .json()
  )

const getStreamEndpoint = (path: string, key: Key): Duplex =>
  got.stream({
    url: apiUrl + path,
    headers: {
      Authorization: `Bearer ${key.apiKey}`,
    },
    method: 'GET',
    isStream: true,
  })

export const createOrderRequest = (_token: string, order: OrderCreateRequest): string =>
  JSON.stringify({
    order: {
      type: 'MARKET',
      instrument: order.pair,
      positionFill: 'REDUCE_FIRST',
      timeInForce: 'FOK',
      units: (order.direction === 'buy' ? order.amount : -order.amount).toFixed(2),
    },
  } as OandaAddOrder)

const createSubscriptionCallback =
  (pairs: IndexedPair[], pairMap: Map<string, number>) =>
  async (tick: OandaTicker): Promise<void> => {
    const pairIndex = pairMap.get(tick.instrument)
    if (pairIndex === undefined)
      return Promise.reject(Error(`Invalid pair encountered. ${tick.instrument}`))
    pairs[pairIndex].ask = Number(tick.asks[0]?.price ?? pairs[pairIndex].ask ?? 0)
    pairs[pairIndex].bid = Number(tick.bids[0]?.price ?? pairs[pairIndex].bid ?? 0)
    // console.log({ id: pairs[pairIndex].name, a: pairs[pairIndex].ask, b: pairs[pairIndex].bid })
  }

export const startSubscription = async (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  _wsExchange: unknown,
  key?: Key
): Promise<void> => {
  const callback = createSubscriptionCallback(pairs, pairMap)
  await pipeline(
    getStreamEndpoint(
      `${apiUrl}${basePath}${key!.accountId}/pricing/stream?instruments=` +
        pairs.map(p => p.name).join('%2'),

      key!
    ),
    async (source: AsyncIterable<string>) => {
      for await (const chunk of source) callback(JSON.parse(chunk) as OandaTicker)
    }
  )
}

export const getAvailablePairs = async (key: Key): Promise<ExchangePair[]> =>
  (
    await getAuthEndpoint<OandaAccountInstruments>(
      `${apiUrl}${basePath}/${key.accountId}/instruments`,
      key
    )
  ).instruments.map((i, ind) => ({
    baseName: i.name.split('_')[1],
    quoteName: i.name.split('_')[0],
    index: ind,
    name: i.name,
    ordermin: Number(i.minimumTradeSize),
    makerFee: 0,
    precision: i.tradeUnitsPrecision,
    takerFee: 0,
    tradename: i.name,
  }))

export const setCallback = (_sock: unknown, callback: (data: string) => void): unknown =>
  (internalOrderCallback = callback)

export const sendData = async (payload: string, _ws: unknown, key?: Key): Promise<void> =>
  internalOrderCallback(
    JSON.stringify(
      await postAuthEndpoint(`${apiUrl}${basePath}${key?.accountId}/orders`, payload, key!)
    )
  )
