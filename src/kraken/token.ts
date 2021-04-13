import { Key, ResponseWrapper, Token } from '../types'
import got, { OptionsOfJSONResponseBody } from 'got'
import * as crypto from 'crypto'
import qs = require('qs')

const krakenTokenPath = '/0/private/GetWebSocketsToken',
  krakenApiUrl = 'https://api.kraken.com'

export async function makeAuthCall<T = object>(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<ResponseWrapper<T>> {
  const signature = crypto
    .createHmac('sha512', Buffer.from(key.apiPrivateKey, 'base64'))
    .update(
      krakenTokenPath +
        crypto
          .createHash('sha256')
          .update(nonce + request)
          .digest('base64'),
      'latin1'
    )
    .digest('base64')

  const gotOptions: OptionsOfJSONResponseBody = {
    url: url,
    headers: {
      'API-Key': key.apiKey,
      'API-Sign': signature,
    },
    timeout: 50000,
    method: 'POST',
    responseType: 'json',
    body: request,
    isStream: false,
  }

  const response = await got.post(gotOptions).json<ResponseWrapper<T>>()

  // if there wasn't a response then bomb
  if (!response) throw new Error('Failed to get response back from exchange api!')

  // check if there was an error
  if (response.error?.length > 0) {
    throw new Error(
      response.error
        .filter(e => e.startsWith('E'))
        .map(e => e.substr(1))
        .join(',')
    )
  }

  return response
}

export async function getToken(key: Key): Promise<string> {
  const n = new Date().getTime() * 1000
  const requestData = {
    nonce: n,
  }

  const response = await makeAuthCall<Token>(
    krakenApiUrl + krakenTokenPath,
    qs.stringify(requestData),
    requestData.nonce,
    key
  )

  return response.result.token
}
