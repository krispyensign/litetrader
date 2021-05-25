import got from 'got'
import qs from 'qs'
import crypto from 'crypto'

const krakenTokenPath = '/0/private/GetWebSocketsToken'
const krakenApiUrl = 'https://api.kraken.com'
export const webSocketUrl = 'wss://ws-auth.kraken.com'

const isObject = (o: unknown): o is object => o !== null && o !== undefined && typeof o === 'object'

export const isStatusEvent = (event: unknown): event is StatusEvent =>
  !isObject(event)
    ? false
    : (event as StatusEvent).event !== undefined && (event as StatusEvent).reqid !== undefined

export const getReqId = (parsedEvent: unknown): string =>
  isStatusEvent(parsedEvent) ? parsedEvent.reqid?.toString() || '0' : '0'

export const createOrderRequest = (token: string, order: OrderCreateRequest): string =>
  JSON.stringify({
    ordertype: order.orderType,
    event: 'addOrder',
    pair: order.pair,
    token: token,
    type: order.direction,
    volume: order.amount.toFixed(20),
    validate: 'true',
    price: order.price?.toString(),
    userref: order.orderId,
  } as AddOrder)

export const cancelOrderRequest = (token: string, cancel: OrderCancelRequest): string =>
  JSON.stringify({
    event: 'cancelOrder',
    token: token,
    txid: [cancel.orderId],
  } as CancelOrder)

export const parseEvent = (eventData: string): string => eventData

type ResponseWrapper<T = object> = {
  readonly error: readonly string[]
  readonly result: T
}

const validateResponse = async <T>(response: ResponseWrapper<T>): Promise<T> =>
  response.error?.length > 0
    ? Promise.reject(
        new Error(
          response.error
            .filter(e => e.startsWith('E'))
            .map(e => e.substr(1))
            .join(',')
        )
      )
    : response.result

const makeAuthCall = async <T = object>(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<T> =>
  validateResponse(
    await got
      .post({
        url: url,
        headers: {
          'API-Key': key.apiKey,
          'API-Sign': crypto
            .createHmac('sha512', Buffer.from(key.apiPrivateKey, 'base64'))
            .update(
              '/0/private/GetWebSocketsToken' +
                crypto
                  .createHash('sha256')
                  .update(nonce + request)
                  .digest('binary' as crypto.BinaryToTextEncoding),
              'latin1'
            )
            .digest('base64'),
        },
        timeout: 50000,
        method: 'POST',
        responseType: 'json',
        body: request,
        isStream: false,
      })
      .json()
  )

export const getToken = async (key: Key, nonce: number): Promise<string> => {
  return (
    await makeAuthCall<Token>(
      krakenApiUrl + krakenTokenPath,
      qs.stringify({
        nonce,
      }),
      nonce,
      key
    )
  ).token
}
