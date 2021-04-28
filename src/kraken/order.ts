import type { AddOrder, CancelOrder, OrderCancelRequest, OrderCreateRequest } from '../types/types'
import type { StatusEvent } from '../types/kraken'

export const isStatusEvent = (event: unknown): event is StatusEvent => {
  if (typeof event !== 'object') return false
  const typedEvent = event as StatusEvent
  return typedEvent?.event !== undefined && typedEvent.reqid !== undefined
}

export const getReqId = (parsedEvent: unknown): string => {
  if (isStatusEvent(parsedEvent)) return parsedEvent.reqid?.toString() || '0'
  return '0'
}

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
export const getWebSocketUrl = (): string => 'wss://ws-auth.kraken.com'
