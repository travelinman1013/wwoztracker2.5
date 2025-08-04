export interface ScrapedSong {
  artist: string;
  title: string;
  album?: string;
  scrapedAt: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
}

export interface TrackMatch {
  track: SpotifyTrack;
  confidence: number;
}

export interface ProcessingStats {
  processed: number;
  successful: number;
  failed: number;
  duplicates: number;
  consecutiveDuplicates: number;
}