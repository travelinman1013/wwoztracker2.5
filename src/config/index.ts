import dotenv from 'dotenv';
import { AppConfigSchema, type ValidatedAppConfig } from './schema.js';
import { ConfigurationError } from '../types/errors.js';

dotenv.config();

function createConfig(): ValidatedAppConfig {
  const rawConfig = {
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
      refreshToken: process.env.SPOTIFY_REFRESH_TOKEN || '',
      userId: process.env.SPOTIFY_USER_ID || '',
    },
    wwoz: {
      playlistUrl: process.env.WWOZ_PLAYLIST_URL || 'https://wwoz.org/programs/playlists',
      scrapeInterval: parseInt(process.env.SCRAPE_INTERVAL_SECONDS || '300', 10),
      timeout: parseInt(process.env.WWOZ_TIMEOUT_MS || '30000', 10),
    },
    rateLimit: {
      spotify: {
        minTime: parseInt(process.env.SPOTIFY_RATE_LIMIT_MIN_TIME || '250', 10),
        maxConcurrent: parseInt(process.env.SPOTIFY_RATE_LIMIT_MAX_CONCURRENT || '1', 10),
      },
      wwoz: {
        minTime: parseInt(process.env.WWOZ_RATE_LIMIT_MIN_TIME || '1000', 10),
        maxConcurrent: parseInt(process.env.WWOZ_RATE_LIMIT_MAX_CONCURRENT || '1', 10),
      },
    },
    logging: {
      level: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
    },
    dryRun: process.env.DRY_RUN === 'true',
    chromePath:
      process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    staticPlaylistId: process.env.SPOTIFY_STATIC_PLAYLIST_ID,
  };

  try {
    return AppConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigurationError(`Invalid configuration: ${error.message}`);
    }
    throw new ConfigurationError('Unknown configuration validation error');
  }
}

export const config = createConfig();

export function validateEnvironment(): string[] {
  const missing: string[] = [];

  const requiredEnvVars = [
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'SPOTIFY_REFRESH_TOKEN',
    'SPOTIFY_USER_ID',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  return missing;
}

export function printConfigSummary(): void {
  console.log('Configuration Summary:');
  console.log(`- Dry Run: ${config.dryRun ? 'YES' : 'NO'}`);
  console.log(`- Scrape Interval: ${config.wwoz.scrapeInterval}s`);
  console.log(`- Log Level: ${config.logging.level}`);
  console.log(`- Static Playlist: ${config.staticPlaylistId ? 'YES' : 'NO'}`);
  console.log(`- WWOZ URL: ${config.wwoz.playlistUrl}`);
}
