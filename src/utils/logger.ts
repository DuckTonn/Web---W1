import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Redact sensitive security fields from all log streams
  redact: {
    paths: [
      'password',
      'token',
      '*.password',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
      'user.password',
      'body.password',
    ],
    remove: true,
  },
});
