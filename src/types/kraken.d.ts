type Token = {
  token: string
  expires: number
}

type TokenResponseWrapper = {
  readonly error: readonly string[]
  readonly result: Token
}

type CancelOrder = {
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

type AddOrder = {
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

  /**
   * Optional - GTC, IOC, GTD
   */
  timeinforce?: 'GTC' | 'IOC' | 'GTD'
}

type StatusEvent = AddOrderStatus | CancelOrderStatus | SubscriptionStatus

type AddOrderStatus = {
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

type CancelOrderStatus = {
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

type SubscriptionStatus = {
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
