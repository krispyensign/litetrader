import winston = require('winston')
import { Logger } from 'winston'
import got = require('got')
import type { ExchangeName, OrdersExchangeDriver, TickerExchangeDriver } from './types'
import * as krakenTick from './kraken/tick'
import * as krakenOrder from './kraken/order'

export function selector(exchangeName: ExchangeName): [TickerExchangeDriver, OrdersExchangeDriver] {
  switch (exchangeName) {
    case 'kraken':
      return [krakenTick.getExchangeInterface(), krakenOrder.getExchangeInterface()]
    default:
      throw Error('Invalid exchange selected')
  }
}

export async function getJson<T>(url: string): Promise<T | Error> {
  let result: T | Error
  try {
    const innerResult: T | undefined = await got.default(url).json<T>()
    if (innerResult !== undefined) result = innerResult
    else result = new Error('Failed to get back response from url: ' + url)
  } catch (e) {
    result = e
  }
  return result
}

export function getLogger(serviceName: string): Logger {
  const myformat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} [${level}] [${serviceName}] : ${message} `
      if (metadata && !(Object.keys(metadata)?.length < 1 && metadata.constructor === Object)) {
        msg += JSON.stringify(metadata)
      }
      return msg
    }),
    logger = winston.createLogger({
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

  if (process.env.NODE_ENV !== 'production') {
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          myformat
        ),
      })
    )
  }
  return logger
}
