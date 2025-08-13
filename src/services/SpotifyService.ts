import SpotifyWebApi from 'spotify-web-api-node';
import Bottleneck from 'bottleneck';
import { config } from '../config/index.js';
import { SpotifyAPIError } from '../types/errors.js';
import { SongMatcher } from '../utils/matching.js';
import { Logger } from '../utils/logger.js';
import type {
  ScrapedSong,
  SpotifyTrack,
  TrackMatch,
  SpotifyPlaylist,
  PlaylistTrack,
  PlaylistOptions,
} from '../types/index.js';

export class SpotifyService {
  private api: SpotifyWebApi;
  private limiter: Bottleneck;
  private lastRefresh = 0;
  private expiresIn = 3600;
  private playlistTrackCache = new Map<string, Set<string>>();

  constructor() {
    this.api = new SpotifyWebApi({
      clientId: config.spotify.clientId,
      clientSecret: config.spotify.clientSecret,
      redirectUri: config.spotify.redirectUri,
    });

    this.api.setRefreshToken(config.spotify.refreshToken);
    this.limiter = new Bottleneck(config.rateLimit.spotify);
  }

  private async ensureAccessToken(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    if (now - this.lastRefresh > this.expiresIn - 60) {
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const data = await this.api.refreshAccessToken();
          this.api.setAccessToken(data.body.access_token);
          this.lastRefresh = now;
          this.expiresIn = data.body.expires_in || 3600;
          Logger.debug('Spotify access token refreshed successfully');
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';

          if (attempt === maxRetries - 1) {
            throw new SpotifyAPIError(`Failed to refresh access token: ${message}`, { attempt });
          }

          await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isRetryable = this.isRetryableError(error);

        if (attempt === maxRetries - 1 || !isRetryable) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          throw new SpotifyAPIError(message, { attempt, isRetryable });
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    throw new SpotifyAPIError('Maximum retries exceeded');
  }

  private isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const errorObj = error as { code?: string; statusCode?: number };
    return (
      errorObj.code === 'ECONNRESET' ||
      errorObj.code === 'ETIMEDOUT' ||
      errorObj.statusCode === 429 ||
      errorObj.statusCode === 502 ||
      errorObj.statusCode === 503 ||
      errorObj.statusCode === 504
    );
  }

  async searchTrack(song: ScrapedSong): Promise<TrackMatch | null> {
    await this.limiter.schedule(() => this.ensureAccessToken());

    return this.withRetry(async () => {
      // First try with artist and track
      let results = await this.limiter.schedule(() =>
        this.api.searchTracks(`artist:${song.artist} track:${song.title}`, { limit: 10 })
      );

      let tracks = (results as any).body.tracks.items;

      // If no results, try title only
      if (!tracks.length) {
        results = await this.limiter.schedule(() =>
          this.api.searchTracks(song.title, { limit: 10 })
        );
        tracks = (results as any).body.tracks.items;
      }

      if (!tracks.length) return null;

      // Convert to our SpotifyTrack type and compute confidence scores
      const candidates: TrackMatch[] = tracks.map((track: any) => {
        const convertedTrack = this.convertSpotifyTrack(track);
        return {
          track: convertedTrack,
          confidence: SongMatcher.computeConfidence(song, convertedTrack),
        };
      });

      // Sort by confidence and return best match if above threshold
      candidates.sort((a, b) => b.confidence - a.confidence);
      return candidates[0].confidence > 70 ? candidates[0] : null;
    });
  }

  async getOrCreatePlaylist(
    name: string,
    options?: PlaylistOptions
  ): Promise<SpotifyPlaylist | null> {
    await this.limiter.schedule(() => this.ensureAccessToken());

    return this.withRetry(async () => {
      // Search for existing playlist
      const playlists = await this.limiter.schedule(() =>
        this.api.getUserPlaylists(config.spotify.userId, { limit: 50 })
      );

      const existing = (playlists as any).body.items.find((p: any) => p.name === name);
      if (existing) {
        return this.convertSpotifyPlaylist(existing);
      }

      // Create new playlist if not in dry run mode
      if (config.dryRun) {
        return {
          id: 'dry-run-playlist',
          name,
          description: options?.description || 'WWOZ discoveries',
          public: options?.public || false,
          collaborative: false,
          tracks: { total: 0 },
          external_urls: { spotify: '' },
        };
      }

      const created = await this.limiter.schedule(() =>
        this.api.createPlaylist(name, {
          public: options?.public || false,
          description: options?.description || 'WWOZ discoveries',
        })
      );

      return this.convertSpotifyPlaylist((created as any).body);
    });
  }

  async loadPlaylistCache(playlistId: string): Promise<void> {
    if (config.dryRun) return;

    Logger.info(`Loading playlist cache for ${playlistId}...`);
    await this.limiter.schedule(() => this.ensureAccessToken());

    return this.withRetry(async () => {
      const trackIds = new Set<string>();
      let offset = 0;
      const limit = 100;
      let totalLoaded = 0;

      while (true) {
        const tracks = await this.limiter.schedule(() =>
          this.api.getPlaylistTracks(playlistId, { limit, offset })
        );

        const tracksData = (tracks as any).body.items;
        if (!tracksData || tracksData.length === 0) break;

        for (const item of tracksData) {
          if (item.track && item.track.id) {
            trackIds.add(item.track.id);
            totalLoaded++;
          }
        }

        if (tracksData.length < limit) break;
        offset += limit;
      }

      this.playlistTrackCache.set(playlistId, trackIds);
      Logger.info(`Cached ${totalLoaded} tracks from playlist`);
    });
  }

  async isDuplicate(playlistId: string, trackId: string): Promise<boolean> {
    if (config.dryRun) return false;

    // Use cache if available
    const cachedTracks = this.playlistTrackCache.get(playlistId);
    if (cachedTracks) {
      const found = cachedTracks.has(trackId);
      Logger.debug(`Track ${trackId} ${found ? 'found' : 'NOT found'} in cached playlist`);
      return found;
    }

    // Fallback to API check if cache not available (shouldn't happen)
    Logger.warn('No cache available for playlist, falling back to API check');
    await this.limiter.schedule(() => this.ensureAccessToken());

    return this.withRetry(async () => {
      let offset = 0;
      const limit = 100;

      while (true) {
        const tracks = await this.limiter.schedule(() =>
          this.api.getPlaylistTracks(playlistId, { limit, offset })
        );

        const tracksData = (tracks as any).body.items;
        if (!tracksData || tracksData.length === 0) break;

        const found = tracksData.some(
          (item: PlaylistTrack) => item.track && item.track.id === trackId
        );

        if (found) return true;
        if (tracksData.length < limit) break;
        offset += limit;
      }

      return false;
    });
  }

  async addTrackToPlaylist(playlistId: string, trackUri: string): Promise<void> {
    if (config.dryRun) return;

    await this.limiter.schedule(() => this.ensureAccessToken());

    return this.withRetry(async () => {
      await this.limiter.schedule(() => this.api.addTracksToPlaylist(playlistId, [trackUri]));

      // Update cache if it exists
      const cachedTracks = this.playlistTrackCache.get(playlistId);
      if (cachedTracks) {
        // Extract track ID from URI (format: spotify:track:trackId)
        const trackId = trackUri.split(':')[2];
        if (trackId) {
          cachedTracks.add(trackId);
          Logger.debug(`Added track ${trackId} to cache`);
        }
      }
    });
  }

  private convertSpotifyTrack(track: any): SpotifyTrack {
    return {
      id: track.id,
      name: track.name,
      uri: track.uri,
      artists: track.artists.map((artist: any) => ({
        id: artist.id,
        name: artist.name,
      })),
      album: {
        id: track.album.id,
        name: track.album.name,
      },
      duration_ms: track.duration_ms,
      external_urls: track.external_urls,
    };
  }

  private convertSpotifyPlaylist(playlist: any): SpotifyPlaylist {
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      collaborative: playlist.collaborative,
      tracks: { total: playlist.tracks.total },
      external_urls: playlist.external_urls,
    };
  }
}
