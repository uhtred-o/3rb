import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { safeBase64Decode } from '../../utils/crypto.js';
import { extractStreams } from '../../extractors/index.js';

export class Anime4upProvider extends BaseProvider {
  id = 'anime4up';
  name = 'Anime4up (أنمي فور اب)';
  lang = 'ar';
  mainUrl = 'https://w1.anime4up.rest';
  supportedTypes: StremioContentType[] = ['anime', 'series', 'movie'];

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
    const url = `${this.mainUrl}/?search_string=${encodeURIComponent(query)}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.anime-card-container').each((_, el) => {
      const a = resp.$(el).find('.anime-title a');
      const title = a.text().trim();
      const href = a.attr('href');
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
      const isMovie = title.includes('فيلم') || href.includes('/movie/');

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: isMovie ? 'movie' : 'anime',
        title,
        poster,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    const path = type === 'movie' ? 'anime-type/movie' : 'anime-season';
    const url = `${this.mainUrl}/${path}/page/${page}/`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.anime-card-container').each((_, el) => {
      const a = resp.$(el).find('.anime-title a');
      const title = a.text().trim();
      const href = a.attr('href');
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));

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
    const resp = await http.get(fullUrl, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const title = resp.$('h1.anime-details-title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Anime Title';
    const poster = this.fixUrl(resp.$('.anime-thumbnail img').attr('src') || resp.$('meta[property="og:image"]').attr('content'));
    const description = resp.$('p.anime-story').text().trim();

    const episodes: ProviderEpisode[] = [];
    resp.$('div.episodes-card-container, div.DivEpisodesContainer a').each((idx, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a');
      const epHref = a.attr('href');
      const epTitle = a.text().trim() || `الحلقة ${idx + 1}`;
      if (!epHref) return;

      const epNumMatch = epTitle.match(/(\d+)/);
      const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1;

      episodes.push({
        id: this.formatId(epHref.replace(this.mainUrl, '')),
        title: epTitle,
        season: 1,
        episode: epNum,
        url: this.fixUrl(epHref),
        poster,
      });
    });

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: type === 'movie' ? 'movie' : 'anime',
      title,
      poster,
      description,
      url: fullUrl,
      episodes: episodes.length > 0 ? episodes : undefined,
    };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType, episodeId?: string): Promise<ResolvedStream[]> {
    const targetPath = episodeId || contentId;
    const fullUrl = this.fixUrl(targetPath);
    const resp = await http.get(fullUrl, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const streams: ResolvedStream[] = [];
    const serverLinks: string[] = [];

    resp.$('ul#episode-servers li a, div.server-item a').each((_, a) => {
      let dataUrl = resp.$(a).attr('data-ep-url') || resp.$(a).attr('data-url') || resp.$(a).attr('href');
      if (dataUrl) {
        if (!dataUrl.startsWith('http') && dataUrl.length > 20) {
          const decoded = safeBase64Decode(dataUrl);
          if (decoded.startsWith('http')) dataUrl = decoded;
        }
        if (dataUrl.startsWith('http')) {
          serverLinks.push(dataUrl);
        }
      }
    });

    for (const link of serverLinks) {
      const extracted = await extractStreams(link, fullUrl);
      streams.push(...extracted);
    }

    return streams;
  }
}
