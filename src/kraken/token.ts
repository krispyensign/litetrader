import type { Key } from '../types'
import type { Token } from './types'
import got from 'got'
import qs from 'qs'
import crypto from 'crypto'
import { validateResponse } from './common.js'

const krakenTokenPath = '/0/private/GetWebSocketsToken'
const krakenApiUrl = 'https://api.kraken.com'

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
