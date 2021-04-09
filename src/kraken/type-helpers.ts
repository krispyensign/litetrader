import type { AssetPair, Publication, Ticker } from '../types'

function compareTypes<U>(o: object, ...propertyNames: (keyof U)[]): boolean | string | undefined {
  // check if object is undefined
  if (!o) return undefined
  // loop through supplied propertynames
  for (const prop of propertyNames) {
    // if property is not in object then return that property
    if (!(prop in o)) return prop.toString()
  }
  // return true if all properties requested are on object
  return true
}

export function isTicker(payload: object): payload is Ticker {
  if (!payload) return false
  const result = compareTypes<Ticker>(payload, 'a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o')
  if (!result || typeof result === 'string') return false
  return result
}

export function isPublication(event: object): event is Publication {
  return (event as Publication).length !== undefined && (event as Publication).length === 4
}

export function isKrakenPair(pairName: string, pair?: Partial<AssetPair>): pair is AssetPair {
  if (!pair) return false
  const result = compareTypes(
    pair,
    'wsname',
    'base',
    'quote',
    'fees_maker',
    'fees',
    'pair_decimals'
  )
  if (!result) throw Error(`Failed to correctly populate pair ${pairName}`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

export function isLastTick(pairName: string, tick?: Partial<Ticker>): tick is Ticker {
  if (!tick) return false
  const result = compareTypes(tick, 'a', 'b', 't')
  if (!result) throw Error(`Failed to correctly populate tick ${pairName}.`)
  if (typeof result === 'string') throw Error(`Missing resource ${result} on pair ${pairName}.`)
  return true
}

export function isError(err: unknown): err is Error {
  return (
    typeof err === 'object' &&
    (err as Error).message !== undefined &&
    (err as Error).stack !== undefined
  )
}
