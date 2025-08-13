export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  userId: string;
}

export interface WWOZConfig {
  playlistUrl: string;
  scrapeInterval: number;
  timeout: number;
}

export interface RateLimitConfig {
  minTime: number;
  maxConcurrent: number;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
}

export interface AppConfig {
  spotify: SpotifyConfig;
  wwoz: WWOZConfig;
  rateLimit: {
    spotify: RateLimitConfig;
    wwoz: RateLimitConfig;
  };
  logging: LoggingConfig;
  dryRun: boolean;
  chromePath: string;
  staticPlaylistId?: string;
}

export interface CLIOptions {
  dryRun?: boolean;
  playlistName?: string;
  once?: boolean;
  all?: boolean;
  verbose?: boolean;
}
