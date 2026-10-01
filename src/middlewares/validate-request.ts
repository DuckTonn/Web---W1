import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

export interface RequestValidationSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

export interface ValidationErrorDetail {
  field: string;
  issue: string;
}

function extractIssues(zodError: ZodError): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  for (const issue of zodError.issues) {
    // 1. Strict mode: Unrecognized keys
    if (issue.code === 'unrecognized_keys') {
      const keys = (issue as any).keys as string[] | undefined;
      if (keys && keys.length > 0) {
        keys.forEach((key) => {
          details.push({
            field: key,
            issue: 'Unrecognized key(s) in object',
          });
        });
        continue;
      }
    }

    // 2. Field name mapping
    const field = issue.path && issue.path.length > 0 ? issue.path.join('.') : 'body';

    // 3. Clear, standardized message
    let message = issue.message;
    if (issue.code === 'invalid_type') {
      const expected = (issue as any).expected;
      const received = (issue as any).received;
      if (received === 'undefined') {
        message = `${field} is required`;
      } else if (expected && received) {
        message = `Expected ${expected}, received ${received}`;
      }
    }

    details.push({
      field,
      issue: message,
    });
  }

  return details;
}

export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allDetails: ValidationErrorDetail[] = [];

    // 1. Validate URL Params
    if (schemas.params) {
      const paramResult = schemas.params.safeParse(req.params);
      if (!paramResult.success) {
        allDetails.push(...extractIssues(paramResult.error));
      } else {
        req.params = paramResult.data as Record<string, string>;
      }
    }

    // 2. Validate Query Parameters
    if (schemas.query) {
      const queryResult = schemas.query.safeParse(req.query);
      if (!queryResult.success) {
        allDetails.push(...extractIssues(queryResult.error));
      } else {
        req.query = queryResult.data as Record<string, any>;
      }
    }

    // 3. Validate Request Body
    if (schemas.body) {
      const bodyResult = schemas.body.safeParse(req.body);
      if (!bodyResult.success) {
        allDetails.push(...extractIssues(bodyResult.error));
      } else {
        req.body = bodyResult.data;
      }
    }

    // If any validation failed, halt request immediately at boundary
    if (allDetails.length > 0) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        request_id: req.id,
        details: allDetails,
      });
      return;
    }

    next();
  };
}
