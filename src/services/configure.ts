import * as kraken from './kraken.js'
import * as crypto from './cryptodata.js'
import * as oanda from './oanda.js'
import ccxt from 'ccxt'
import ccxws from 'ccxws'

export let getConnection: (key: Key) => unknown
export let dropConnection: (conn: unknown) => void
export let getToken: (key: Key, nonce: number) => Promise<string>
export let sendData: (data: string, ws: unknown, key: Key) => void
export let createOrderRequest: (token: string, order: OrderCreateRequest) => string
export let stopSubscription: (pairs: IndexedPair[], wsExchange: unknown) => void
export let getAvailablePairs: (apiExchange: unknown, key: Key) => Promise<ExchangePair[]>
export let startSubscription: (
  pairs: IndexedPair[],
  pairMap: Map<string, number>,
  _wsExchange: unknown,
  key: Key
) => Promise<unknown>

export async function getExchangeApi(exchangeName: ExchangeName): Promise<unknown> {
  switch (exchangeName) {
    case 'kraken':
      return new ccxt.kraken()
    case 'oanda':
      return undefined
    default:
      return Promise.reject(Error('unknown exchange ' + exchangeName))
  }
}

export async function getExchangeWs(exchangeName: ExchangeName): Promise<unknown> {
  switch (exchangeName) {
    case 'kraken':
      return new ccxws.Kraken()
    case 'oanda':
      return undefined
    default:
      return Promise.reject(Error('unknown exchange ' + exchangeName))
  }
}

export function closeExchangeWs(ex: unknown): void {
  if (ex !== undefined && (ex as ccxws.Exchange).close !== undefined) (ex as ccxws.Exchange).close()
}

export async function configureService(exchangeName: ExchangeName): Promise<void> {
  switch (exchangeName) {
    case 'kraken':
      getConnection = kraken.getConnection
      dropConnection = kraken.dropConnection
      getToken = kraken.getToken
      sendData = kraken.sendData
      createOrderRequest = kraken.createOrderRequest
      startSubscription = crypto.startSubscription
      stopSubscription = crypto.stopSubscription
      getAvailablePairs = crypto.getAvailablePairs
      break
    case 'oanda':
      getConnection = (): undefined => undefined
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      dropConnection = (_ws?: unknown): void => {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      getToken = async (key: Key, _nonce: unknown): Promise<string> => key.apiKey
      sendData = oanda.sendData
      createOrderRequest = oanda.createOrderRequest
      startSubscription = oanda.startSubscription
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      stopSubscription = (_pairs: IndexedPair[], _wsExchange: unknown): void => {}
      getAvailablePairs = oanda.getAvailablePairs
      break
    default:
      return Promise.reject(Error('unknown exchange ' + exchangeName))
  }
}
