import { IProvider, ProviderDetail, ProviderItem, ResolvedStream } from '../types/provider.js';
import { StremioContentType } from '../types/stremio.js';
import { globalCache } from '../utils/cache.js';
import { Logger } from '../utils/logger.js';

export abstract class BaseProvider implements IProvider {
  abstract id: string;
  abstract name: string;
  abstract lang: string;
  abstract mainUrl: string;
  abstract supportedTypes: StremioContentType[];

  protected logger!: Logger;

  protected initLogger() {
    this.logger = new Logger(this.name);
  }

  // Helper to format namespaced IDs: e.g. "akwam:series/123"
  protected formatId(rawId: string): string {
    return `${this.id}:${rawId}`;
  }

  // Parse namespaced ID: e.g. "akwam:series/123" -> "series/123"
  parseId(fullId: string): string {
    if (fullId.startsWith(`${this.id}:`)) {
      return fullId.substring(this.id.length + 1);
    }
    return fullId;
  }

  abstract searchInternal(query: string): Promise<ProviderItem[]>;
  abstract getCatalogInternal(type: StremioContentType, page: number): Promise<ProviderItem[]>;
  abstract getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null>;
  abstract getStreamsInternal(contentId: string, type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]>;

  async search(query: string): Promise<ProviderItem[]> {
    const cacheKey = `search:${this.id}:${query}`;
    const cached = globalCache.get<ProviderItem[]>(cacheKey);
    if (cached) return cached;

    try {
      this.logger.debug(`Searching for query: ${query}`);
      const results = await this.searchInternal(query);
      if (results && results.length > 0) {
        globalCache.set(cacheKey, results, 180);
      }
      return results;
    } catch (err) {
      this.logger.error(`Search error for "${query}": ${(err as Error).message}`);
      return [];
    }
  }

  async getCatalog(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    if (!this.supportedTypes.includes(type)) return [];

    const cacheKey = `catalog:${this.id}:${type}:${page}`;
    const cached = globalCache.get<ProviderItem[]>(cacheKey);
    if (cached) return cached;

    try {
      this.logger.debug(`Fetching catalog type=${type} page=${page}`);
      const results = await this.getCatalogInternal(type, page);
      if (results && results.length > 0) {
        globalCache.set(cacheKey, results, 300);
      }
      return results;
    } catch (err) {
      this.logger.error(`Catalog error for type ${type} page ${page}: ${(err as Error).message}`);
      return [];
    }
  }

  async getMeta(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const rawId = this.parseId(contentId);
    const cacheKey = `meta:${this.id}:${rawId}`;
    const cached = globalCache.get<ProviderDetail>(cacheKey);
    if (cached) return cached;

    try {
      this.logger.debug(`Fetching meta for ${rawId} (${type})`);
      const meta = await this.getMetaInternal(rawId, type);
      if (meta) {
        globalCache.set(cacheKey, meta, 600);
      }
      return meta;
    } catch (err) {
      this.logger.error(`Meta error for ${rawId}: ${(err as Error).message}`);
      return null;
    }
  }

  async getStreams(contentId: string, type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const rawContentId = this.parseId(contentId);
    const rawEpisodeId = episodeId ? this.parseId(episodeId) : undefined;
    const cacheKey = `streams:${this.id}:${rawContentId}:${rawEpisodeId || 'single'}`;
    const cached = globalCache.get<ResolvedStream[]>(cacheKey);
    if (cached) return cached;

    try {
      this.logger.debug(`Resolving streams for ${rawContentId} ep=${rawEpisodeId || 'none'}`);
      const streams = await this.getStreamsInternal(rawContentId, type, rawEpisodeId);
      if (streams.length > 0) {
        globalCache.set(cacheKey, streams, 180); // 3 minutes cache for live streams
      }
      return streams;
    } catch (err) {
      this.logger.error(`Stream resolution error: ${(err as Error).message}`);
      return [];
    }
  }
}
