import got from 'got'
import qs from 'qs'
import crypto from 'crypto'
import WebSocket from 'ws'

const tokenPath = '/0/private/GetWebSocketsToken'
const apiUrl = 'https://api.kraken.com'
const webSocketUrl = 'wss://ws-auth.kraken.com'

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

const validateResponse = async (response: TokenResponseWrapper): Promise<Token> =>
  response.error?.length > 0
    ? Promise.reject(
        Error(
          response.error
            .filter(e => e.startsWith('E'))
            .map(e => e.substr(1))
            .join(',')
        )
      )
    : response.result

const makeAuthCall = async (
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<Token> =>
  validateResponse(
    await got
      .post({
        url: url,
        headers: {
          'API-Key': key.apiKey,
          'API-Sign': crypto
            .createHmac('sha512', Buffer.from(key.apiPrivateKey, 'base64'))
            .update(
              tokenPath +
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

export const getToken = async (key: Key, nonce: number): Promise<string> =>
  (
    await makeAuthCall(
      apiUrl + tokenPath,
      qs.stringify({
        nonce,
      }),
      nonce,
      key
    )
  ).token

export const getConnection = (): WebSocket => {
  const sock = new WebSocket(webSocketUrl)
  sock.on('message', eventData => console.log(eventData.toLocaleString()))
  return sock
}

export const dropConnection = (ws: unknown): void => (ws as WebSocket).close()

export const sendData = (data: string, ws: unknown): void => (ws as WebSocket).send(data)
