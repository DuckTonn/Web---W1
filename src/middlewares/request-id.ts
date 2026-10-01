import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Augment Express Request interface with tracing 'id' property
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check incoming header X-Request-Id from client
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim() !== ''
      ? incomingId.trim()
      : crypto.randomUUID();

  // Attach requestId to request context and outgoing response header
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
