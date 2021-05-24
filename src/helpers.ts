import type {
  ExchangeName,
  ExchangePair,
  Key,
  OrderCancelRequest,
  OrderCreateRequest,
  PairPriceUpdate,
} from './types'
import type { Logger } from 'winston'

import * as winston from 'winston'

import * as krakenTick from './kraken/tick.js'
import * as krakenOrder from './kraken/order.js'
import * as krakenToken from './kraken/token.js'
import * as generic from './generic/setup.js'

type TickModule = readonly [
  (pairs: readonly string[]) => string,
  (pairs: readonly string[]) => string,
  (threshold?: number) => Promise<readonly ExchangePair[]>,
  string,
  (tickData: string) => string | PairPriceUpdate | Error
]

type OrderModule = readonly [
  (token: string, cancel: OrderCancelRequest) => string,
  (token: string, order: OrderCreateRequest) => string,
  (parsedEvent: unknown) => string,
  string,
  (event: unknown) => boolean,
  (eventData: string) => string,
  (key: Key, nonce: number) => Promise<string>
]

export const isError = (err: unknown): err is Error =>
  typeof err === 'object' &&
  (err as Error).message !== undefined &&
  (err as Error).stack !== undefined

export const tickSelector = async (exchangeName: ExchangeName): Promise<TickModule> =>
  exchangeName === 'kraken'
    ? [
        krakenTick.createStopRequest,
        krakenTick.createTickSubRequest,
        generic.getAvailablePairs,
        krakenTick.webSocketUrl,
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
        krakenToken.getToken,
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
