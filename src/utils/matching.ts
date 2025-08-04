import stringSimilarity from 'string-similarity';
import type { ScrapedSong, SpotifyTrack } from '../types/index.js';

export class SongMatcher {
  
  static computeConfidence(scraped: ScrapedSong, spotifyTrack: SpotifyTrack): number {
    // Extract featured artists from title
    const featured = this.extractFeaturedArtists(scraped.title);
    let scrapedArtist = scraped.artist;
    
    if (featured) {
      scrapedArtist += ', ' + featured;
    }
    
    const spotifyArtist = spotifyTrack.artists.map(a => a.name).join(', ');
    
    // Normalize strings for comparison
    const normalizedScrapedArtist = this.normalize(scrapedArtist);
    const normalizedSpotifyArtist = this.normalize(spotifyArtist);
    const normalizedScrapedTitle = this.normalize(this.cleanTitle(scraped.title));
    const normalizedSpotifyTitle = this.normalize(spotifyTrack.name);
    
    // Also compare with parenthetical/bracketed content removed
    const scrapedTitleNoParens = this.stripParentheses(normalizedScrapedTitle);
    const spotifyTitleNoParens = this.stripParentheses(normalizedSpotifyTitle);
    
    // Calculate similarity scores
    const artistScore = stringSimilarity.compareTwoStrings(
      normalizedScrapedArtist,
      normalizedSpotifyArtist
    );
    
    const titleScoreFull = stringSimilarity.compareTwoStrings(
      normalizedScrapedTitle,
      normalizedSpotifyTitle
    );
    
    const titleScoreNoParens = stringSimilarity.compareTwoStrings(
      scrapedTitleNoParens,
      spotifyTitleNoParens
    );
    
    // Use the higher title score
    let titleScore = Math.max(titleScoreFull, titleScoreNoParens);
    
    // Boost score for partial matches
    if (this.hasPartialMatch(normalizedScrapedTitle, normalizedSpotifyTitle) ||
        this.hasPartialMatch(scrapedTitleNoParens, spotifyTitleNoParens)) {
      titleScore = Math.max(titleScore, 0.9);
    }
    
    // Try matching first words
    if (this.hasFirstWordMatch(normalizedScrapedTitle, normalizedSpotifyTitle)) {
      titleScore = Math.max(titleScore, 0.85);
    }
    
    // Calculate weighted confidence score
    return (artistScore * 0.6 + titleScore * 0.4) * 100;
  }
  
  private static extractFeaturedArtists(title: string): string {
    const match = title.match(/(?:featuring|feat\.?|ft\.?)(.*)/i);
    if (match) {
      return match[1].replace(/[^a-zA-Z0-9, ]/g, '').trim();
    }
    return '';
  }
  
  private static cleanTitle(title: string): string {
    return title
      .replace(/(?:featuring|feat\.?|ft\.?)(.*)/i, '') // Remove featuring
      .replace(/^[A-Z]?\d{1,2}[.\-_ ]+/, '') // Remove track numbers like 'B.03.', '01.'
      .replace(/[-_][A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/, '') // Remove trailing codes
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private static normalize(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/&amp;/gi, ' __and__ ')
      .replace(/&/g, ' __and__ ')
      .replace(/\band\b/gi, ' __and__ ')
      .replace(/[-–—_]/g, ' ') // Replace various dashes and underscores
      .replace(/[^a-z0-9 __and__]/gi, '') // Keep only alphanumeric, spaces, and __and__
      .replace(/__and__/g, 'and')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  }
  
  private static stripParentheses(str: string): string {
    return str
      .replace(/[\(\[].*?[\)\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private static hasPartialMatch(str1: string, str2: string): boolean {
    return str1.includes(str2) || 
           str2.includes(str1) || 
           str1.length > 3 && str2.includes(str1.substring(0, str1.length - 2)) ||
           str2.length > 3 && str1.includes(str2.substring(0, str2.length - 2));
  }
  
  private static hasFirstWordMatch(str1: string, str2: string): boolean {
    const firstWord1 = str1.split(' ')[0];
    const firstWord2 = str2.split(' ')[0];
    
    if (firstWord1.length < 3 || firstWord2.length < 3) return false;
    
    return str1.includes(firstWord2) || str2.includes(firstWord1);
  }
}

export class TextNormalizer {
  
  static normalizeForSearch(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  static removeCommonWords(text: string): string {
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/);
    const filtered = words.filter(word => !commonWords.includes(word) && word.length > 2);
    return filtered.join(' ');
  }
  
  static extractKeywords(text: string, maxKeywords = 5): string[] {
    const normalized = this.normalizeForSearch(text);
    const withoutCommon = this.removeCommonWords(normalized);
    const words = withoutCommon.split(/\s+/).filter(word => word.length > 2);
    
    // Sort by length descending and take the longest words as keywords
    return words
      .sort((a, b) => b.length - a.length)
      .slice(0, maxKeywords);
  }
}

export class MatchValidator {
  
  static isValidMatch(scraped: ScrapedSong, spotifyTrack: SpotifyTrack, confidence: number): boolean {
    // Basic confidence threshold
    if (confidence < 70) return false;
    
    // Artist name should have some similarity
    const artistSimilarity = stringSimilarity.compareTwoStrings(
      TextNormalizer.normalizeForSearch(scraped.artist),
      TextNormalizer.normalizeForSearch(spotifyTrack.artists[0].name)
    );
    
    if (artistSimilarity < 0.3) return false;
    
    // Title should have meaningful similarity
    const titleSimilarity = stringSimilarity.compareTwoStrings(
      TextNormalizer.normalizeForSearch(scraped.title),
      TextNormalizer.normalizeForSearch(spotifyTrack.name)
    );
    
    if (titleSimilarity < 0.4) return false;
    
    return true;
  }
  
  static explainMatch(scraped: ScrapedSong, spotifyTrack: SpotifyTrack, confidence: number): string {
    const reasons: string[] = [];
    
    const artistSim = stringSimilarity.compareTwoStrings(
      scraped.artist.toLowerCase(),
      spotifyTrack.artists[0].name.toLowerCase()
    );
    
    const titleSim = stringSimilarity.compareTwoStrings(
      scraped.title.toLowerCase(),
      spotifyTrack.name.toLowerCase()
    );
    
    if (artistSim > 0.8) reasons.push('exact artist match');
    else if (artistSim > 0.6) reasons.push('good artist match');
    else if (artistSim > 0.3) reasons.push('partial artist match');
    
    if (titleSim > 0.8) reasons.push('exact title match');
    else if (titleSim > 0.6) reasons.push('good title match');
    else if (titleSim > 0.3) reasons.push('partial title match');
    
    return `Confidence: ${confidence.toFixed(1)}% (${reasons.join(', ')})`;
  }
}