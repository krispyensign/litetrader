import * as winston from 'winston'
import type { Logger } from 'winston'
import * as krakenTick from './kraken/tick.js'
import * as krakenSetup from './kraken/setup.js'
import * as krakenOrder from './kraken/order.js'
import type { ExchangeName, OrderModule, TickModule } from './types/types'

export const isError = (err: unknown): err is Error =>
  typeof err === 'object' &&
  (err as Error).message !== undefined &&
  (err as Error).stack !== undefined

export const tickSelector = async (exchangeName: ExchangeName): Promise<TickModule> => {
  switch (exchangeName) {
    case 'kraken':
      return [
        krakenSetup.createStopRequest,
        krakenSetup.createTickSubRequest,
        krakenSetup.getAvailablePairs,
        krakenSetup.getWebSocketUrl,
        krakenTick.parseTick,
      ]
    default:
      return Promise.reject(new Error('Invalid exchange selected'))
  }
}

export const orderSelector = async (exchangeName: ExchangeName): Promise<OrderModule> => {
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
      return Promise.reject(new Error('Invalid exchange selected'))
  }
}

export const getLogger = (serviceName: string): Logger => {
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
          winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}] [${serviceName}] : ${message}`
            if (metadata && !(Object.keys(metadata)?.length < 1 && metadata.constructor === Object))
              msg += JSON.stringify(metadata)
            return msg
          })
        ),
      })
    )
  return logger
}
