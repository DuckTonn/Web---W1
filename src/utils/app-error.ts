export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown[];

  constructor(statusCode: number, code: string, message: string, details?: unknown[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // Predefined factory methods for clean domain error throwing
  public static badRequest(code: string, message: string, details?: unknown[]): AppError {
    return new AppError(400, code, message, details);
  }

  public static notFound(code: string, message: string): AppError {
    return new AppError(404, code, message);
  }

  public static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }

  public static unprocessable(code: string, message: string): AppError {
    return new AppError(422, code, message);
  }

  public static internal(message: string = 'Internal server error'): AppError {
    return new AppError(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
