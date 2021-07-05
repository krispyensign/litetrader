import got from 'got'
import { Duplex } from 'stream'

const basePath = '/v3/accounts/'
const apiUrl = 'https://api-fxpractice.oanda.com'
const streamUrl = 'https://stream-fxpractice.oanda.com'

let internalOrderCallback: (data: string) => void

const validateResponse = async <T>(response: OandaResponseWrapper): Promise<T> =>
  response.errorCode !== undefined
    ? Promise.reject(Error(response.errorMessage))
    : (response as unknown as T)

const postAuthEndpoint = async <T>(url: string, payload: string, key: Key): Promise<T> =>
  validateResponse(
    await got
      .post({
        url: url,
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

const getAuthEndpoint = async <T>(url: string, key: Key): Promise<T> =>
  validateResponse(
    await got
      .get({
        url: url,
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

const getStreamEndpoint = (url: string, key: Key): Duplex =>
  got.stream({
    url: url,
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
    console.log({ id: pairs[pairIndex].name, a: pairs[pairIndex].ask, b: pairs[pairIndex].bid })
  }

export const startSubscription = async (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  _wsExchange: unknown,
  key: Key
): Promise<unknown> => {
  const callback = createSubscriptionCallback(pairs, pairMap)
  const duplex = getStreamEndpoint(
    `${streamUrl}${basePath}${key.accountId}/pricing/stream?instruments=` +
      pairs.map(p => p.name).join(','),
    key!
  )
  duplex.on('data', (chunk: Buffer) => {
    console.log(chunk.toLocaleString())
    chunk
      .toLocaleString()
      .trim()
      .split(/\r\n|\n\r|\n|\r/)
      .filter(d => d[d.length - 1] === '}')
      .forEach(d => callback(JSON.parse(d.toLocaleString()) as OandaTicker))
  })
  return duplex
}

export const getAvailablePairs = async (
  _apiExchange: unknown,
  key: Key
): Promise<ExchangePair[]> => (
  console.log(`${apiUrl}${basePath}${key.accountId}/instruments`),
  (
    await getAuthEndpoint<OandaAccountInstruments>(
      `${apiUrl}${basePath}${key.accountId}/instruments`,
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
)

export const setCallback = (_sock: unknown, callback: (data: string) => void): unknown =>
  (internalOrderCallback = callback)

export const sendData = async (payload: string, _ws: unknown, key: Key): Promise<void> =>
  internalOrderCallback(
    JSON.stringify(
      await postAuthEndpoint(`${apiUrl}${basePath}${key.accountId}/orders`, payload, key!)
    )
  )
