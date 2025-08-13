import puppeteer from 'puppeteer';
import sanitizeHtml from 'sanitize-html';
import he from 'he';
import Bottleneck from 'bottleneck';
import { config } from '../config/index.js';
import { ScrapingError } from '../types/errors.js';
import { Logger } from '../utils/logger.js';
import type { ScrapedSong } from '../types/index.js';

export class ScrapingService {
  private limiter: Bottleneck;

  constructor() {
    this.limiter = new Bottleneck(config.rateLimit.wwoz);
  }

  async scrapeLatestSong(): Promise<ScrapedSong | null> {
    const result = await this.limiter.schedule(() => this.performScrape(1));
    return Array.isArray(result) ? result[0] || null : result;
  }

  async scrapeAllSongs(): Promise<ScrapedSong[]> {
    const result = await this.limiter.schedule(() => this.performScrape());
    return Array.isArray(result) ? result : [];
  }

  async scrapeFirstNSongs(n: number): Promise<ScrapedSong[]> {
    const result = await this.limiter.schedule(() => this.performScrape(n));
    return Array.isArray(result) ? result : [];
  }

  private async performScrape(limit?: number): Promise<ScrapedSong[] | ScrapedSong | null> {
    let browser;

    try {
      Logger.debug('Launching Puppeteer browser', { chromePath: config.chromePath });
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath: config.chromePath,
        timeout: config.wwoz.timeout,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      // Set a reasonable viewport and user agent
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Disable cache to ensure fresh data
      await page.setCacheEnabled(false);
      await page.setExtraHTTPHeaders({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });

      // Navigate to WWOZ playlist page with cache-busting parameter
      const cacheBustingUrl = `${config.wwoz.playlistUrl}?t=${Date.now()}`;
      Logger.debug('Navigating to WWOZ playlist page', { url: cacheBustingUrl });
      await page.goto(cacheBustingUrl, {
        waitUntil: 'domcontentloaded',
        timeout: config.wwoz.timeout,
      });

      // Wait for dynamic content to load
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Wait for the playlist table to appear
      await page.waitForSelector('table.table-condensed tbody tr', {
        timeout: 30000,
      });

      // Extract song data
      const songs = await page.evaluate((songLimit?: number) => {
        const rows = Array.from(document.querySelectorAll('table.table-condensed tbody tr'));
        const selectedRows = songLimit ? rows.slice(0, songLimit) : rows;

        return selectedRows.map((row: Element) => {
          const artist = row.querySelector('td[data-bind="artist"]')?.textContent?.trim() || '';
          const title = row.querySelector('td[data-bind="title"]')?.textContent?.trim() || '';
          const album = row.querySelector('td[data-bind="album"]')?.textContent?.trim() || '';
          return { artist, title, album };
        });
      }, limit);

      // Process and sanitize the scraped data
      const scrapedAt = new Date().toISOString();
      const processedSongs = songs
        .map((song) => this.processSongData(song, scrapedAt))
        .filter((song) => song.artist && song.title);

      if (!processedSongs.length) {
        throw new ScrapingError('No valid songs found on the playlist page');
      }

      Logger.info(`Successfully scraped ${processedSongs.length} songs from WWOZ`);

      // Log first few songs to help debug if fresh data is being retrieved
      if (processedSongs.length > 0) {
        const firstThree = processedSongs
          .slice(0, 3)
          .map((song) => `${song.artist} - ${song.title}`);
        Logger.debug('First 3 scraped songs:', { songs: firstThree, scrapedAt });
      }

      // Return appropriate format based on whether we're scraping one song or multiple
      if (limit === 1) {
        return processedSongs[0] || null;
      }

      return processedSongs;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scraping error';
      throw new ScrapingError(`Failed to scrape WWOZ playlist: ${message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private processSongData(
    rawSong: { artist: string; title: string; album: string },
    scrapedAt: string
  ): ScrapedSong {
    return {
      artist: this.sanitizeText(rawSong.artist),
      title: this.sanitizeText(rawSong.title),
      album: rawSong.album ? this.sanitizeText(rawSong.album) : undefined,
      scrapedAt,
    };
  }

  private sanitizeText(text: string): string {
    if (!text) return '';

    // First sanitize HTML
    const sanitized = sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
    });

    // Then decode HTML entities
    const decoded = he.decode(sanitized);

    // Clean up whitespace and return
    return decoded.replace(/\s+/g, ' ').trim();
  }

  async testConnection(): Promise<boolean> {
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: config.chromePath,
        timeout: 10000,
      });

      const page = await browser.newPage();
      await page.goto(config.wwoz.playlistUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      const hasPlaylistTable = (await page.$('table.table-condensed')) !== null;
      await browser.close();

      return hasPlaylistTable;
    } catch {
      return false;
    }
  }
}
