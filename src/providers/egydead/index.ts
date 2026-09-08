import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class EgydeadProvider extends BaseProvider {
  id = 'egydead';
  name = 'Egydead (إيجي ديد)';
  lang = 'ar';
  mainUrl = 'https://egydead.beer';
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
    const url = `${this.mainUrl}/?s=${encodeURIComponent(query)}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.MovieBlock, div.PostBlock, div.moviesList div.item').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('.Title, h2, h3').text().trim() || a.attr('title') || '';
      const href = a.attr('href');
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
      const isSeries = href.includes('/series/') || title.includes('مسلسل');

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
    const path = type === 'series' ? 'category/series' : 'category/movies';
    const url = `${this.mainUrl}/${path}/page/${page}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.MovieBlock, div.PostBlock, div.moviesList div.item').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('.Title, h2, h3').text().trim() || a.attr('title') || '';
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

    const title = resp.$('h1.Title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Egydead Title';
    const poster = this.fixUrl(resp.$('.Poster img').attr('data-src') || resp.$('.Poster img').attr('src'));
    const description = resp.$('.Story p, .desc').text().trim();

    const episodes: ProviderEpisode[] = [];
    if (type === 'series' || fullUrl.includes('/series/')) {
      resp.$('.episodes-list a, .seasons-list a').each((idx, el) => {
        const epHref = resp.$(el).attr('href');
        const epTitle = resp.$(el).text().trim() || `حلقة ${idx + 1}`;
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
    }

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: episodes.length > 0 ? 'series' : 'movie',
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

    const streams: ResolvedStream[] = [];

    try {
      const watchUrl = `${fullUrl}?view=watch`;
      const resp = await http.post(watchUrl, {
        form: { View: '1' },
        headers: {
          'User-Agent': MOBILE_USER_AGENT,
          Referer: fullUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const serverLinks: string[] = [];

      resp.$('ul.serversList li [data-link], button[data-link]').each((_, el) => {
        const link = resp.$(el).attr('data-link');
        if (link) serverLinks.push(this.fixUrl(link));
      });

      resp.$('ul.donwload-servers-list li a.ser-link').each((_, el) => {
        const link = resp.$(el).attr('href');
        if (link) serverLinks.push(this.fixUrl(link));
      });

      for (const link of serverLinks) {
        const extracted = await extractStreams(link, watchUrl);
        streams.push(...extracted);
      }
    } catch (e) {
      this.logger.warn(`Egydead link extraction encountered notice: ${(e as Error).message}`);
    }

    return streams;
  }
}
