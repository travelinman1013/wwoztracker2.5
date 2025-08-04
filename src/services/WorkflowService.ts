import dayjs from 'dayjs';
import { SpotifyService } from './SpotifyService.js';
import { ScrapingService } from './ScrapingService.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { ConsecutiveDuplicatesError, AppError } from '../types/errors.js';
import { SongMatcher, MatchValidator } from '../utils/matching.js';
import type { 
  ScrapedSong, 
  TrackMatch, 
  ProcessingStats, 
  CLIOptions 
} from '../types/index.js';

export class WorkflowService {
  private spotifyService: SpotifyService;
  private scrapingService: ScrapingService;
  private stats: ProcessingStats = {
    processed: 0,
    successful: 0,
    failed: 0,
    duplicates: 0,
    consecutiveDuplicates: 0,
  };

  constructor() {
    this.spotifyService = new SpotifyService();
    this.scrapingService = new ScrapingService();
  }

  async run(options: CLIOptions): Promise<void> {
    Logger.info('🎵 Starting WWOZ Tracker workflow', { options });

    try {
      if (options.once) {
        await this.runOnce(options);
      } else {
        await this.runContinuous(options);
      }
    } catch (error) {
      if (error instanceof AppError) {
        Logger.error(error.message, { context: error.context });
        throw error;
      } else {
        Logger.error('Unexpected workflow error', { error });
        throw error;
      }
    }
  }

  private async runOnce(options: CLIOptions): Promise<void> {
    Logger.info('Running single execution cycle');
    
    const songs = await this.scrapeSongs(options);
    if (!songs.length) {
      Logger.warn('No songs scraped, ending execution');
      return;
    }

    // Load playlist cache once at the beginning for performance
    await this.loadPlaylistCache(options);

    await this.processSongs(songs, options);
    this.logFinalStats();
  }

  private async runContinuous(options: CLIOptions): Promise<void> {
    Logger.info('Starting continuous monitoring mode', { 
      interval: config.wwoz.scrapeInterval 
    });

    const intervalMs = config.wwoz.scrapeInterval * 1000;
    
    while (true) {
      try {
        await this.runOnce(options);
        
        // Reset consecutive duplicates after successful run
        this.stats.consecutiveDuplicates = 0;
        
        Logger.info(`Next run in ${config.wwoz.scrapeInterval} seconds`);
        await this.countdown(config.wwoz.scrapeInterval);
        
      } catch (error) {
        if (error instanceof ConsecutiveDuplicatesError) {
          Logger.info('Playlist appears up to date, continuing with normal interval');
        } else {
          Logger.error('Error in continuous run, retrying after interval', { error });
        }
        
        await this.countdown(config.wwoz.scrapeInterval);
      }
    }
  }

  private async loadPlaylistCache(options: CLIOptions): Promise<void> {
    try {
      // Get the playlist ID that will be used for this batch
      let playlistId: string | null = null;
      
      if (config.staticPlaylistId) {
        playlistId = config.staticPlaylistId;
      } else {
        // For dynamic playlists, use today's date
        const dateStr = dayjs().format('YYYY-MM-DD');
        const playlistName = options.playlistName || `WWOZ Radio Discoveries [${dateStr}]`;
        
        const playlist = await this.spotifyService.getOrCreatePlaylist(playlistName, {
          description: 'Songs discovered from WWOZ radio playlist',
          public: false,
        });
        
        playlistId = playlist?.id || null;
      }
      
      if (playlistId) {
        await this.spotifyService.loadPlaylistCache(playlistId);
      }
    } catch (error) {
      Logger.warn('Failed to load playlist cache, will use fallback method', { error });
    }
  }

  private async scrapeSongs(options: CLIOptions): Promise<ScrapedSong[]> {
    try {
      Logger.info('Scraping all songs from playlist');
      return await this.scrapingService.scrapeAllSongs();
    } catch (error) {
      Logger.error('Failed to scrape songs', { error });
      return [];
    }
  }

  private async processSongs(songs: ScrapedSong[], options: CLIOptions): Promise<void> {
    Logger.info(`Processing ${songs.length} songs`);

    for (const song of songs) {
      try {
        await this.processSingleSong(song, options);
      } catch (error) {
        if (error instanceof ConsecutiveDuplicatesError) {
          Logger.info('Stopping batch processing due to consecutive duplicates');
          throw error;
        }
        
        Logger.warn('Failed to process song, continuing with next', { 
          song: `${song.artist} - ${song.title}`,
          error: error instanceof Error ? error.message : String(error)
        });
        
        this.stats.failed++;
        this.stats.consecutiveDuplicates = 0; // Reset on non-duplicate failure
      }
      
      this.stats.processed++;
    }
  }

  private async processSingleSong(song: ScrapedSong, options: CLIOptions): Promise<void> {
    Logger.info(`🎵 Processing: ${song.artist} - ${song.title}`);

    // Get or create playlist
    const playlistId = await this.getPlaylistId(song, options);
    if (!playlistId) {
      throw new Error('Could not get or create playlist');
    }

    // Search for track on Spotify
    const match = await this.spotifyService.searchTrack(song);
    if (!match) {
      Logger.warn(`No confident match found for: ${song.artist} - ${song.title}`);
      this.stats.failed++;
      this.stats.consecutiveDuplicates = 0;
      return;
    }

    // Validate match quality
    if (!MatchValidator.isValidMatch(song, match.track, match.confidence)) {
      Logger.warn(`Match quality too low for: ${song.artist} - ${song.title}`, {
        confidence: match.confidence,
        spotifyTrack: `${match.track.artists[0].name} - ${match.track.name}`
      });
      this.stats.failed++;
      this.stats.consecutiveDuplicates = 0;
      return;
    }

    Logger.info(`🎯 Found match: ${match.track.artists.map(a => a.name).join(', ')} - ${match.track.name} (${match.confidence.toFixed(1)}% confidence)`);

    // Check for duplicates
    const isDuplicate = await this.spotifyService.isDuplicate(playlistId, match.track.id);
    
    if (isDuplicate) {
      this.stats.duplicates++;
      this.stats.consecutiveDuplicates++;
      
      Logger.info(`⏭️  Track already in playlist (${this.stats.consecutiveDuplicates}/5 consecutive duplicates)`);
      
      if (this.stats.consecutiveDuplicates >= 5) {
        throw new ConsecutiveDuplicatesError(5);
      }
      
      return;
    }

    // Add track to playlist
    if (!config.dryRun) {
      await this.spotifyService.addTrackToPlaylist(playlistId, match.track.uri);
      Logger.info(`✅ Added to playlist: ${match.track.name}`);
    } else {
      Logger.info(`[DRY RUN] Would add to playlist: ${match.track.name}`);
    }

    this.stats.successful++;
    this.stats.consecutiveDuplicates = 0; // Reset on successful add
  }

  private async getPlaylistId(song: ScrapedSong, options: CLIOptions): Promise<string | null> {
    if (config.staticPlaylistId) {
      Logger.debug(`Using static playlist: ${config.staticPlaylistId}`);
      return config.staticPlaylistId;
    }

    const dateStr = dayjs(song.scrapedAt).format('YYYY-MM-DD');
    const playlistName = options.playlistName || `WWOZ Radio Discoveries [${dateStr}]`;
    
    Logger.debug(`Creating/finding playlist: ${playlistName}`);
    const playlist = await this.spotifyService.getOrCreatePlaylist(playlistName, {
      description: 'Songs discovered from WWOZ radio playlist',
      public: false,
    });

    return playlist?.id || null;
  }

  private async countdown(seconds: number): Promise<void> {
    let remaining = seconds;
    
    while (remaining > 0) {
      if (remaining % 50 === 0) {
        const timestamp = new Date().toLocaleString();
        console.log(`Next refresh in ${remaining} seconds [${timestamp}]`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      remaining--;
    }
  }

  private logFinalStats(): void {
    Logger.info('📊 Processing completed', {
      processed: this.stats.processed,
      successful: this.stats.successful,
      failed: this.stats.failed,
      duplicates: this.stats.duplicates,
      successRate: this.stats.processed > 0 
        ? `${((this.stats.successful / this.stats.processed) * 100).toFixed(1)}%`
        : '0%'
    });
  }

  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      duplicates: 0,
      consecutiveDuplicates: 0,
    };
  }
}