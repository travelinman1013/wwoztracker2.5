import dayjs from 'dayjs';
import { SpotifyService } from './SpotifyService.js';
import { ScrapingService } from './ScrapingService.js';
import { ArchiveService, type ArchiveEntry } from './ArchiveService.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { ConsecutiveDuplicatesError, AppError } from '../types/errors.js';
import { SongMatcher, MatchValidator } from '../utils/matching.js';
import type { ScrapedSong, TrackMatch, ProcessingStats, CLIOptions } from '../types/index.js';

export class WorkflowService {
  private spotifyService: SpotifyService;
  private scrapingService: ScrapingService;
  private archiveService: ArchiveService;
  private forceRun = false;
  private shouldStop = false;
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
    this.archiveService = new ArchiveService();
    this.setupKeyboardInput();
  }

  private setupKeyboardInput(): void {
    // Only set up keyboard input in TTY environments
    if (!process.stdin.isTTY) {
      return;
    }

    // Enable raw mode to capture individual key presses
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    // Handle raw keyboard input
    process.stdin.on('data', (chunk: Buffer | string) => {
      const key = chunk.toString();

      // Debug: log all key presses
      console.log(`\nDEBUG: Key pressed: ${JSON.stringify(key)} (length: ${key.length})`);
      for (let i = 0; i < key.length; i++) {
        console.log(`  Char ${i}: ${key.charCodeAt(i)} (${key.charAt(i)})`);
      }

      // Up arrow key sequence: ESC[A (27,91,65)
      if (
        key === '\x1b[A' ||
        key === '\u001b[A' ||
        (key.length >= 3 &&
          key.charCodeAt(0) === 27 &&
          key.charCodeAt(1) === 91 &&
          key.charCodeAt(2) === 65)
      ) {
        console.log('🚀 Up arrow detected - triggering immediate scrape!');
        this.forceRun = true;
      }
      // Down arrow key sequence: ESC[B (27,91,66) - Stop tracker
      else if (
        key === '\x1b[B' ||
        key === '\u001b[B' ||
        (key.length >= 3 &&
          key.charCodeAt(0) === 27 &&
          key.charCodeAt(1) === 91 &&
          key.charCodeAt(2) === 66)
      ) {
        console.log('🛑 Down arrow detected - stopping tracker...');
        this.shouldStop = true;
      }
      // Enter key as fallback
      else if (key === '\r' || key === '\n') {
        console.log('⚡ Enter pressed - triggering immediate scrape!');
        this.forceRun = true;
      }
      // Spacebar as another fallback
      else if (key === ' ') {
        console.log('⚡ Spacebar pressed - triggering immediate scrape!');
        this.forceRun = true;
      }
      // Ctrl+C
      else if (key.charCodeAt(0) === 3) {
        console.log('\n👋 Shutting down...');
        this.cleanup();
        process.exit(0);
      }
    });
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }

  async run(options: CLIOptions): Promise<void> {
    Logger.info('🎵 Starting WWOZ Tracker workflow', { options });

    try {
      if (options.once) {
        await this.runOnce(options);
      } else {
        Logger.info(
          '💡 Tip: Press ↑ arrow key or Enter to skip wait and run immediately, ↓ arrow key to stop tracker'
        );
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
    } finally {
      this.cleanup();
    }
  }

  private async runOnce(options: CLIOptions): Promise<void> {
    const timestamp = new Date().toLocaleString();
    Logger.info(`🎯 Running execution cycle [${timestamp}]`);

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
      interval: config.wwoz.scrapeInterval,
    });

    const intervalMs = config.wwoz.scrapeInterval * 1000;

    while (!this.shouldStop) {
      try {
        await this.runOnce(options);

        // Check if stop was requested during processing
        if (this.shouldStop) {
          Logger.info('🛑 Stop requested - exiting continuous mode');
          break;
        }

        // Reset consecutive duplicates after successful run
        this.stats.consecutiveDuplicates = 0;

        Logger.info(`Next run in ${config.wwoz.scrapeInterval} seconds`);
        await this.countdown(config.wwoz.scrapeInterval);

        // Check again after countdown in case stop was requested during wait
        if (this.shouldStop) {
          Logger.info('🛑 Stop requested - exiting continuous mode');
          break;
        }
      } catch (error) {
        if (error instanceof ConsecutiveDuplicatesError) {
          Logger.info('Playlist appears up to date, continuing with normal interval');
        } else {
          Logger.error('Error in continuous run, retrying after interval', { error });
        }

        // Reset consecutive duplicates when going back to waiting mode
        this.stats.consecutiveDuplicates = 0;
        await this.countdown(config.wwoz.scrapeInterval);

        // Check if stop was requested during error recovery wait
        if (this.shouldStop) {
          Logger.info('🛑 Stop requested - exiting continuous mode');
          break;
        }
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
      Logger.info('🔄 Starting fresh scrape of WWOZ playlist...');
      const songs = await this.scrapingService.scrapeAllSongs();
      Logger.info(`📋 Retrieved ${songs.length} songs from fresh scrape`);
      return songs;
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
          error: error instanceof Error ? error.message : String(error),
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
      await this.archiveFailure(song, 'Could not get or create playlist');
      throw new Error('Could not get or create playlist');
    }

    // Search for track on Spotify
    const match = await this.spotifyService.searchTrack(song);
    if (!match) {
      Logger.warn(`No confident match found for: ${song.artist} - ${song.title}`);
      await this.archiveFailure(song, 'No confident match found');
      this.stats.failed++;
      this.stats.consecutiveDuplicates = 0;
      return;
    }

    // Validate match quality
    if (!MatchValidator.isValidMatch(song, match.track, match.confidence)) {
      Logger.warn(`Match quality too low for: ${song.artist} - ${song.title}`, {
        confidence: match.confidence,
        spotifyTrack: `${match.track.artists[0].name} - ${match.track.name}`,
      });
      await this.archiveLowConfidence(song, match);
      this.stats.failed++;
      this.stats.consecutiveDuplicates = 0;
      return;
    }

    Logger.info(
      `🎯 Found match: ${match.track.artists.map((a) => a.name).join(', ')} - ${match.track.name} (${match.confidence.toFixed(1)}% confidence)`
    );

    // Check for duplicates - handle this outside try-catch to avoid archiving duplicates
    const isDuplicate = await this.spotifyService.isDuplicate(playlistId, match.track.id);

    if (isDuplicate) {
      this.stats.duplicates++;
      this.stats.consecutiveDuplicates++;

      Logger.info(
        `⏭️  Track already in playlist (${this.stats.consecutiveDuplicates}/5 consecutive duplicates)`
      );

      // Don't archive duplicates - they're not failures
      if (this.stats.consecutiveDuplicates >= 5) {
        throw new ConsecutiveDuplicatesError(5);
      }

      return;
    }

    // Only use try-catch for actual operations that might fail and need archiving
    try {
      // Add track to playlist
      if (!config.dryRun) {
        await this.spotifyService.addTrackToPlaylist(playlistId, match.track.uri);
        Logger.info(`✅ Added to playlist: ${match.track.name}`);
      } else {
        Logger.info(`[DRY RUN] Would add to playlist: ${match.track.name}`);
      }

      await this.archiveSuccess(song, match);
      this.stats.successful++;
      this.stats.consecutiveDuplicates = 0; // Reset on successful add
    } catch (error) {
      // Only actual failures get archived here - duplicates are handled above
      await this.archiveFailure(song, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async archiveSuccess(song: ScrapedSong, match: TrackMatch): Promise<void> {
    const entry: ArchiveEntry = {
      song,
      match,
      status: 'found',
      archivedAt: new Date().toISOString(),
    };
    await this.archiveService.archiveSong(entry);
  }

  private async archiveLowConfidence(song: ScrapedSong, match: TrackMatch): Promise<void> {
    const entry: ArchiveEntry = {
      song,
      match,
      status: 'low_confidence',
      archivedAt: new Date().toISOString(),
    };
    await this.archiveService.archiveSong(entry);
  }

  private async archiveFailure(song: ScrapedSong, error: string): Promise<void> {
    const entry: ArchiveEntry = {
      song,
      status: 'not_found',
      error,
      archivedAt: new Date().toISOString(),
    };
    await this.archiveService.archiveSong(entry);
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
    this.forceRun = false; // Reset the force run flag

    console.log(
      `⏳ Waiting ${seconds} seconds... (Press ↑ arrow key or Enter to skip wait, ↓ arrow key to stop tracker)`
    );

    while (remaining > 0 && !this.forceRun && !this.shouldStop) {
      if (remaining % 50 === 0) {
        const timestamp = new Date().toLocaleString();
        console.log(
          `Next refresh in ${remaining} seconds [${timestamp}] (Press ↑/Enter to skip, ↓ to stop)`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      remaining--;
    }

    if (this.forceRun) {
      console.log('⚡ Skipping wait - running immediately!');
      this.forceRun = false; // Reset flag
    }
  }

  private logFinalStats(): void {
    Logger.info('📊 Processing completed', {
      processed: this.stats.processed,
      successful: this.stats.successful,
      failed: this.stats.failed,
      duplicates: this.stats.duplicates,
      successRate:
        this.stats.processed > 0
          ? `${((this.stats.successful / this.stats.processed) * 100).toFixed(1)}%`
          : '0%',
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
