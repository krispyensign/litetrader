import { LoggerFactoryService } from 'socket-comms-libs'
import WebSocket from 'ws'
import type { OrdersExchangeDriver, TickerConfiguration } from './types'
import { getExchangeInterface } from './kraken/order'
import { AddOrderStatus, CancelOrderStatus, SubscriptionStatus } from 'exchange-models/kraken'

export let orderService = async (
  conf: TickerConfiguration,
  orderWS: WebSocket,
  orderCallback: (
    reqid: string,
    arg: AddOrderStatus | CancelOrderStatus | SubscriptionStatus
  ) => void
): Promise<void> => {
  let logger = new LoggerFactoryService().getLogger('OrderService')
  let sleep = (ms: number): Promise<unknown> => new Promise(resolve => setTimeout(resolve, ms))
  let isRunning = true
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
    if (!isRunning) return
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
      isRunning = false
      orderWS.close()
      logger.info('Shutdown complete')
    }
  )

  // wait for it to connect completely
  while (orderWS.readyState === 0) await sleep(100)
  logger.info('Socket ready state: ' + orderWS.readyState)
}
