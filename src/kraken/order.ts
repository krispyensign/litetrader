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
export { getExchangeInterface }

const krakenWsUrl = 'wss://ws-auth.kraken.com'

const getReqId = (parsedEvent: AddOrderStatus | CancelOrderStatus | SubscriptionStatus): string => {
  return parsedEvent.reqid?.toString() || '0'
}

const isStatusEvent = (
  event: unknown
): event is AddOrderStatus | CancelOrderStatus | SubscriptionStatus => {
  if (typeof event !== 'object') return false
  const typedEvent = event as AddOrderStatus | CancelOrderStatus | SubscriptionStatus
  return typedEvent?.event !== undefined && typedEvent.reqid !== undefined
}

const createOrderRequest = (token: string, order: OrderCreateRequest): AddOrder => ({
  ordertype: order.orderType,
  event: 'addOrder',
  pair: order.pair,
  token: token,
  type: order.direction,
  volume: order.amount.toFixed(20),
  validate: 'true',
  price: order.price,
})

const cancelOrderRequest = (token: string, cancel: OrderCancelRequest): CancelOrder => ({
  event: 'cancelOrder',
  token: token,
  txid: [cancel.orderId!],
})

const getExchangeInterface = (): OrdersExchangeDriver => ({
  getReqId: getReqId,
  isEvent: isStatusEvent,
  createOrderRequest: createOrderRequest,
  cancelOrderRequest: cancelOrderRequest,
  parseEvent: (eventData: string): string => eventData,
  getWebSocketUrl: (): string => krakenWsUrl,
})
