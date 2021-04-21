import type {
  AddOrderStatus,
  CancelOrderStatus,
  OrderCancelRequest,
  OrderCreateRequest,
  SubscriptionStatus,
} from '../types'

let wsUrl = 'wss://ws-auth.kraken.com'

type StatusEvent = AddOrderStatus | CancelOrderStatus | SubscriptionStatus

export let getReqId = (parsedEvent: StatusEvent): string => parsedEvent.reqid?.toString() || '0'

export let isStatusEvent = (event: unknown): event is StatusEvent => {
  if (typeof event !== 'object') return false
  let typedEvent = event as StatusEvent
  return typedEvent?.event !== undefined && typedEvent.reqid !== undefined
}

export let createOrderRequest = (token: string, order: OrderCreateRequest): string =>
  JSON.stringify({
    ordertype: order.orderType,
    event: 'addOrder',
    pair: order.pair,
    token: token,
    type: order.direction,
    volume: order.amount.toFixed(20),
    validate: 'true',
    price: order.price,
  })

export let cancelOrderRequest = (token: string, cancel: OrderCancelRequest): string =>
  JSON.stringify({
    event: 'cancelOrder',
    token: token,
    txid: [cancel.orderId!],
  })

export let parseEvent = (eventData: string): string => eventData
export let getWebSocketUrl = (): string => wsUrl
