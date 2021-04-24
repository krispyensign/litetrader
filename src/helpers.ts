import * as winston from 'winston'
import type { Logger } from 'winston'
import * as krakenTick from './kraken/tick.js'
import * as krakenOrder from './kraken/order.js'
import type { ExchangeName, OrderModule, TickModule } from './types/types'

export let tickSelector = (exchangeName: ExchangeName): TickModule => {
  switch (exchangeName) {
    case 'kraken':
      return [
        krakenTick.createStopRequest,
        krakenTick.createTickSubRequest,
        krakenTick.getAvailablePairs,
        krakenTick.getWebSocketUrl,
        krakenTick.parseTick,
      ]
    default:
      throw Error('Invalid exchange selected')
  }
}

export let orderSelector = (exchangeName: ExchangeName): OrderModule => {
  switch (exchangeName) {
    case 'kraken':
      return [
        krakenOrder.cancelOrderRequest,
        krakenOrder.createOrderRequest,
        krakenOrder.getReqId,
        krakenOrder.getWebSocketUrl,
        krakenOrder.isStatusEvent,
        krakenOrder.parseEvent,
      ]
    default:
      throw Error('Invalid exchange selected')
  }
}

export let getLogger = (serviceName: string): Logger => {
  let myformat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] [${serviceName}] : ${message}`
    if (metadata && !(Object.keys(metadata)?.length < 1 && metadata.constructor === Object))
      msg += JSON.stringify(metadata)
    return msg
  })

  let logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      new winston.transports.File({
        filename: `logs/${serviceName}-error.log`,
        options: {
          level: 'error',
        },
      }),
      new winston.transports.File({ filename: `logs/${serviceName}-combined.log` }),
    ],
  })

  if (process.env.NODE_ENV !== 'production')
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          myformat
        ),
      })
    )
  return logger
}
