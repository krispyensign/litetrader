import got from 'got'

type ResponseWrapper<T = object> = {
  readonly error: readonly string[]
  readonly result: T
}

type KrakenErrorMessage = {
  readonly errorMessage: string
}

export const validateResponse = async <T>(response: ResponseWrapper<T>): Promise<T> =>
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

export const unwrapJson = async <T>(url: string): Promise<T> =>
  validateResponse(await got(url).json<ResponseWrapper<T>>())

export const isKrakenErrorMessage = (err: unknown): err is KrakenErrorMessage =>
  typeof err === 'object' && (err as KrakenErrorMessage).errorMessage !== undefined

export const isObject = (o: unknown): o is object =>
  o !== null && o !== undefined && typeof o === 'object'

export const compareTypes = (o: unknown, propertyNames: readonly string[]): boolean | string =>
  // check if object is undefined
  !isObject(o) || o === undefined
    ? false
    : propertyNames.every(prop => prop in (o as object))
    ? true
    : propertyNames.find(prop => !(prop in (o as object)))!
