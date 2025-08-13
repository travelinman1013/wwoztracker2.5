export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Configuration Error: ${message}`, context);
  }
}

export class SpotifyAPIError extends AppError {
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Spotify API Error: ${message}`, context);
  }
}

export class ScrapingError extends AppError {
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Scraping Error: ${message}`, context);
  }
}

export class ConsecutiveDuplicatesError extends AppError {
  readonly statusCode = 200;
  readonly isOperational = true;

  constructor(count: number) {
    super(`${count} consecutive duplicates found - playlist appears up to date`);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Validation Error: ${message}`, context);
  }
}
