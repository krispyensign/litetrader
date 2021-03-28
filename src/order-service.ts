import WebSocket = require('ws')
import type { OrdersExchangeDriver, TickerConfiguration } from './types'
import { getExchangeInterface } from './kraken/order'
import type { AddOrderStatus, CancelOrderStatus, SubscriptionStatus } from 'exchange-models/kraken'
import { getLogger } from './logger'

export let orderService = async (
  conf: TickerConfiguration,
  orderWS: WebSocket,
  orderCallback: (
    reqid: string,
    arg: AddOrderStatus | CancelOrderStatus | SubscriptionStatus
  ) => void
): Promise<void> => {
  let logger = getLogger('OrderService')
  let exchangeDriver = ((): OrdersExchangeDriver => {
    switch (conf.exchangeName) {
      case 'kraken':
        return getExchangeInterface()
      default:
        throw Error('Invalid exchange selected')
    }
  })()

  // setup the message event
  orderWS.on('message', async (eventData: string) => {
    if (orderWS.readyState !== WebSocket.OPEN) return
    logger.info(eventData)

    // parse it
    let parsedEvent = JSON.parse(eventData)

    // check if its a status event.  if so then get the reqid for the topic
    if (exchangeDriver.isEvent(parsedEvent)) {
      logger.info(`event ${eventData}`)
      orderCallback(exchangeDriver.getReqId(parsedEvent), parsedEvent)
    }
  })

  // add shutdown hook for if running locally
  process.once(
    'SIGINT',
    async (): Promise<void> => {
      logger.info('Got shutdown')
      orderWS.close()
      logger.info('Shutdown complete')
    }
  )

  // wait for it to connect completely
  while (orderWS.readyState === 0) await new Promise(resolve => setTimeout(resolve, 100))
}
