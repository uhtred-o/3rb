export type StremioContentType = 'movie' | 'series' | 'channel' | 'tv' | 'anime';

export interface StremioManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  resources: Array<
    | 'catalog'
    | 'meta'
    | 'stream'
    | 'subtitles'
    | {
        name: 'catalog' | 'meta' | 'stream' | 'subtitles';
        types: StremioContentType[];
        idPrefixes?: string[];
      }
  >;
  types: StremioContentType[];
  catalogs: StremioCatalogDef[];
  idPrefixes?: string[];
  background?: string;
  logo?: string;
  contactEmail?: string;
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
    configurable?: boolean;
    configurationRequired?: boolean;
  };
}

export interface StremioCatalogDef {
  type: StremioContentType;
  id: string;
  name: string;
  extra?: Array<{
    name: 'search' | 'genre' | 'skip';
    isRequired?: boolean;
    options?: string[];
  }>;
}

export interface StremioCatalogItem {
  id: string;
  type: StremioContentType;
  name: string;
  poster?: string;
  description?: string;
  genres?: string[];
  releaseInfo?: string;
  imdbRating?: string;
}

export interface StremioMetaVideo {
  id: string;
  title: string;
  released?: string;
  thumbnail?: string;
  episode: number;
  season: number;
  overview?: string;
}

export interface StremioMetaDetail {
  id: string;
  type: StremioContentType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: number;
  genres?: string[];
  imdbRating?: string;
  director?: string[];
  cast?: string[];
  videos?: StremioMetaVideo[];
  behaviorHints?: {
    defaultVideoId?: string;
    hasScheduledVideos?: boolean;
  };
}

export interface StremioStream {
  name: string;
  title?: string;
  url?: string;
  externalUrl?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    proxyHeaders?: {
      request?: Record<string, string>;
      response?: Record<string, string>;
    };
  };
}

export interface StremioSubtitle {
  id: string;
  url: string;
  lang: string;
}
