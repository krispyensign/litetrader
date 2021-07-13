import got from 'got'
import qs from 'qs'
import crypto from 'crypto'
import WebSocket from 'ws'
export { createOrderRequest, getToken, getConnection, setCallback, dropConnection, sendData }

let tokenPath = '/0/private/GetWebSocketsToken'
let apiUrl = 'https://api.kraken.com'
let webSocketUrl = 'wss://ws-auth.kraken.com'

async function validateResponse(response: KrakenTokenResponseWrapper): Promise<KrakenToken> {
  return response.error?.length > 0
    ? Promise.reject(
        Error(
          response.error
            .filter(e => e.startsWith('E'))
            .map(e => e.substr(1))
            .join(',')
        )
      )
    : response.result
}

async function makeAuthCall(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<KrakenToken> {
  return validateResponse(
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
}

function createOrderRequest(token: string, order: OrderCreateRequest): string {
  return JSON.stringify({
    ordertype: order.orderType,
    event: 'addOrder',
    pair: order.pair,
    token: token,
    type: order.direction,
    volume: order.amount.toFixed(8),
    validate: 'true',
    price: order.price?.toString(),
    userref: order.orderId,
  } as KrakenAddOrder)
}

async function getToken(key: Key, nonce: number): Promise<string> {
  return (
    await makeAuthCall(
      apiUrl + tokenPath,
      qs.stringify({
        nonce,
      }),
      nonce,
      key
    )
  ).token
}

function getConnection(): WebSocket {
  return new WebSocket(webSocketUrl)
}

function setCallback(sock: unknown, callback: (data: string) => void): WebSocket {
  return (sock as WebSocket).on('message', callback)
}

function dropConnection(ws: unknown): void {
  return (ws as WebSocket).close()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sendData(data: string, ws: unknown, _key?: Key): void {
  return (ws as WebSocket).send(data)
}
