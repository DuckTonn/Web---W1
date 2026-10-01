import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

export const httpLogger = pinoHttp({
  logger,
  // Link existing request-id
  genReqId: (req) => (req as any).id || (req.headers['x-request-id'] as string),
  customAttributeKeys: {
    reqId: 'req_id',
    responseTime: 'response_time_ms',
  },
  customProps: (req) => ({
    req_id: (req as any).id,
  }),
  // Clean serializers that avoid bloated logs and never expose sensitive data
  serializers: {
    req(req) {
      return {
        id: (req as any).id,
        method: req.method,
        url: req.url,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `HTTP ${req.method} ${req.url} -> ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `HTTP ${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`;
  },
});
