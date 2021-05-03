import type { PairPriceUpdate, Publication, Ticker } from '../types/types'
import { compareTypes, isKrakenErrorMessage } from './common.js'

const isTickerPayload = (payload: unknown): payload is Ticker => {
  const result = compareTypes(payload, 'a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o')
  if (!result || typeof result === 'string') return false
  const tickerPayload = payload as Ticker
  return (
    typeof tickerPayload.a === 'object' &&
    tickerPayload.a.length > 0 &&
    typeof tickerPayload.b === 'object' &&
    tickerPayload.b.length > 0
  )
}

const isPublication = (event: unknown): event is Publication =>
  (event as Publication).length !== undefined && (event as Publication).length === 4

export const parseTick = (tickData?: string): string | PairPriceUpdate | Error => {
  // make sure we got something if not failure during ws message
  if (!tickData) return Error('TickData missing. Cannot parse.')

  // parse it
  const event: unknown = JSON.parse(tickData)
  if (event === undefined) return Error(`Failed to parse ${tickData}`)

  // check to make sure its not an error.  Something wrong with code itself
  // so need to hard error on this one
  if (isKrakenErrorMessage(event)) return Error(event.errorMessage)

  // if its not a publication (unlikely) return the tick as a string for logging
  if (!isPublication(event)) return tickData

  // split out the publication to the pair and the payload
  const pair = event[3]
  const payload = event[1]

  // check if the payload is a ticker if so then return back an update object
  if (isTickerPayload(payload))
    return {
      tradeName: pair,
      ask: payload.a[0],
      bid: payload.b[0],
    }

  // for now return all other publications as strings for logging
  return tickData
}
