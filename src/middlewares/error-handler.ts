import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const rawId = req.id || req.headers['x-request-id'] || 'unknown';
  const requestId = typeof rawId === 'string' ? rawId : String(rawId);
  res.setHeader('X-Request-Id', requestId);

  // 1. Handled Operational Application Errors (AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      request_id: requestId,
      ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
    });
    return;
  }

  // 2. Body Parser JSON Syntax Error (Malformed JSON payload in request)
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON payload in request body',
      request_id: requestId,
    });
    return;
  }

  // 3. Unhandled Internal Server Errors (500)
  // Securely log complete error details and stack trace to server logger (Pino)
  logger.error(
    {
      req_id: requestId,
      err: {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      },
      req: {
        method: req.method,
        url: req.originalUrl || req.url,
      },
    },
    'Internal server error occurred'
  );

  // Strictly conform to Error Contract: Never leak stack trace, SQL query, or secrets in response
  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    request_id: requestId,
  });
}
