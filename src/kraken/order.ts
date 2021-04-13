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
export { getExchangeInterface }

const krakenWsUrl = 'wss://ws-auth.kraken.com'

function getReqId(parsedEvent: AddOrderStatus | CancelOrderStatus | SubscriptionStatus): string {
  return parsedEvent.reqid?.toString() || '0'
}

function isStatusEvent(
  event: unknown
): event is AddOrderStatus | CancelOrderStatus | SubscriptionStatus {
  if (typeof event !== 'object') return false
  const typedEvent = event as AddOrderStatus | CancelOrderStatus | SubscriptionStatus
  return typedEvent?.event !== undefined && typedEvent.reqid !== undefined
}

function createOrderRequest(token: string, order: OrderCreateRequest): AddOrder {
  return {
    ordertype: order.orderType,
    event: 'addOrder',
    pair: order.pair,
    token: token,
    type: order.direction,
    volume: order.amount.toFixed(20),
    validate: 'true',
    price: order.price,
  }
}

function cancelOrderRequest(token: string, cancel: OrderCancelRequest): CancelOrder {
  return {
    event: 'cancelOrder',
    token: token,
    txid: [cancel.orderId!],
  }
}

function getExchangeInterface(): OrdersExchangeDriver {
  return {
    getReqId: getReqId,
    isEvent: isStatusEvent,
    createOrderRequest: createOrderRequest,
    cancelOrderRequest: cancelOrderRequest,
    parseEvent: (eventData: string): string => eventData,
    getWebSocketUrl: (): string => krakenWsUrl,
    getToken: getToken,
  }
}
