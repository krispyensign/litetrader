import winston = require('winston')
import { Logger } from 'winston'

export class LoggerFactoryService {
  public getLogger(serviceName: string): Logger {
    let myformat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} [${level}] [${serviceName}] : ${message} `
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
}
