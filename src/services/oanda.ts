import got from 'got'
import { Duplex } from 'stream'
export { createOrderRequest, startSubscription, getAvailablePairs, setCallback, sendData }

let basePath = '/v3/accounts/'
let apiUrl = 'https://api-fxpractice.oanda.com'
let streamUrl = 'https://stream-fxpractice.oanda.com'

let internalOrderCallback: (data: string) => void

async function validateResponse<T>(response: OandaResponseWrapper): Promise<T> {
  return response.errorCode !== undefined
    ? Promise.reject(Error(response.errorMessage))
    : (response as unknown as T)
}

function getStreamEndpoint(url: string, key: Key): Duplex {
  return got.stream({
    url: url,
    headers: {
      Authorization: `Bearer ${key.apiKey}`,
    },
    method: 'GET',
    isStream: true,
  })
}

// helper function to safely divide by 0
function safeDivide(numA: number, numB: number): number {
  return numB !== 0 ? numA / numB : 0
}

function createSubscriptionCallback(pairs: IndexedPair[], pairMap: Map<string, number>) {
  return async (tick: OandaTicker): Promise<void> => {
    if (tick.type === 'HEARTBEAT') return
    let pairIndex = pairMap.get(tick.instrument)
    if (pairIndex === undefined)
      return Promise.reject(Error(`Invalid pair encountered. ${tick.instrument}`))
    let ask = Number(tick.asks[0]?.price ?? pairs[pairIndex].ask ?? 0)
    let bid = Number(tick.bids[0]?.price ?? pairs[pairIndex].bid ?? 0)
    // let takerFee = safeDivide((bid ?? 0) - (ask ?? 0), bid ?? 0)
    pairs[pairIndex].bid = bid
    pairs[pairIndex].ask = ask
    // pairs[pairIndex].takerFee = takerFee
    // console.log({
    //   id: pairs[pairIndex].name,
    //   a: pairs[pairIndex].ask,
    //   b: pairs[pairIndex].bid,
    //   // fee: takerFee,
    // })
  }
}

function createOrderRequest(_token: string, order: OrderCreateRequest): string {
  return JSON.stringify({
    order: {
      type: 'MARKET',
      instrument: order.pair,
      positionFill: 'REDUCE_FIRST',
      timeInForce: 'FOK',
      units: (order.direction === 'buy' ? order.amount : -order.amount).toFixed(2),
    },
  } as OandaAddOrder)
}

let startSubscription = async (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  _wsExchange: unknown,
  key: Key
): Promise<unknown> => {
  // setup subscription callback and stream
  let callback = createSubscriptionCallback(pairs, pairMap)

  // create and register callback
  return getStreamEndpoint(
    `${streamUrl}${basePath}${key.accountId}/pricing/stream?instruments=` +
      pairs.map(p => p.name).join(','),
    key!
  ).on('data', (chunk: Buffer) =>
    chunk
      .toLocaleString()
      .split(/\r\n|\n\r|\n|\r/)
      .filter(d => d.startsWith('{"type"') && d.endsWith('}'))
      .forEach(d => callback(JSON.parse(d)))
  )
}

let getAvailablePairs = async (_apiExchange: unknown, key: Key): Promise<ExchangePair[]> => {
  let pairs: ExchangePair[] = (
    await validateResponse<OandaAccountInstruments>(
      await got
        .get({
          url: `${apiUrl}${basePath}${key.accountId}/instruments`,
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

  let prices = await validateResponse<OandaAccountPrices>(
    await got
      .get({
        url: `${apiUrl}${basePath}${key.accountId}/pricing?instruments=${pairs
          .map(p => p.name)
          .join(',')}`,
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

  for (let price of prices.prices) {
    let pair = pairs.find(p => p.name === price.instrument)!
    let ask = Number(price.bids[0].price)
    let bid = Number(price.asks[0].price)
    let takerFee = safeDivide((bid ?? 0) - (ask ?? 0), bid ?? 0)
    pair.ask = ask
    pair.bid = bid
    pair.takerFee = takerFee
  }

  return pairs
}

function setCallback(_sock: unknown, callback: (data: string) => void): unknown {
  return (internalOrderCallback = callback)
}

async function sendData(payload: string, _ws: unknown, key: Key): Promise<void> {
  return internalOrderCallback(
    JSON.stringify(
      validateResponse(
        await got
          .post({
            url: `${apiUrl}${basePath}${key.accountId}/orders`,
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
    )
  )
}
