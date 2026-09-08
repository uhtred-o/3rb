import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http } from '../../utils/http.js';
import { decryptYacine } from '../../utils/crypto.js';

export class YacineTVProvider extends BaseProvider {
  id = 'yacinetv';
  name = 'Yacine TV (بث مباشر)';
  lang = 'ar';
  mainUrl = 'https://def.ycnapi.com/api';
  private fallbackUrl = 'https://deft.yacinelive.com/api';
  supportedTypes: StremioContentType[] = ['tv', 'channel'];

  constructor() {
    super();
    this.initLogger();
  }

  private async fetchApi(path: string): Promise<any> {
    const urls = [this.mainUrl, this.fallbackUrl];
    for (const baseUrl of urls) {
      try {
        const fullUrl = `${baseUrl}/${path}`.replace(/([^:]\/)\/+/g, '$1');
        const resp = await http.get(fullUrl, {
          headers: {
            'User-Agent': 'okhttp/4.12.0',
          },
          timeout: 8000,
        });

        if (resp.status === 200) {
          const tHeader = resp.headers['t'] || '';
          const decrypted = decryptYacine(resp.text, tHeader);
          if (decrypted) {
            return JSON.parse(decrypted);
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const qLower = query.toLowerCase();
    const catData = await this.fetchApi('categories');
    const categories = catData?.data || [];
    const results: ProviderItem[] = [];

    for (const cat of categories) {
      const chData = await this.fetchApi(`categories/${cat.id}/channels`);
      const channels = chData?.data || [];

      for (const ch of channels) {
        if (ch.name?.toLowerCase().includes(qLower)) {
          results.push({
            id: this.formatId(String(ch.id)),
            provider: this.name,
            type: 'tv',
            title: ch.name || 'قناة',
            poster: ch.logo,
            description: `بث مباشر لقناة ${ch.name}`,
            url: `${this.mainUrl}/channel/${ch.id}`,
          });
        }
      }
    }

    return results;
  }

  async getCatalogInternal(_type: StremioContentType, _page: number = 1): Promise<ProviderItem[]> {
    const catData = await this.fetchApi('categories');
    const categories = catData?.data || [];
    const results: ProviderItem[] = [];

    for (const cat of categories.slice(0, 5)) {
      const chData = await this.fetchApi(`categories/${cat.id}/channels`);
      const channels = chData?.data || [];

      for (const ch of channels) {
        results.push({
          id: this.formatId(String(ch.id)),
          provider: this.name,
          type: 'tv',
          title: ch.name || 'قناة',
          poster: ch.logo,
          description: `قسم ${cat.name} - بث مباشر`,
          url: `${this.mainUrl}/channel/${ch.id}`,
        });
      }
    }

    return results;
  }

  async getMetaInternal(contentId: string, _type: StremioContentType): Promise<ProviderDetail | null> {
    const chData = await this.fetchApi(`channel/${contentId}`);
    const streams = chData?.data || [];
    const firstStream = streams[0];

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: 'tv',
      title: firstStream?.name || `قناة ${contentId}`,
      poster: firstStream?.logo,
      description: `شاهد البث المباشر لقناة ${firstStream?.name || contentId}`,
      url: `${this.mainUrl}/channel/${contentId}`,
    };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType): Promise<ResolvedStream[]> {
    const data = await this.fetchApi(`channel/${contentId}`);
    const streams = data?.data || [];
    const resolved: ResolvedStream[] = [];

    for (const stream of streams) {
      let finalUrl = stream.url?.replace('www.elahmad.coo', 'www.elahmad.com') || '';
      if (!finalUrl) continue;

      const streamHeaders: Record<string, string> = {
        'User-Agent': 'okhttp/4.12.0',
      };

      if (stream.headers && typeof stream.headers === 'object') {
        for (const [k, v] of Object.entries(stream.headers)) {
          if (typeof v === 'string') streamHeaders[k] = v;
        }
      }

      resolved.push({
        name: `Yacine TV - ${stream.name || 'Server'}`,
        quality: 'Live HD',
        url: finalUrl,
        isM3u8: true,
        headers: streamHeaders,
      });
    }

    return resolved;
  }
}
