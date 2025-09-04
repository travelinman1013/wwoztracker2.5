import { z } from 'zod';

export const SpotifyConfigSchema = z.object({
  clientId: z.string().min(1, 'Spotify Client ID is required'),
  clientSecret: z.string().min(1, 'Spotify Client Secret is required'),
  redirectUri: z.string().url('Spotify Redirect URI must be a valid URL'),
  refreshToken: z.string().min(1, 'Spotify Refresh Token is required'),
  userId: z.string().min(1, 'Spotify User ID is required'),
});

export const WWOZConfigSchema = z.object({
  playlistUrl: z.string().url('WWOZ Playlist URL must be a valid URL'),
  scrapeInterval: z.number().min(60, 'Scrape interval must be at least 60 seconds'),
  timeout: z.number().min(5000, 'Timeout must be at least 5000ms'),
});

export const RateLimitConfigSchema = z.object({
  minTime: z.number().min(0),
  maxConcurrent: z.number().min(1),
});

export const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']),
});

export const ArchiveConfigSchema = z.object({
  enabled: z.boolean(),
  basePath: z.string().min(1, 'Archive base path is required'),
});

export const AppConfigSchema = z.object({
  spotify: SpotifyConfigSchema,
  wwoz: WWOZConfigSchema,
  rateLimit: z.object({
    spotify: RateLimitConfigSchema,
    wwoz: RateLimitConfigSchema,
  }),
  logging: LoggingConfigSchema,
  archive: ArchiveConfigSchema,
  dryRun: z.boolean(),
  chromePath: z.string().min(1, 'Chrome path is required'),
  staticPlaylistId: z.string().optional(),
});

export type ValidatedAppConfig = z.infer<typeof AppConfigSchema>;
