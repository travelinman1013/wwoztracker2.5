export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  public: boolean;
  collaborative: boolean;
  tracks: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export interface PlaylistTrack {
  track: {
    id: string;
    name: string;
    uri: string;
  } | null;
}

export interface PlaylistOptions {
  name?: string;
  description?: string;
  public?: boolean;
}