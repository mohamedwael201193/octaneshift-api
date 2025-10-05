import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  timestamp: string;
  requestId?: string;
}

export class APIError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly title: string;
  public readonly detail?: string;

  constructor(
    status: number,
    title: string,
    detail?: string,
    type?: string
  ) {
    super(detail || title);
    this.status = status;
    this.title = title;
    this.detail = detail ?? undefined;
    this.type = type || `https://httpstatuses.com/${status}`;
    this.name = 'APIError';

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class ValidationError extends APIError {
  constructor(detail: string) {
    super(400, 'Validation Error', detail, 'about:blank#validation-error');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(404, 'Not Found', `${resource} not found`, 'about:blank#not-found');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends APIError {
  constructor(detail?: string) {
    super(429, 'Too Many Requests', detail || 'Rate limit exceeded', 'about:blank#rate-limit');
    this.name = 'RateLimitError';
  }
}

/**
 * Global error handler middleware
 * Converts all errors to problem+json format (RFC 7807)
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}`;
  
  let errorResponse: ErrorResponse;

  if (error instanceof APIError) {
    // Handle our custom API errors
    errorResponse = {
      type: error.type,
      title: error.title,
      status: error.status,
      ...(error.detail && { detail: error.detail }),
      instance: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId
    };

    logger.warn({
      error: {
        name: error.name,
        message: error.message,
        status: error.status,
        stack: error.stack
      },
      req: {
        method: req.method,
        url: req.originalUrl,
        userIp: (req as any).userIp,
        userAgent: req.headers['user-agent']
      },
      requestId
    }, 'API error occurred');

  } else if (error.name === 'ZodError') {
    // Handle Zod validation errors
    const zodError = error as any;
    const validationDetails = zodError.errors?.map((err: any) => 
      `${err.path.join('.')}: ${err.message}`
    ).join(', ') || 'Validation failed';

    errorResponse = {
      type: 'about:blank#validation-error',
      title: 'Validation Error',
      status: 400,
      detail: `Invalid request data: ${validationDetails}`,
      instance: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId
    };

    logger.warn({
      error: {
        name: 'ZodValidationError',
        issues: zodError.errors
      },
      req: {
        method: req.method,
        url: req.originalUrl,
        userIp: (req as any).userIp
      },
      requestId
    }, 'Validation error occurred');

  } else {
    // Handle unexpected errors
    const isDevelopment = (process as any).env?.NODE_ENV === 'development';
    errorResponse = {
      type: 'about:blank#internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: isDevelopment ? error.message : 'An unexpected error occurred',
      instance: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId
    };

    logger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      req: {
        method: req.method,
        url: req.originalUrl,
        userIp: (req as any).userIp,
        userAgent: req.headers['user-agent']
      },
      requestId
    }, 'Unexpected error occurred');
  }

  // Set the response status and content type
  res.status(errorResponse.status);
  res.setHeader('Content-Type', 'application/problem+json');
  
  // Send the error response
  res.json(errorResponse);
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ErrorResponse = {
    type: 'about:blank#not-found',
    title: 'Not Found',
    status: 404,
    detail: `Cannot ${req.method} ${req.originalUrl}`,
    instance: req.originalUrl,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] as string || `req_${Date.now()}`
  };

  logger.warn({
    req: {
      method: req.method,
      url: req.originalUrl,
      userIp: (req as any).userIp
    }
  }, 'Route not found');

  res.status(404);
  res.setHeader('Content-Type', 'application/problem+json');
  res.json(errorResponse);
}