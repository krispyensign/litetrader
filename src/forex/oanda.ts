import got from 'got'

const orderPath = '/0/private/GetWebSocketsToken'
const instrumentsPath = '/v3/accounts/'
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

export const getAvailablePairs = async (key: Key): Promise<ExchangePair[]> =>
  (
    await getAuthEndpoint<OandaAccountInstruments>(
      `${apiUrl}${instrumentsPath}/${key.accountId}/instruments`,
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
  internalOrderCallback(JSON.stringify(await postAuthEndpoint(orderPath, payload, key!)))
