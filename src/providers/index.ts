import { IProvider, ProviderDetail, ProviderItem, ResolvedStream } from '../types/provider.js';
import { StremioContentType } from '../types/stremio.js';
import { AkwamProvider } from './akwam/index.js';
import { YacineTVProvider } from './yacinetv/index.js';
import { SyriaLiveProvider } from './syrialive/index.js';
import { WecimaProvider } from './wecima/index.js';
import { FaselhdProvider } from './faselhd/index.js';
import { ArabseedProvider } from './arabseed/index.js';
import { Anime4upProvider } from './anime4up/index.js';
import { WitAnimeProvider } from './witanime/index.js';
import { ThreeIskProvider } from './3isk/index.js';
import { EgydeadProvider } from './egydead/index.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ProviderRegistry');

export class ProviderRegistry {
  private providers: Map<string, IProvider> = new Map();

  constructor() {
    this.register(new AkwamProvider());
    this.register(new YacineTVProvider());
    this.register(new SyriaLiveProvider());
    this.register(new WecimaProvider());
    this.register(new FaselhdProvider());
    this.register(new ArabseedProvider());
    this.register(new Anime4upProvider());
    this.register(new WitAnimeProvider());
    this.register(new ThreeIskProvider());
    this.register(new EgydeadProvider());
  }

  register(provider: IProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): IProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): IProvider[] {
    return Array.from(this.providers.values());
  }

  getProvidersForType(type: StremioContentType): IProvider[] {
    return this.getAllProviders().filter((p) => p.supportedTypes.includes(type));
  }

  parseProviderAndId(fullId: string): { provider: IProvider | null; contentId: string } {
    const parts = fullId.split(':');
    if (parts.length >= 2) {
      const providerId = parts[0];
      const contentId = parts.slice(1).join(':');
      const provider = this.getProvider(providerId) || null;
      return { provider, contentId };
    }
    return { provider: null, contentId: fullId };
  }

  async searchAll(query: string): Promise<ProviderItem[]> {
    logger.info(`Searching across all providers for: "${query}"`);
    const promises = this.getAllProviders().map(async (provider) => {
      try {
        return await provider.search(query);
      } catch (err) {
        logger.error(`Error in search for provider ${provider.name}: ${(err as Error).message}`);
        return [];
      }
    });

    const results = await Promise.all(promises);
    return results.flat();
  }

  async getCatalog(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    const eligibleProviders = this.getProvidersForType(type);
    const promises = eligibleProviders.map(async (provider) => {
      try {
        return await provider.getCatalog(type, page);
      } catch (err) {
        logger.error(`Error in catalog for provider ${provider.name}: ${(err as Error).message}`);
        return [];
      }
    });

    const results = await Promise.all(promises);
    return results.flat();
  }

  async getMeta(fullId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const { provider, contentId } = this.parseProviderAndId(fullId);
    if (!provider) {
      logger.warn(`No provider found for ID: ${fullId}`);
      return null;
    }

    try {
      return await provider.getMeta(contentId, type);
    } catch (err) {
      logger.error(`Error getting meta for ${fullId}: ${(err as Error).message}`);
      return null;
    }
  }

  async getStreams(fullId: string, type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const { provider, contentId } = this.parseProviderAndId(fullId);
    if (!provider) {
      logger.warn(`No provider found for stream ID: ${fullId}`);
      return [];
    }

    try {
      return await provider.getStreams(contentId, type, episodeId);
    } catch (err) {
      logger.error(`Error getting streams for ${fullId}: ${(err as Error).message}`);
      return [];
    }
  }
}

export const registry = new ProviderRegistry();
