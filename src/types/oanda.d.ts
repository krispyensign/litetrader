type OandaResponseWrapper = {
  errorCode?: string
  errorMessage?: string
  [key: string]: unknown
}

type OandaInstrument = {
  name: string
  type: 'CURRENCY' | 'CFD' | 'METAL'
  displayName: string
  pipLocation: number
  displayPrecision: number
  tradeUnitsPrecision: number
  minimumTradeSize: string
}

type OandaAccountInstruments = {
  instruments: OandaInstrument[]
}

type OandaMarketOrderRequest = {
  type: 'MARKET'
  instrument: string
  units: string
  timeInForce: 'IOC' | 'FOK'
  priceBound?: string
  positionFill: 'DEFAULT' | 'OPEN_ONLY' | 'REDUCE_FIRST' | 'REDUCE_ONLY'
  [key: string]: unknown
}

type OandaAddOrder = {
  order: OandaMarketOrderRequest
}

type PriceBucket = {
  price: string
  liquidity: number
}

type OandaTicker = {
  type: 'PRICE' | 'HEARTBEAT'
  time: string
  instrument: string
  tradeable: boolean
  bids: PriceBucket[]
  asks: PriceBucket[]
  closeoutBid: string
  closeoutAsk: string
}
