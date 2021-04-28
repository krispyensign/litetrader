import { Dictionary, ResponseWrapper } from './types'

export type StatusEvent = AddOrderStatus | CancelOrderStatus | SubscriptionStatus
export type AssetTicksResponse = ResponseWrapper<Dictionary<TickerResponse>>

export type TickerResponse = {
  /**
   * Ask
   */
  a?: [number, number, number]
  /**
   * Bid
   */
  b?: [number, number, number]
  /**
   * Close
   */
  c?: [number, number]
  /**
   * Volume
   */
  v?: [number, number]
  /**
   * Volume weighted average price
   */
  p?: [number, number]
  /**
   * Number of trades
   */
  t?: [number, number]
  /**
   * Low price
   */
  l?: [number, number]
  /**
   * High price
   */
  h?: [number, number]
  /**
   * Open price
   */
  o?: [number, number]
}

/**
 * Response. Add new order.
 */
export type AddOrderStatus = {
  event: 'addOrderStatus' | 'error'
  /**
   * Optional - client originated ID reflected in response message
   */
  reqid?: number
  /**
   * Status. 'ok' or 'error'
   */
  status: 'ok' | 'error'
  /**
   * order ID (if successful)
   */
  txid: string
  /**
   * order description info (if successful)
   */
  descr: string
  pair: string
  /**
   * error message (if unsuccessful)
   */
  errorMessage: string
}

export type CancelOrderStatus = {
  event: 'cancelOrderStatus' | 'error'
  /**
   * Optional - client originated ID reflected in response message
   */
  reqid?: number
  /**
   * Status. 'ok' or 'error'
   */
  status: 'ok' | 'error'
  /**
   * error message (if unsuccessful)
   */
  errorMessage?: string
}

export interface SubscriptionStatus {
  event: 'subscriptionStatus' | 'error'
  /**
   * Optional - client originated ID reflected in response message
   */
  reqid?: number
  pair: string
  /**
   * Status of subscription
   */
  status: 'subscribed' | 'unsubscribed' | 'error'
  subscription: {
    /**
     * Optional - depth associated with book subscription in float of levels
     * each side, default 10. Valid Options are: 10, 25, 100, 500, 1000
     */
    depth?: 10 | 25 | 100 | 500 | 1000
    /**
     * Optional - Time interval associated with ohlc subscription in minutes.
     * Default 1. Valid Interval values: 1|5|15|30|60|240|1440|10080|21600
     */
    interval?: 1 | 5 | 15 | 30 | 60 | 240 | 1440 | 10080 | 21600
    /**
     * book|ohlc|openOrders|ownTrades|spread|ticker|trade|*, * for all available
     * channels depending on the connected environment
     */
    name?: 'book' | 'ohlc' | 'openOrders' | 'ownTrades' | 'spread' | 'ticker' | 'trade' | '*'
    /**
     * Optional - whether to send historical feed data snapshot upon
     * subscription (supported only for ownTrades subscriptions; default = true)
     */
    snapshot?: boolean
    /**
     * Optional - base64-encoded authentication token for private-data endpoints
     */
    token?: string
  }
  /**
   * Error message
   */
  errorMessage: string
  /**
   * ChannelID associated with pair subscription
   */
  channelID: number
  /**
   * Channel Name on successful subscription. For payloads 'ohlc' and 'book',
   * respective interval or depth will be added as suffix.
   */
  channelName: number
}
