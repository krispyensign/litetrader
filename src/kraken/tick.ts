import type { PairPriceUpdate, Publication, Ticker } from '../types/types'
import { compareTypes, isKrakenErrorMessage } from './common.js'

const isTickerPayload = (payload: unknown): payload is Ticker =>
  compareTypes(payload, 'a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o') !== true
    ? false
    : typeof (payload as Ticker).a === 'object' &&
      (payload as Ticker).a.length > 0 &&
      typeof (payload as Ticker).b === 'object' &&
      (payload as Ticker).b.length > 0

const isPublication = (event: unknown): event is Publication =>
  (event as Publication).length !== undefined && (event as Publication).length === 4

export const parseTick = (tickData?: string): string | PairPriceUpdate | Error =>
  tickData === undefined
    ? Error('TickData missing. Cannot parse.')
    : ((event): string | Error | PairPriceUpdate =>
        // check to make sure its not an error.  Something wrong with code itself
        // so need to hard error on this one
        isKrakenErrorMessage(event)
          ? Error(event.errorMessage)
          : // if its not a publication (unlikely) return the tick as a string for logging
          !isPublication(event)
          ? tickData
          : // check if the payload is a ticker if so then return back an update object
          isTickerPayload(event[1])
          ? {
              tradeName: event[3],
              ask: event[1].a[0],
              bid: event[1].b[0],
            }
          : // for now return all other publications as strings for logging
            tickData)(JSON.parse(tickData))
