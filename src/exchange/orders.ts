import * as kraken from './kraken.js'

export const orderSelector = async (exchangeName: ExchangeName): Promise<OrderModule> =>
  exchangeName === 'kraken'
    ? [kraken.createOrderRequest, kraken.webSocketUrl, kraken.parseEvent, kraken.getToken]
    : Promise.reject(Error('Invalid exchange selected'))
