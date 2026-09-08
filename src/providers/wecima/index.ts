import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { safeBase64Decode } from '../../utils/crypto.js';
import { extractStreams } from '../../extractors/index.js';

export class WecimaProvider extends BaseProvider {
  id = 'wecima';
  name = 'We Cima (وي سيما)';
  lang = 'ar';
  mainUrl = 'https://mycima.motorcycles';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() {
    super();
    this.initLogger();
  }

  private fixUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${this.mainUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const url = `${this.mainUrl}/search.php?keywords=${encodeURIComponent(query)}`;
    const resp = await http.get(url);

    const items: ProviderItem[] = [];
    const seen = new Set<string>();

    resp.$('a[href*="watch.php"]').each((_, a) => {
      const href = resp.$(a).attr('href');
      const title = resp.$(a).text().trim() || resp.$(a).attr('title') || '';
      if (!title || !href || seen.has(href) || title.length < 3) return;
      seen.add(href);

      const poster = this.fixUrl(resp.$(a).find('img').attr('src'));
      const isSeries = href.includes('series') || title.includes('مسلسل');

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: isSeries ? 'series' : 'movie',
        title,
        poster,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    const pageParam = page > 1 ? `?page=${page}` : '';
    const url = type === 'series'
      ? `${this.mainUrl}/episodes.php${pageParam}`
      : `${this.mainUrl}/movies.php${pageParam}`;

    const resp = await http.get(url);

    const items: ProviderItem[] = [];
    const seen = new Set<string>();

    resp.$('a[href*="watch.php"]').each((_, a) => {
      const href = resp.$(a).attr('href');
      const title = resp.$(a).text().trim() || resp.$(a).attr('title') || '';
      if (!title || !href || seen.has(href) || title.includes('.ribon') || title.length < 3) return;
      seen.add(href);

      const poster = this.fixUrl(resp.$(a).find('img').attr('src'));

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type,
        title,
        poster,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const resp = await http.get(fullUrl);

    const title = resp.$('h1').first().text().trim() || resp.$('title').text().trim() || 'WeCima Title';
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.video-bibplayer-poster').css('background-image')?.replace(/url\(['"]?(.*?)['"]?\)/, '$1'));
    const description = resp.$('meta[property="og:description"]').attr('content') || resp.$('.video-description').text().trim();

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type,
      title,
      poster,
      description,
      url: fullUrl,
    };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, _episodeId?: string): Promise<ResolvedStream[]> {
    const fullUrl = this.fixUrl(contentId);
    const streams: ResolvedStream[] = [];

    // Extract vid param
    const vidMatch = fullUrl.match(/vid=([a-zA-Z0-9]+)/);
    const playUrl = vidMatch ? `${this.mainUrl}/play.php?vid=${vidMatch[1]}` : fullUrl;

    try {
      const playRes = await http.get(playUrl, { headers: { Referer: fullUrl } });
      const iframes: string[] = [];
      playRes.$('iframe').each((_, ifr) => {
        const src = playRes.$(ifr).attr('src');
        if (src) iframes.push(this.fixUrl(src));
      });

      for (const ifr of iframes) {
        const extracted = await extractStreams(ifr, playUrl);
        streams.push(...extracted);
      }
    } catch (e) {
      this.logger.debug(`Error getting WeCima streams: ${(e as Error).message}`);
    }

    return streams;
  }
}
