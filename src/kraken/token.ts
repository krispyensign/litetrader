import type { Key, ResponseWrapper, Token } from '../types/types'
import got from 'got'
import type { OptionsOfJSONResponseBody } from 'got'
import { createHmac, createHash } from 'crypto'
import qs from 'qs'

const krakenTokenPath = '/0/private/GetWebSocketsToken'
const krakenApiUrl = 'https://api.kraken.com'

const makeAuthCall = async <T = object>(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<ResponseWrapper<T>> => {
  const signature = createHmac('sha512', Buffer.from(key.apiPrivateKey, 'base64'))
    .update(
      krakenTokenPath +
        createHash('sha256')
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
  if (response === undefined) throw new Error('Failed to get response back from exchange api!')

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

export const getToken = async (key: Key): Promise<string> => {
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
