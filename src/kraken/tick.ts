import type { PairPriceUpdate, Publication, Ticker } from '../types/types'
import { compareTypes, isKrakenErrorMessage } from './common.js'

const isTickerPayload = (payload: unknown): payload is Ticker =>
  compareTypes(payload, ['a', 'b', 'c', 'v', 'p', 't', 'l', 'h', 'o']) !== true
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
        isKrakenErrorMessage(event)
          ? Error(event.errorMessage)
          : // if is a publication and contains a ticker payload
          isPublication(event) && isTickerPayload(event[1])
          ? // then create a pairUpdate
            {
              tradeName: event[3],
              ask: event[1].a[0],
              bid: event[1].b[0],
            }
          : // else return string as is for logging
            tickData)(JSON.parse(tickData))
