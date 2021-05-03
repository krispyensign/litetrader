import type { AddOrder, CancelOrder, OrderCancelRequest, OrderCreateRequest } from '../types/types'
import type { StatusEvent } from '../types/kraken'

export let isStatusEvent = (event: unknown): event is StatusEvent =>
  typeof event !== 'object'
    ? false
    : (event as StatusEvent).event !== undefined && (event as StatusEvent).reqid !== undefined

export let getReqId = (parsedEvent: unknown): string =>
  isStatusEvent(parsedEvent) ? parsedEvent.reqid?.toString() || '0' : '0'

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
    userref: order.orderId,
  } as AddOrder)

export let cancelOrderRequest = (token: string, cancel: OrderCancelRequest): string =>
  JSON.stringify({
    event: 'cancelOrder',
    token: token,
    txid: [cancel.orderId],
  } as CancelOrder)

export let parseEvent = (eventData: string): string => eventData
export let getWebSocketUrl = (): string => 'wss://ws-auth.kraken.com'
