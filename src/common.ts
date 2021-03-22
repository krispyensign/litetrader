import { ExchangeName } from 'exchange-models/exchange'

export interface Configuration {
  threshold: number
  wsUrl: string
  apiUrl: string
  exchangeName: ExchangeName
}

export let sleep = (ms: number): Promise<unknown> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
