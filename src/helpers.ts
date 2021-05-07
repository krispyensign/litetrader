import type { ExchangeName, OrderModule, TickModule } from './types/types'
import type { Logger } from 'winston'

import * as winston from 'winston'

import * as krakenTick from './kraken/tick.js'
import * as krakenSetup from './kraken/setup.js'
import * as krakenOrder from './kraken/order.js'

export const isError = (err: unknown): err is Error =>
  typeof err === 'object' &&
  (err as Error).message !== undefined &&
  (err as Error).stack !== undefined

export const tickSelector = async (exchangeName: ExchangeName): Promise<TickModule> =>
  exchangeName === 'kraken'
    ? [
        krakenSetup.createStopRequest,
        krakenSetup.createTickSubRequest,
        krakenSetup.getAvailablePairs,
        krakenSetup.webSocketUrl,
        krakenTick.parseTick,
      ]
    : Promise.reject(new Error('Invalid exchange selected'))

export const orderSelector = async (exchangeName: ExchangeName): Promise<OrderModule> =>
  exchangeName === 'kraken'
    ? [
        krakenOrder.cancelOrderRequest,
        krakenOrder.createOrderRequest,
        krakenOrder.getReqId,
        krakenOrder.webSocketUrl,
        krakenOrder.isStatusEvent,
        krakenOrder.parseEvent,
      ]
    : Promise.reject(new Error('Invalid exchange selected'))

export const getLogger = (serviceName: string): Logger =>
  winston.createLogger({
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
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ level, message, timestamp, ...metadata }) =>
            metadata && !(Object.keys(metadata)?.length < 1 && metadata.constructor === Object)
              ? `${timestamp} [${level}] [${serviceName}] : ${message}` + JSON.stringify(metadata)
              : `${timestamp} [${level}] [${serviceName}] : ${message}`
          )
        ),
      }),
    ],
  })
