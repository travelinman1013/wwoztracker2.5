import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import dayjs from 'dayjs';
import { Logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { ScrapedSong, TrackMatch } from '../types/index.js';

export interface ArchiveEntry {
  song: ScrapedSong;
  match?: TrackMatch;
  isDuplicate?: boolean;
  status: 'found' | 'not_found' | 'duplicate' | 'low_confidence';
  error?: string;
  archivedAt: string;
}

interface DailyStats {
  total: number;
  found: number;
  notFound: number;
  lowConfidence: number;
  duplicates: number;
}

interface RunStats extends DailyStats {
  runStartTime?: string;
  runEndTime?: string;
  status?: 'running' | 'completed' | 'stopped';
  stopReason?: string;
}

export class ArchiveService {
  private dailyCache = new Set<string>();
  private recentEntries = new Map<string, number>(); // Track recent entries with timestamps
  private currentDate = '';
  private dailyCounter = 0;
  private dailyStats: DailyStats = {
    total: 0,
    found: 0,
    notFound: 0,
    lowConfidence: 0,
    duplicates: 0,
  };
  private currentRunStats: RunStats = {
    total: 0,
    found: 0,
    notFound: 0,
    lowConfidence: 0,
    duplicates: 0,
  };
  private runHistory: RunStats[] = [];
  private readonly RECENT_WINDOW_MINUTES = config.archive.deduplicationWindowMinutes; // Skip archiving if seen recently

  constructor() {
    this.resetDailyCache();
    this.loadRecentEntries();
    this.startNewRun();
  }

  startNewRun(): void {
    this.currentRunStats = {
      total: 0,
      found: 0,
      notFound: 0,
      lowConfidence: 0,
      duplicates: 0,
      runStartTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      status: 'running',
    };
  }

  async archiveSong(entry: ArchiveEntry): Promise<void> {
    if (!config.archive.enabled) {
      return;
    }

    try {
      const songDate = dayjs(entry.song.scrapedAt);
      const dateString = songDate.format('YYYY-MM-DD');

      // Reset cache if date changed
      if (this.currentDate !== dateString) {
        this.resetDailyCache();
        this.currentDate = dateString;
        await this.loadExistingEntries(dateString);
      }

      // Create unique identifier for duplicate detection
      const uniqueId = this.createUniqueId(entry.song, songDate);

      // Skip if already archived today
      if (this.dailyCache.has(uniqueId)) {
        Logger.debug(`Song already archived today: ${entry.song.artist} - ${entry.song.title}`);
        return;
      }

      // Check if this song was archived recently (without timestamp)
      const songKey = `${entry.song.artist}-${entry.song.title}${entry.song.album ? `-${entry.song.album}` : ''}`;
      const lastSeen = this.recentEntries.get(songKey);
      const now = Date.now();

      if (lastSeen && now - lastSeen < this.RECENT_WINDOW_MINUTES * 60 * 1000) {
        const minutesAgo = Math.round((now - lastSeen) / 60000);
        Logger.debug(
          `Song archived ${minutesAgo} minutes ago, skipping: ${entry.song.artist} - ${entry.song.title}`
        );
        return;
      }

      // Update recent entries tracker
      this.recentEntries.set(songKey, now);

      // Clean up old entries from recent cache (older than window)
      this.cleanupRecentEntries();

      // Persist recent entries to file
      await this.saveRecentEntries();

      // Get archive file path
      const archivePath = this.getArchiveFilePath(songDate);

      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(archivePath));

      // Read existing content or create new file
      let fileContent = await this.getOrCreateFileContent(archivePath, songDate);

      // Append new entry as table row
      const tableRow = this.formatAsTableRow(entry);

      // Check if we need to add the table headers
      if (!this.hasTableInTracksSection(fileContent)) {
        // No table in Tracks section, add headers
        fileContent += this.createTableHeaders();
      }

      fileContent += tableRow;

      // Update statistics
      this.updateDailyStats(entry.status);
      this.updateRunStats(entry.status);

      // Write updated content
      await writeFile(archivePath, fileContent, 'utf8');

      // Add to cache
      this.dailyCache.add(uniqueId);

      // Update statistics in file
      await this.updateStatisticsInFile(archivePath);

      Logger.debug(`Archived song: ${entry.song.artist} - ${entry.song.title}`);
    } catch (error) {
      Logger.error('Failed to archive song', {
        song: `${entry.song.artist} - ${entry.song.title}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private createUniqueId(song: ScrapedSong, timestamp: dayjs.Dayjs): string {
    // Use date, hour, and minute for deduplication to prevent rapid consecutive duplicates
    // This prevents the same song from being archived multiple times in quick succession
    const timeKey = timestamp.format('YYYY-MM-DD-HH-mm');
    // Include album in the unique ID to differentiate versions of the same song
    const albumKey = song.album ? `-${song.album}` : '';
    return `${song.artist}-${song.title}${albumKey}-${timeKey}`;
  }

  private generateShortId(song: ScrapedSong, timestamp: dayjs.Dayjs): string {
    // Create a short, readable ID that preserves scraping order: HHMMSS-NNN
    const timeStr = timestamp.format('HHmmss');

    // Increment counter for each new song to maintain order
    this.dailyCounter++;

    // Format counter as zero-padded 3-digit number
    const counterStr = this.dailyCounter.toString().padStart(3, '0');

    return `${timeStr}-${counterStr}`;
  }

  private getArchiveFilePath(date: dayjs.Dayjs): string {
    const year = date.format('YYYY');
    const month = date.format('MM');
    const dateStr = date.format('YYYY-MM-DD');

    return join(config.archive.basePath, year, month, `${dateStr}-wwoz-tracks.md`);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private async getOrCreateFileContent(filePath: string, date: dayjs.Dayjs): Promise<string> {
    if (existsSync(filePath)) {
      try {
        return await readFile(filePath, 'utf8');
      } catch (error) {
        Logger.warn(`Could not read existing archive file: ${filePath}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create new file with template
    return this.createFileTemplate(date);
  }

  private createFileTemplate(date: dayjs.Dayjs): string {
    const dateStr = date.format('YYYY-MM-DD');
    const dayName = date.format('dddd');

    return `---
title: "WWOZ Tracks - ${dateStr}"
date: "${dateStr}"
tags:
  - wwoz
  - music
  - radio
  - new-orleans
type: "daily-archive"
---

# WWOZ Tracks - ${dayName}, ${date.format('MMMM D, YYYY')}

This archive contains all tracks scraped from WWOZ's playlist on ${dateStr}.

## Summary

- **Date**: ${dateStr}
- **Day**: ${dayName}
- **Archive Created**: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
- **Last Updated**: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}
- **Total Runs Today**: 0
- **Last Run Status**: -

## Daily Statistics

| Metric | Count |
|--------|-------|
| Total Tracks | 0 |
| Successfully Found | 0 |
| Not Found | 0 |
| Low Confidence | 0 |
| Duplicates | 0 |

## Tracks

`;
  }

  private createTableHeaders(): string {
    return `
| ID | Time | Artist | Title | Album | Status | Confidence | Spotify | Scraped |
|----|------|--------|-------|-------|--------|------------|---------|---------|
`;
  }

  private hasTableInTracksSection(content: string): boolean {
    // Find the "## Tracks" section
    const tracksIndex = content.indexOf('## Tracks');
    if (tracksIndex === -1) {
      return false;
    }

    // Get content from "## Tracks" section onwards
    const tracksSection = content.substring(tracksIndex);

    // Look for next section marker (##) to limit our search
    const nextSectionMatch = tracksSection.substring(10).match(/^## /m); // Skip "## Tracks"
    const sectionEnd = nextSectionMatch && nextSectionMatch.index !== undefined
      ? tracksIndex + 10 + nextSectionMatch.index
      : content.length;
    const limitedTracksSection = content.substring(tracksIndex, sectionEnd);

    // Check if this section already has a table header
    return limitedTracksSection.includes('| ID |') || limitedTracksSection.includes('| Time |');
  }

  private formatAsTableRow(entry: ArchiveEntry): string {
    const timestamp = dayjs(entry.song.scrapedAt).format('HH:mm');
    const { song, match, status } = entry;
    const uniqueId = this.generateShortId(song, dayjs(song.scrapedAt));

    // Escape pipe characters in text fields
    const escapeTableCell = (text: string | undefined): string => {
      if (!text) return '-';
      return text.replace(/\|/g, '\\|');
    };

    let statusIcon = '';
    let statusText = '';
    let confidence = '-';
    let spotifyLink = '-';

    switch (status) {
      case 'found':
        statusIcon = '✅';
        statusText = 'Found';
        confidence = match ? `${match.confidence.toFixed(1)}%` : '-';
        spotifyLink = match?.track.external_urls.spotify
          ? `[Open](${match.track.external_urls.spotify})`
          : '-';
        break;
      case 'duplicate':
        statusIcon = '🔄';
        statusText = 'Duplicate';
        confidence = match ? `${match.confidence.toFixed(1)}%` : '-';
        spotifyLink = match?.track.external_urls.spotify
          ? `[Open](${match.track.external_urls.spotify})`
          : '-';
        break;
      case 'not_found':
        statusIcon = '❌';
        statusText = 'Not Found';
        break;
      case 'low_confidence':
        statusIcon = '⚠️';
        statusText = 'Low Match';
        confidence = match ? `${match.confidence.toFixed(1)}%` : '-';
        break;
    }

    const scrapedTime = dayjs(song.scrapedAt).format('HH:mm:ss');

    return `| ${uniqueId} | ${timestamp} | ${escapeTableCell(song.artist)} | ${escapeTableCell(song.title)} | ${escapeTableCell(song.album)} | ${statusIcon} ${statusText} | ${confidence} | ${spotifyLink} | ${scrapedTime} |\n`;
  }

  private updateDailyStats(status: string): void {
    this.dailyStats.total++;
    switch (status) {
      case 'found':
        this.dailyStats.found++;
        break;
      case 'not_found':
        this.dailyStats.notFound++;
        break;
      case 'low_confidence':
        this.dailyStats.lowConfidence++;
        break;
      case 'duplicate':
        this.dailyStats.duplicates++;
        break;
    }
  }

  private updateRunStats(status: string): void {
    this.currentRunStats.total++;
    switch (status) {
      case 'found':
        this.currentRunStats.found++;
        break;
      case 'not_found':
        this.currentRunStats.notFound++;
        break;
      case 'low_confidence':
        this.currentRunStats.lowConfidence++;
        break;
      case 'duplicate':
        this.currentRunStats.duplicates++;
        break;
    }
  }

  private async loadExistingEntries(dateString: string): Promise<void> {
    try {
      const archivePath = this.getArchiveFilePath(dayjs(dateString));

      if (!existsSync(archivePath)) {
        return;
      }

      const content = await readFile(archivePath, 'utf8');
      const lines = content.split('\n');

      // Reset daily stats and counter
      this.dailyStats = { total: 0, found: 0, notFound: 0, lowConfidence: 0, duplicates: 0 };
      this.dailyCounter = 0;

      // Parse both old and new formats for backward compatibility
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // New table format: | ID | HH:mm | Artist | Title | Album | Status | ... or legacy format | HH:mm | Artist | Title | Album | Status | ...
        if (
          line.startsWith('|') &&
          !line.includes('---') &&
          !line.includes('Time |') &&
          !line.includes('ID |')
        ) {
          const cells = line.split('|').map((cell) => cell.trim());

          // Check if this is the new format with ID column (9+ cells) or legacy format (8+ cells)
          let timeIndex, artistIndex, titleIndex, albumIndex, statusIndex, idCell;
          if (cells.length >= 9 && cells[1].match(/^\d{6}-\w{3}$/)) {
            // New format with ID: | ID | Time | Artist | Title | Album | Status | ...
            idCell = cells[1];
            timeIndex = 2;
            artistIndex = 3;
            titleIndex = 4;
            albumIndex = 5;
            statusIndex = 6;

            // Extract counter from ID to update dailyCounter (format: HHMMSS-NNN)
            const counterMatch = idCell.match(/^\d{6}-(\d{3})$/);
            if (counterMatch) {
              const counter = parseInt(counterMatch[1], 10);
              this.dailyCounter = Math.max(this.dailyCounter, counter);
            }
          } else if (cells.length >= 6) {
            // Legacy format: | Time | Artist | Title | Album | Status | ...
            timeIndex = 1;
            artistIndex = 2;
            titleIndex = 3;
            albumIndex = 4;
            statusIndex = 5;
          } else {
            continue;
          }

          const time = cells[timeIndex]; // HH:mm format
          const artist = cells[artistIndex].replace(/\\/g, ''); // Remove escape chars
          const title = cells[titleIndex].replace(/\\/g, '');
          const album = cells[albumIndex] !== '-' ? cells[albumIndex].replace(/\\/g, '') : '';

          if (time && time.match(/^\d{2}:\d{2}$/)) {
            const [hour, minute] = time.split(':');
            const albumKey = album ? `-${album}` : '';
            const uniqueId = `${artist}-${title}${albumKey}-${dateString}-${hour}-${minute}`;
            this.dailyCache.add(uniqueId);

            // Also add to recent entries cache for better duplicate prevention
            const songKey = `${artist}-${title}${albumKey}`;
            this.recentEntries.set(songKey, Date.now());

            // Update statistics from status column
            const status = cells[statusIndex];
            if (status) {
              this.dailyStats.total++;
              if (status.includes('Found')) this.dailyStats.found++;
              else if (status.includes('Not Found')) this.dailyStats.notFound++;
              else if (status.includes('Low Match')) this.dailyStats.lowConfidence++;
              else if (status.includes('Duplicate')) this.dailyStats.duplicates++;
            }
          }
        }

        // Old format for backward compatibility: ### [HH:mm] Artist - Title
        const headerMatch = line.match(/^### \[(\d{2}):(\d{2})\] (.+) - (.+)$/);
        if (headerMatch) {
          const [, hour, , artist, title] = headerMatch;

          // Look for album on the next non-empty line
          let album = '';
          if (i + 2 < lines.length) {
            const albumMatch = lines[i + 2].match(/^- \*\*Album\*\*: (.+)$/);
            if (albumMatch) {
              album = `-${albumMatch[1]}`;
            }
          }

          // Create unique ID using date-hour format to match createUniqueId
          const uniqueId = `${artist}-${title}${album}-${dateString}-${hour}`;
          this.dailyCache.add(uniqueId);
        }
      }

      Logger.debug(`Loaded ${this.dailyCache.size} existing entries for ${dateString}`);
    } catch (error) {
      Logger.warn(`Could not load existing entries for ${dateString}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private resetDailyCache(): void {
    this.dailyCache.clear();
    // Don't clear recentEntries - it should persist across daily cache resets
    // to prevent rapid consecutive duplicates
    this.cleanupRecentEntries(); // Just clean up old entries
    this.currentDate = dayjs().format('YYYY-MM-DD');
    this.dailyCounter = 0;
    this.dailyStats = { total: 0, found: 0, notFound: 0, lowConfidence: 0, duplicates: 0 };
  }

  private cleanupRecentEntries(): void {
    const now = Date.now();
    const cutoff = this.RECENT_WINDOW_MINUTES * 60 * 1000;

    for (const [key, timestamp] of this.recentEntries.entries()) {
      if (now - timestamp > cutoff) {
        this.recentEntries.delete(key);
      }
    }
  }

  private getRecentEntriesFilePath(): string {
    return join(tmpdir(), 'wwoz-tracker-recent-entries.json');
  }

  private async saveRecentEntries(): Promise<void> {
    try {
      const recentEntriesPath = this.getRecentEntriesFilePath();
      const data = Array.from(this.recentEntries.entries());
      await writeFile(recentEntriesPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      Logger.debug('Failed to save recent entries cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async loadRecentEntries(): Promise<void> {
    try {
      const recentEntriesPath = this.getRecentEntriesFilePath();
      if (!existsSync(recentEntriesPath)) {
        Logger.debug('No recent entries cache file found, starting fresh');
        return;
      }

      const content = await readFile(recentEntriesPath, 'utf8');
      const data = JSON.parse(content) as Array<[string, number]>;

      // Clear existing entries and load from file
      this.recentEntries.clear();
      for (const [key, timestamp] of data) {
        this.recentEntries.set(key, timestamp);
      }

      // Clean up old entries after loading
      this.cleanupRecentEntries();

      // Save cleaned cache back to file
      await this.saveRecentEntries();

      Logger.debug(`Loaded ${this.recentEntries.size} recent entries from cache`);
    } catch (error) {
      Logger.debug('Failed to load recent entries cache, starting fresh', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.recentEntries.clear();
    }
  }

  private async updateStatisticsInFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf8');

      // Update the statistics table
      const updatedContent = content.replace(
        /\| Total Tracks \| \d+ \|\n\| Successfully Found \| \d+ \|\n\| Not Found \| \d+ \|\n\| Low Confidence \| \d+ \|\n\| Duplicates \| \d+ \|/,
        `| Total Tracks | ${this.dailyStats.total} |\n| Successfully Found | ${this.dailyStats.found} |\n| Not Found | ${this.dailyStats.notFound} |\n| Low Confidence | ${this.dailyStats.lowConfidence} |\n| Duplicates | ${this.dailyStats.duplicates} |`
      );

      if (updatedContent !== content) {
        await writeFile(filePath, updatedContent, 'utf8');
      }
    } catch (error) {
      Logger.debug('Could not update statistics in file', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateRunSummary(status: 'completed' | 'stopped', stopReason?: string): Promise<void> {
    if (!config.archive.enabled) {
      return;
    }

    try {
      // Get archive file path for today
      const archivePath = this.getArchiveFilePath(dayjs());

      if (!existsSync(archivePath)) {
        Logger.warn('Archive file does not exist, cannot update summary');
        return;
      }

      let content = await readFile(archivePath, 'utf8');

      // Update Last Updated timestamp
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      content = content.replace(/- \*\*Last Updated\*\*: .*/, `- **Last Updated**: ${now}`);

      // Update Daily Statistics (this already works)
      await this.updateStatisticsInFile(archivePath);

      // Write updated content
      await writeFile(archivePath, content, 'utf8');

      Logger.info('Updated archive summary', {
        status,
        stopReason,
        timestamp: now,
        stats: this.dailyStats,
      });
    } catch (error) {
      Logger.error('Failed to update run summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
