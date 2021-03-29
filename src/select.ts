import { ExchangeName } from "exchange-models/exchange";
import type { OrdersExchangeDriver, TickerExchangeDriver } from "./types";
import * as krakenTick from './kraken/tick'
import * as krakenOrder from './kraken/order'

export let selector = (exchangeName: ExchangeName): [TickerExchangeDriver, OrdersExchangeDriver] =>  {
    switch (exchangeName) {
      case 'kraken':
        return [ krakenTick.getExchangeInterface(), krakenOrder.getExchangeInterface()]
        break
      default:
        throw Error('Invalid exchange selected')
    }
}