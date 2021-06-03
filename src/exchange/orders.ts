import * as kraken from './kraken.js'

export const orderSelector = async (exchangeName: ExchangeName): Promise<OrderModule> =>
  exchangeName === 'kraken'
    ? [
        kraken.createOrderRequest,
        kraken.getToken,
        kraken.getConnection,
        kraken.dropConnection,
        kraken.sendData,
      ]
    : Promise.reject(Error('Invalid exchange selected'))
