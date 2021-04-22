import type { Key, ResponseWrapper, Token } from '../types/types'
import got from 'got'
import type { OptionsOfJSONResponseBody } from 'got'
import * as crypto from 'crypto'
import qs = require('qs')

let krakenTokenPath = '/0/private/GetWebSocketsToken'
let krakenApiUrl = 'https://api.kraken.com'

let makeAuthCall = async <T = object>(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<ResponseWrapper<T>> => {
  let signature = crypto
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

  let gotOptions: OptionsOfJSONResponseBody = {
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

  let response = await got.post(gotOptions).json<ResponseWrapper<T>>()

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

export let getToken = async (key: Key): Promise<string> => {
  let n = new Date().getTime() * 1000
  let requestData = {
    nonce: n,
  }

  let response = await makeAuthCall<Token>(
    krakenApiUrl + krakenTokenPath,
    qs.stringify(requestData),
    requestData.nonce,
    key
  )

  return response.result.token
}
