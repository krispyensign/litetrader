export type Token = {
  token: string
  expires: number
}

type TickerResponse = {
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
 * Publication: Ticker information on currency pair.
 */
export type Ticker = {
  /**
   * Ask
   */
  a: [number, number, number]
  /**
   * Bid
   */
  b: [number, number, number]
  /**
   * Close
   */
  c: [number, number]
  /**
   * Volume
   */
  v: [number, number]
  /**
   * Volume weighted average price
   */
  p: [number, number]
  /**
   * Number of trades
   */
  t: [number, number]
  /**
   * Low price
   */
  l: [number, number]
  /**
   * High price
   */
  h: [number, number]
  /**
   * Open price
   */
  o: [number, number]
}

/**
 * Container for public publications
 */
export type Publication = [
  number,
  (
    | {
        /**
         * Ask
         */
        a: [number, number, number]
        /**
         * Bid
         */
        b: [number, number, number]
        /**
         * Close
         */
        c: [number, number]
        /**
         * Volume
         */
        v: [number, number]
        /**
         * Volume weighted average price
         */
        p: [number, number]
        /**
         * Number of trades
         */
        t: [number, number]
        /**
         * Low price
         */
        l: [number, number]
        /**
         * High price
         */
        h: [number, number]
        /**
         * Open price
         */
        o: [number, number]
      }
    | [number, number, number, number, number, number, number, number, number]
    | [number, number, number, string, string, string][]
    | [number, number, number, number, number]
    | {
        /**
         * Array of price levels, ascending from best ask
         */
        as: [number, number, number][]
        /**
         * Array of price levels, descending from best bid
         */
        bs: [number, number, number][]
      }
    | (
        | {
            /**
             * Ask array of level updates
             */
            a: [number, number, number] | [number, number, number, string][]
            /**
             * Optional - Book checksum as a quoted unsigned 32-bit integer, present only within
             * the last update container in the message.
             */
            c: string
          }
        | {
            /**
             * Bid array of level updates
             */
            b: [number, number, number] | [number, number, number, string][]
            /**
             * Optional - Book checksum as a quoted unsigned 32-bit integer, present only within
             * the last update container in the message.
             */
            c: string
          }
      )
  ),
  number,
  string
]

export type AssetPair = {
  /**
   * alternate pair name
   */
  altname?: string
  /**
   * WebSocket pair name (if available)
   */
  wsname: string
  /**
   * asset class of base component
   */
  aclass_base?: string
  /**
   * asset id of base component
   */
  base: string
  /**
   * asset class of quote component
   */
  aclass_quote?: string
  /**
   * asset id of quote component
   */
  quote: string
  /**
   * volume lot size
   */
  lot?: string
  /**
   * scaling decimal places for pair
   */
  pair_decimals: number
  /**
   * scaling decimal places for volume
   */
  lot_decimals: number
  /**
   * amount to multiply lot volume by to get currency volume
   */
  lot_multiplier?: number
  /**
   * array of leverage amounts available when buying
   */
  leverage_buy?: number[]
  /**
   * array of leverage amounts available when selling
   */
  leverage_sell?: number[]
  /**
   * fee schedule array in [volume, percent fee] tuples
   */
  fees: [number, number][]
  /**
   * fee schedule array in [volume, percent fee] tuples (if on maker/taker)
   */
  fees_maker: [number, number][]
  /**
   * volume discount currency
   */
  fee_volume_currency?: string
  /**
   * margin call level
   */
  margin_call?: number
  /**
   * stop-out/liquidation margin level
   */
  margin_stop?: number
  /**
   * minimum order volume for pair
   */
  ordermin?: string
}
/**
 * Request. Cancel order or list of orders.
 */
export type CancelOrder = {
  event: 'cancelOrder'
  /**
   * Session token string
   */
  token: string
  /**
   * Optional - client originated ID reflected in response message
   */
  reqid?: number
  /**
   * Array of order IDs to be canceled. These can be user reference IDs.
   */
  txid: string[]
}

export type AddOrder = {
  event: 'addOrder'
  /**
   * Session token string
   */
  token: string
  /**
   * Optional - client originated ID reflected in response message
   */
  reqid?: number
  ordertype:
    | 'market'
    | 'limit'
    | 'stop-loss'
    | 'take-profit'
    | 'stop-loss-profit'
    | 'stop-loss-profit-limit'
    | 'stop-loss-limit'
    | 'take-profit-limit'
    | 'trailing-stop'
    | 'trailing-stop-limit'
    | 'stop-loss-and-limit'
    | 'settle-position'
  /**
   * type of order (buy/sell)
   */
  type: 'buy' | 'sell'
  pair: string
  /**
   * Optional dependent on order type - order price
   */
  price?: number
  /**
   * Optional dependent on order type - order secondary price
   */
  price2?: number
  /**
   * Order volume in lots
   */
  volume: string
  /**
   * amount of leverage desired (optional; default = none)
   */
  leverage?: number
  /**
   * Optional - comma delimited list of order flags. viqc = volume in quote currency
   * (not currently available), fcib = prefer fee in base currency, fciq = prefer fee in quote
   * currency, nompp = no market price protection, post = post only order
   * (available when ordertype = limit)
   */
  oflags?: string
  /**
   * Optional - scheduled start time. 0 = now (default) +<n> = schedule start time <n> seconds
   * from now <n> = unix timestamp of start time
   */
  starttm?: number
  /**
   * Optional - expiration time. 0 = no expiration (default) +<n> = expire <n> seconds from now <n>
   * = unix timestamp of expiration time
   */
  expiretm?: number
  /**
   * Optional - user reference ID (should be an integer in quotes)
   */
  userref?: string
  /**
   * Optional - validate inputs only; do not submit order (not currently available)
   */
  validate?: string
  /**
   * Optional - close order type.
   */
  'close[ordertype]'?: string
  /**
   * Optional - close order price.
   */
  'close[price]'?: number
  /**
   * Optional - close order secondary price.
   */
  'close[price2]'?: number
  /**
   * Optional - should be set to 'agree' by German residents in order to signify acceptance of the
   * terms of the Kraken Trading Agreement.
   */
  trading_agreement?: string
}

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
