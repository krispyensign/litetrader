import type { AssetPair } from 'exchange-models/kraken'
import type { Dictionary } from './types'

export type AssetPairsResponse = readonly (readonly [string, AssetPair])[]

export type ResponseWrapper<T = object> = {
  readonly error: readonly string[]
  readonly result: T
}

export type StatusEvent = AddOrderStatus | CancelOrderStatus | SubscriptionStatus
export type AssetTicksResponse = ResponseWrapper<Dictionary<TickerResponse>>

export type KrakenErrorMessage = {
  readonly errorMessage: string
}

export type TickerResponse = {
  /**
   * Ask
   */
  readonly a: readonly [number, number, number]
  /**
   * Bid
   */
  readonly b: readonly [number, number, number]
  /**
   * Close
   */
  readonly c: readonly [number, number]
  /**
   * Volume
   */
  readonly v: readonly [number, number]
  /**
   * Volume weighted average price
   */
  readonly p: readonly [number, number]
  /**
   * Number of trades
   */
  readonly t: readonly [number, number]
  /**
   * Low price
   */
  readonly l: readonly [number, number]
  /**
   * High price
   */
  readonly h: readonly [number, number]
  /**
   * Open price
   */
  readonly o: readonly [number, number]
}

/**
 * Response. Add new order.
 */
export type AddOrderStatus = {
  readonly event: 'addOrderStatus' | 'error'
  /**
   * Optional - client originated ID reflected in response message
   */
  readonly reqid?: number
  /**
   * Status. 'ok' or 'error'
   */
  readonly status: 'ok' | 'error'
  /**
   * order ID (if successful)
   */
  readonly txid: string
  /**
   * order description info (if successful)
   */
  readonly descr: string
  readonly pair: string
  /**
   * error message (if unsuccessful)
   */
  readonly errorMessage: string
}

export type CancelOrderStatus = {
  readonly event: 'cancelOrderStatus' | 'error'
  /**
   * Optional - client originated ID reflected in response message
   */
  readonly reqid?: number
  /**
   * Status. 'ok' or 'error'
   */
  readonly status: 'ok' | 'error'
  /**
   * error message (if unsuccessful)
   */
  readonly errorMessage?: string
}

export type SubscriptionStatus = {
  readonly event: 'subscriptionStatus' | 'error'
  /**
   * Optional - client originated ID reflected in response message
   */
  readonly reqid?: number
  readonly pair: string
  /**
   * Status of subscription
   */
  readonly status: 'subscribed' | 'unsubscribed' | 'error'
  readonly subscription: {
    /**
     * Optional - depth associated with book subscription in float of levels
     * each side, default 10. Valid Options are: 10, 25, 100, 500, 1000
     */
    readonly depth?: 10 | 25 | 100 | 500 | 1000
    /**
     * Optional - Time interval associated with ohlc subscription in minutes.
     * Default 1. Valid Interval values: 1|5|15|30|60|240|1440|10080|21600
     */
    readonly interval?: 1 | 5 | 15 | 30 | 60 | 240 | 1440 | 10080 | 21600
    /**
     * book|ohlc|openOrders|ownTrades|spread|ticker|trade|*, * for all available
     * channels depending on the connected environment
     */
    readonly name?:
      | 'book'
      | 'ohlc'
      | 'openOrders'
      | 'ownTrades'
      | 'spread'
      | 'ticker'
      | 'trade'
      | '*'
    /**
     * Optional - whether to send historical feed data snapshot upon
     * subscription (supported only for ownTrades subscriptions; default = true)
     */
    readonly snapshot?: boolean
    /**
     * Optional - base64-encoded authentication token for private-data endpoints
     */
    readonly token?: string
  }
  /**
   * Error message
   */
  readonly errorMessage: string
  /**
   * ChannelID associated with pair subscription
   */
  readonly channelID: number
  /**
   * Channel Name on successful subscription. For payloads 'ohlc' and 'book',
   * respective interval or depth will be added as suffix.
   */
  readonly channelName: number
}
