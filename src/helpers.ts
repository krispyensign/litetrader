import * as winston from 'winston'
import type { Logger } from 'winston'
import * as krakenTick from './kraken/tick.js'
import * as krakenOrder from './kraken/order.js'
import type { ExchangeName, OrderModule, TickModule } from './types/types'

export const isError = (err: unknown): err is Error =>
  typeof err === 'object' &&
  (err as Error).message !== undefined &&
  (err as Error).stack !== undefined

export const tickSelector = (exchangeName: ExchangeName): TickModule | Error => {
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
      return Error('Invalid exchange selected')
  }
}

export const orderSelector = (exchangeName: ExchangeName): OrderModule  | Error => {
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
      return Error('Invalid exchange selected')
  }
}

export const getLogger = (serviceName: string): Logger => {
  const myformat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] [${serviceName}] : ${message}`
    if (metadata && !(Object.keys(metadata)?.length < 1 && metadata.constructor === Object))
      msg += JSON.stringify(metadata)
    return msg
  })

  const logger = winston.createLogger({
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
