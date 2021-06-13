// import * as kraken from './kraken/auth.js'
import * as coinbase from './coinbase.js'
import * as kraken from './kraken.js'

const invalidExchange = (exchangeName: ExchangeName): Error =>
  Error(`Invalid exchange ${exchangeName} selected`)

export let getConnection: (key?: Key) => unknown
export let dropConnection: (conn: unknown) => void
export let getToken: (key: Key, nonce: number) => Promise<string>
export let sendData: (data: string, ws: unknown) => void
export let createOrderRequest: (token: string, order: OrderCreateRequest) => string

export const setupAuthService = async (exchangeName: ExchangeName): Promise<void> => {
  switch (exchangeName) {
    case 'kraken':
      getConnection = kraken.getConnection
      dropConnection = kraken.dropConnection
      getToken = kraken.getToken
      sendData = kraken.sendData
      createOrderRequest = kraken.createOrderRequest
      break
    case 'coinbase':
      getConnection = coinbase.getConnection
      dropConnection = coinbase.dropConnection
      getToken = async (): Promise<string> => ''
      break
    default:
      return Promise.reject(invalidExchange(exchangeName))
  }
}
