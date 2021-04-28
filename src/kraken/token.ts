import type { Key, ResponseWrapper, Token } from '../types/types'
import got from 'got'
import { createHmac, createHash } from 'crypto'
import qs from 'qs'
import { isError } from './common.js'

const krakenTokenPath = '/0/private/GetWebSocketsToken'
const krakenApiUrl = 'https://api.kraken.com'

const validateResponse = <T>(
  response: ResponseWrapper<T> | undefined
): ResponseWrapper<T> | Error =>
  // if there wasn't a response then bomb
  response === undefined
    ? new Error('Failed to get response back from exchange api!')
    : response.error?.length > 0
    ? new Error(
        response.error
          .filter(e => e.startsWith('E'))
          .map(e => e.substr(1))
          .join(',')
      )
    : response

const makeAuthCall = async <T = object>(
  url: string,
  request: string,
  nonce: number,
  key: Key
): Promise<ResponseWrapper<T> | Error> =>
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

const resolveCall = (res: ResponseWrapper<Token> | Error): string | Error =>
  isError(res) ? res : res.result.token

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
