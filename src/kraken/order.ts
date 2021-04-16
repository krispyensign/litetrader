import type {
  OrdersExchangeDriver,
  AddOrder,
  AddOrderStatus,
  CancelOrder,
  CancelOrderStatus,
  OrderCancelRequest,
  OrderCreateRequest,
  SubscriptionStatus,
} from '../types'
import { getToken } from './token'

let krakenWsUrl = 'wss://ws-auth.kraken.com'

let getReqId = (parsedEvent: AddOrderStatus | CancelOrderStatus | SubscriptionStatus): string =>
  parsedEvent.reqid?.toString() || '0'

let isStatusEvent = (
  event: unknown
): event is AddOrderStatus | CancelOrderStatus | SubscriptionStatus => {
  if (typeof event !== 'object') return false
  let typedEvent = event as AddOrderStatus | CancelOrderStatus | SubscriptionStatus
  return typedEvent?.event !== undefined && typedEvent.reqid !== undefined
}

let createOrderRequest = (token: string, order: OrderCreateRequest): AddOrder => ({
  ordertype: order.orderType,
  event: 'addOrder',
  pair: order.pair,
  token: token,
  type: order.direction,
  volume: order.amount.toFixed(20),
  validate: 'true',
  price: order.price,
})

let cancelOrderRequest = (token: string, cancel: OrderCancelRequest): CancelOrder => ({
  event: 'cancelOrder',
  token: token,
  txid: [cancel.orderId!],
})

export let getExchangeInterface = (): OrdersExchangeDriver => ({
  getReqId: getReqId,
  isEvent: isStatusEvent,
  createOrderRequest: createOrderRequest,
  cancelOrderRequest: cancelOrderRequest,
  parseEvent: (eventData: string): string => eventData,
  getWebSocketUrl: (): string => krakenWsUrl,
  getToken: getToken,
})
