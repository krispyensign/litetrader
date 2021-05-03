import type { Key, Token } from '../types/types'
import type { ResponseWrapper } from '../types/kraken'
import got from 'got'
import qs from 'qs'
import { createHmac, createHash } from 'crypto'
import { isError } from '../helpers.js'
import { krakenApiUrl, krakenTokenPath, validateResponse } from './common.js'

const makeAuthCall = async <T = object>(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<T | Error> =>
  validateResponse(
    await got
      .post({
        url: url,
        headers: {
          'API-Key': key.apiKey,
          'API-Sign': createHmac('sha512', Buffer.from(key.apiPrivateKey, 'base64'))
            .update(
              '/0/private/GetWebSocketsToken' +
                createHash('sha256')
                  .update(nonce + request)
                  .digest('base64'),
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
      .json<ResponseWrapper<T>>()
  )

const resolveCall = (res: Token | Error): string | Error => (isError(res) ? res : res.token)

export const getToken = async (key: Key, nonce: number): Promise<string | Error> =>
  resolveCall(
    await makeAuthCall<Token>(
      krakenApiUrl + krakenTokenPath,
      qs.stringify({
        nonce,
      }),
      nonce,
      key
    )
  )
