import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import dayjs from 'dayjs';
import { Logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { ScrapedSong, SpotifyTrack, TrackMatch } from '../types/index.js';

export interface ArchiveEntry {
  song: ScrapedSong;
  match?: TrackMatch;
  isDuplicate?: boolean;
  status: 'found' | 'not_found' | 'duplicate' | 'low_confidence';
  error?: string;
  archivedAt: string;
}

export class ArchiveService {
  private dailyCache = new Set<string>();
  private currentDate = '';

  constructor() {
    this.resetDailyCache();
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

      // Get archive file path
      const archivePath = this.getArchiveFilePath(songDate);

      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(archivePath));

      // Read existing content or create new file
      let fileContent = await this.getOrCreateFileContent(archivePath, songDate);

      // Append new entry
      const entryMarkdown = this.formatEntryAsMarkdown(entry);
      fileContent += entryMarkdown;

      // Write updated content
      await writeFile(archivePath, fileContent, 'utf8');

      // Add to cache
      this.dailyCache.add(uniqueId);

      Logger.debug(`Archived song: ${entry.song.artist} - ${entry.song.title}`);
    } catch (error) {
      Logger.error('Failed to archive song', {
        song: `${entry.song.artist} - ${entry.song.title}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private createUniqueId(song: ScrapedSong, timestamp: dayjs.Dayjs): string {
    // Use only date and hour for deduplication to avoid archiving the same song multiple times
    // within the same hour (common when processing batches)
    const timeKey = timestamp.format('YYYY-MM-DD-HH');
    // Include album in the unique ID to differentiate versions of the same song
    const albumKey = song.album ? `-${song.album}` : '';
    return `${song.artist}-${song.title}${albumKey}-${timeKey}`;
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

## Tracks

`;
  }

  private formatEntryAsMarkdown(entry: ArchiveEntry): string {
    const timestamp = dayjs(entry.song.scrapedAt).format('HH:mm');
    const { song, match, status, isDuplicate } = entry;

    let statusIcon = '';
    let statusText = '';
    let spotifyLink = '';

    switch (status) {
      case 'found':
        statusIcon = '✅';
        statusText = `Found on Spotify (${match?.confidence.toFixed(1)}% match)`;
        spotifyLink = match?.track.external_urls.spotify
          ? `\n- **Spotify**: [Open in Spotify](${match.track.external_urls.spotify})`
          : '';
        break;
      case 'duplicate':
        statusIcon = '🔄';
        statusText = 'Already in playlist';
        spotifyLink = match?.track.external_urls.spotify
          ? `\n- **Spotify**: [Open in Spotify](${match.track.external_urls.spotify})`
          : '';
        break;
      case 'not_found':
        statusIcon = '❌';
        statusText = 'Not found on Spotify';
        break;
      case 'low_confidence':
        statusIcon = '⚠️';
        statusText = `Low confidence match (${match?.confidence.toFixed(1)}%)`;
        break;
    }

    const albumInfo = song.album ? `- **Album**: ${song.album}\n` : '';

    return `### [${timestamp}] ${song.artist} - ${song.title}

${albumInfo}- **Status**: ${statusIcon} ${statusText}${spotifyLink}
- **Scraped**: ${dayjs(song.scrapedAt).format('YYYY-MM-DD HH:mm:ss')}

`;
  }

  private async loadExistingEntries(dateString: string): Promise<void> {
    try {
      const archivePath = this.getArchiveFilePath(dayjs(dateString));

      if (!existsSync(archivePath)) {
        return;
      }

      const content = await readFile(archivePath, 'utf8');

      // Extract existing entries to prevent duplicates
      // First extract the entry header, then look for album info on the next line
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const headerMatch = lines[i].match(/^### \[(\d{2}):(\d{2})\] (.+) - (.+)$/);
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
    this.currentDate = dayjs().format('YYYY-MM-DD');
  }
}
