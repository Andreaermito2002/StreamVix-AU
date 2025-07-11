export interface AnimeUnityConfig {
  mfpUrl: string;
  mfpPassword: string;
  bothLink: boolean;
  enabled: boolean;
}

export interface AnimeUnityResult {
  id: number;
  slug: string;
  name: string;
  episodes_count: number;
  language_type: 'Original' | 'Italian Dub' | 'Italian Sub';
}

export interface AnimeUnityEpisode {
  id: number;
  number: number;
  name: string;
}

export interface StreamData {
  embed_url?: string;
  mp4_url?: string;
  episode_page?: string;
}

export interface KitsuAnime {
  id: string;
  attributes: {
    titles: {
      en?: string;
      ja_jp?: string;
    };
    canonicalTitle: string;
    startDate: string;
  };
}

// ✅ AGGIUNTO: Export mancante
export interface StreamForStremio {
  title: string;
  url: string;
  behaviorHints: {
    notWebReady?: boolean;
    [key: string]: any;
  };
}
