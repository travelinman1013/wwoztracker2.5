import { Logger } from './logger.js';
import { AppError, ConfigurationError } from '../types/errors.js';

export class ErrorHandler {
  static handle(error: unknown): void {
    if (error instanceof AppError) {
      Logger.error(error.message, {
        name: error.name,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        context: error.context,
        stack: error.stack,
      });

      // Exit for non-operational errors
      if (!error.isOperational) {
        process.exit(1);
      }
    } else if (error instanceof Error) {
      Logger.error(`Unexpected error: ${error.message}`, {
        name: error.name,
        stack: error.stack,
      });
      process.exit(1);
    } else {
      Logger.error('Unknown error occurred', { error });
      process.exit(1);
    }
  }

  static handleAsync(fn: (...args: any[]) => Promise<any>) {
    return (...args: any[]) => {
      const result = fn(...args);
      if (result && typeof result.catch === 'function') {
        result.catch(ErrorHandler.handle);
      }
      return result;
    };
  }

  static setupGlobalHandlers(): void {
    process.on('uncaughtException', (error) => {
      Logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      Logger.error('Unhandled Rejection:', { reason });
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      Logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      Logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });
  }

  static validateEnvironment(): void {
    const requiredEnvVars = [
      'SPOTIFY_CLIENT_ID',
      'SPOTIFY_CLIENT_SECRET',
      'SPOTIFY_REFRESH_TOKEN',
      'SPOTIFY_USER_ID',
    ];

    const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

    if (missing.length > 0) {
      throw new ConfigurationError(
        `Missing required environment variables: ${missing.join(', ')}`,
        { missingVars: missing }
      );
    }
  }
}
