import type { OrderCancelRequest, OrderCreateRequest } from '../types'
import type { AddOrder, CancelOrder } from 'exchange-models/kraken'
import { isObject } from './common.js'

export type StatusEvent = AddOrderStatus | CancelOrderStatus | SubscriptionStatus

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

export const isStatusEvent = (event: unknown): event is StatusEvent =>
  !isObject(event)
    ? false
    : (event as StatusEvent).event !== undefined && (event as StatusEvent).reqid !== undefined

export const getReqId = (parsedEvent: unknown): string =>
  isStatusEvent(parsedEvent) ? parsedEvent.reqid?.toString() || '0' : '0'

export const createOrderRequest = (token: string, order: OrderCreateRequest): string =>
  JSON.stringify({
    ordertype: order.orderType,
    event: 'addOrder',
    pair: order.pair,
    token: token,
    type: order.direction,
    volume: order.amount.toFixed(20),
    validate: 'true',
    price: order.price,
    userref: order.orderId,
  } as AddOrder)

export const cancelOrderRequest = (token: string, cancel: OrderCancelRequest): string =>
  JSON.stringify({
    event: 'cancelOrder',
    token: token,
    txid: [cancel.orderId],
  } as CancelOrder)

export const parseEvent = (eventData: string): string => eventData
export const webSocketUrl = 'wss://ws-auth.kraken.com'
