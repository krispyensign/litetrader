import type { KrakenErrorMessage, ResponseWrapper } from '../types/kraken.js'
import got from 'got'

// setup the global constants
export const krakenTickerPath = '/0/public/Ticker'
export const krakenPairsPath = '/0/public/AssetPairs'
export const krakenApiUrl = 'https://api.kraken.com'
export const krakenWsUrl = 'wss://ws.kraken.com'

export const getJson = async <T>(url: string): Promise<T | Error> => {
  try {
    return await got(url).json<T>()
  } catch (e) {
    return e
  }
}

export const validateResponse = <T>(response: ResponseWrapper<T> | undefined): T | Error =>
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
    : response.result

export const isKrakenErrorMessage = (err: unknown): err is KrakenErrorMessage =>
  typeof err === 'object' && (err as KrakenErrorMessage).errorMessage !== undefined

export const isObject = (o: unknown): o is object =>
  o !== null && o !== undefined && typeof o === 'object'

export const compareTypes = (o: unknown, ...propertyNames: string[]): boolean | string => {
  // check if object is undefined
  if (isObject(o)) {
    // loop through supplied propertynames
    for (const prop of propertyNames) {
      // if property is not in object then return that property
      if (!(prop in o)) return prop.toString()
    }
    // return true if all properties requested are on object
    return true
  }
  return false
}
