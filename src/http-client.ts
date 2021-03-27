import got = require('got')

export let getJson = async <T>(url: string): Promise<T | Error> => {
  let result: T | Error
  try {
    let innerResult: T | undefined = await got.default(url).json<T>()
    if (innerResult !== undefined) result = innerResult
    else result = new Error('Failed to get back response from url: ' + url)
  } catch (e) {
    result = e
  }
  return result
}
