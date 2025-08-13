import winston from 'winston';
import { config } from '../config/index.js';

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: config.logging.level,
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          winston.format.errors({ stack: true }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
          })
        ),
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${level}] ${message}${metaStr}`;
              })
            ),
          }),
        ],
      });
    }

    return Logger.instance;
  }

  static info(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().info(message, meta);
  }

  static warn(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().warn(message, meta);
  }

  static error(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().error(message, meta);
  }

  static debug(message: string, meta?: Record<string, unknown>): void {
    Logger.getInstance().debug(message, meta);
  }

  static setLevel(level: string): void {
    Logger.getInstance().level = level;
  }
}

export const logger = Logger.getInstance();
