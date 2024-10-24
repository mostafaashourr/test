import * as os from 'os';
import * as path from 'path';
import * as winston from 'winston';

interface Options {
  logLevel: winston.LoggerOptions['level'];
  logFileName: string;
  logPath: string;
}

const logFormat = winston.format.printf(info => {
  let message = `${info.timestamp} ${os.hostname()} `;
  message += `Logging ${info.level} [${info.context ?? info.serviceName}] (${process.pid}) `;
  if (info.requestId) message += `${info.requestId} `;
  if (info.prefix) message += `${info.prefix} `;
  message += info.stack || info.message;
  return message;
});

export default function logger(options: Options) {
  return winston.createLogger({
    level: options.logLevel,
    exitOnError: false,
    defaultMeta: {
      serviceName: 'TOBiMiddleware',
    },
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss,SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        level: options.logLevel,
        format: winston.format.combine(winston.format.colorize({ level: true }), logFormat),
      }),
      new winston.transports.File({
        level: options.logLevel,
        filename: path.join(process.cwd(), '..', '..', options.logPath, `${options.logFileName}.log`),
        format: logFormat,
      }),
    ],
  });
}
