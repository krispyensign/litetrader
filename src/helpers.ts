import winston = require('winston')
import type { Logger } from 'winston'
import type { ExchangeName } from './types'
import * as krakenTick from './kraken/tick'
import * as krakenOrder from './kraken/order'

export let tickSelector = (exchangeName: ExchangeName): typeof krakenTick => {
  switch (exchangeName) {
    case 'kraken':
      return krakenTick
    default:
      throw Error('Invalid exchange selected')
  }
}

export let orderSelector = (exchangeName: ExchangeName): typeof krakenOrder => {
  switch (exchangeName) {
    case 'kraken':
      return krakenOrder
    default:
      throw Error('Invalid exchange selected')
  }
}

export let getLogger = (serviceName: string): Logger => {
  let myformat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] [${serviceName}] : ${message}`
    if (metadata && !(Object.keys(metadata)?.length < 1 && metadata.constructor === Object)) {
      msg += JSON.stringify(metadata)
    }
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
