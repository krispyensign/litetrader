import * as kraken from './kraken/auth.js'
import WebSocket from 'ws'

export type Connection = WebSocket

const invalidExchange = (exchangeName: ExchangeName): Error =>
  Error(`Invalid exchange ${exchangeName} selected`)

export let getConnection: () => Connection
export let dropConnection: (conn: Connection) => void
export let getToken: (key: Key, nonce: number) => Promise<string>
export let sendData: (data: string, ws: Connection) => void
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
    default:
      return Promise.reject(invalidExchange(exchangeName))
  }
}
