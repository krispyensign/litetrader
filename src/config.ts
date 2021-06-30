import * as kraken from './coinexchange/kraken.js'
import * as oanda from './forex/oanda.js'
import ccxt from 'ccxt'
import ccxws from 'ccxws'

const invalidExchange = (exchangeName: ExchangeName): Error =>
  Error(`Invalid exchange ${exchangeName} selected`)

export let getConnection: (key?: Key) => unknown
export let dropConnection: (conn: unknown) => void
export let getToken: (key: Key, nonce: number) => Promise<string>
export let sendData: (data: string, ws: unknown, key?: Key) => void
export let createOrderRequest: (token: string, order: OrderCreateRequest) => string

export const getExchangeApi = async (exchangeName: ExchangeName): Promise<ccxt.Exchange> =>
  exchangeName === 'kraken'
    ? new ccxt.kraken()
    : Promise.reject(Error('unknown exchange ' + exchangeName))

export const getExchangeWs = async (exchangeName: ExchangeName): Promise<ccxws.Exchange> =>
  exchangeName === 'kraken'
    ? new ccxws.Kraken()
    : Promise.reject(Error('unknown exchange ' + exchangeName))

export const closeExchangeWs = (ex: unknown): void => {
  if ((ex as ccxws.Exchange).close !== undefined) (ex as ccxws.Exchange).close()
}

export const setupAuthService = async (exchangeName: ExchangeName): Promise<void> => {
  switch (exchangeName) {
    case 'kraken':
      getConnection = kraken.getConnection
      dropConnection = kraken.dropConnection
      getToken = kraken.getToken
      sendData = kraken.sendData
      createOrderRequest = kraken.createOrderRequest
      break
    case 'oanda':
      getConnection = (): undefined => undefined
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      dropConnection = (_ws?: unknown): void => {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getToken = async (key: Key, _nonce: unknown): Promise<string> => key.apiKey
      sendData = oanda.sendData
      createOrderRequest = oanda.createOrderRequest
      break
    default:
      return Promise.reject(invalidExchange(exchangeName))
  }
}