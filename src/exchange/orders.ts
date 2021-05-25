import * as kraken from './kraken.js'

export const orderSelector = async (exchangeName: ExchangeName): Promise<OrderModule> =>
  exchangeName === 'kraken'
    ? [
        kraken.cancelOrderRequest,
        kraken.createOrderRequest,
        kraken.getReqId,
        kraken.webSocketUrl,
        kraken.isStatusEvent,
        kraken.parseEvent,
        kraken.getToken,
      ]
    : Promise.reject(new Error('Invalid exchange selected'))
