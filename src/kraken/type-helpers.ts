import type { AssetPair, Publication, Ticker } from '../types'
export { isTicker, isPublication, isKrakenPair, isLastTick, isError }

let compareTypes = <U>(o: object, ...propertyNames: (keyof U)[]): boolean | string | undefined => {
    // check if object is undefined
    if (!o) return undefined
    // loop through supplied propertynames
    for (let prop of propertyNames) {
      // if property is not in object then return that property
      if (!(prop in o)) return prop.toString()
    }
    // return true if all properties requested are on object
    return true
  },
  isTicker = (payload: object): payload is Ticker => {
    let result: string | boolean | undefined
    if (!payload) return false
    result = compareTypes<Ticker>(payload, 'a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o')
    if (!result || typeof result === 'string') return false
    return result
  },
  isPublication = (event: object): event is Publication => {
    return (event as Publication).length !== undefined && (event as Publication).length === 4
  },
  isKrakenPair = (pairName: string, pair?: Partial<AssetPair>): pair is AssetPair => {
    let result: string | boolean | undefined
    if (!pair) return false
    result = compareTypes(pair, 'wsname', 'base', 'quote', 'fees_maker', 'fees', 'pair_decimals')
    if (!result) throw Error(`Failed to correctly populate pair ${pairName}`)
    if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
    return true
  },
  isLastTick = (pairName: string, tick?: Partial<Ticker>): tick is Ticker => {
    let result: string | boolean | undefined
    if (!tick) return false
    result = compareTypes(tick, 'a', 'b', 't')
    if (!result) throw Error(`Failed to correctly populate tick ${pairName}.`)
    if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
    return true
  },
  isError = (err: unknown): err is Error => {
    return (
      typeof err === 'object' &&
      (err as Error).message !== undefined &&
      (err as Error).stack !== undefined
    )
  }
