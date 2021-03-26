import { OrderCreate } from 'exchange-models/exchange'
import {
  AddOrder,
  AddOrderStatus,
  CancelOrderStatus,
  SubscriptionStatus,
} from 'exchange-models/kraken'
import { OrdersExchangeDriver } from '../types'

let getReqId = (parsedEvent: AddOrderStatus | CancelOrderStatus | SubscriptionStatus): string => {
  return parsedEvent.reqid?.toString() || '0'
}

let isStatusEvent = (
  event: unknown
): event is AddOrderStatus | CancelOrderStatus | SubscriptionStatus => {
  if (typeof event !== 'object') return false
  let typedEvent = event as AddOrderStatus | CancelOrderStatus | SubscriptionStatus
  return typedEvent?.event !== undefined && typedEvent.reqid !== undefined
}

let createOrderRequest = (token: string, order: OrderCreate): AddOrder => ({
  ordertype: order.orderType,
  event: 'addOrder',
  pair: order.pair,
  token: token,
  type: order.direction,
  volume: order.amount.toFixed(20),
  validate: 'true',
  price: order.price,
})

export let getExchangeInterface = (): OrdersExchangeDriver => ({
  getReqId: getReqId,
  isEvent: isStatusEvent,
  createOrderRequest: createOrderRequest,
})
