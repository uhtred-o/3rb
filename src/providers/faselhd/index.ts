import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class FaselhdProvider extends BaseProvider {
  id = 'faselhd';
  name = 'FaselHD (فاصل إعلاني)';
  lang = 'ar';
  mainUrl = 'https://www.faselhd.ac';
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
    resp.$('div.postDiv').each((_, el) => {
      const a = resp.$(el).find('a');
      const title = resp.$(el).find('.h1, h1, .post-title').text().trim() || a.attr('title') || '';
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
    const path = type === 'series' ? 'series' : 'movies';
    const url = `${this.mainUrl}/${path}/page/${page}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.postDiv').each((_, el) => {
      const a = resp.$(el).find('a');
      const title = resp.$(el).find('.h1, h1, .post-title').text().trim() || a.attr('title') || '';
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

    const title = resp.$('h1.title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'FaselHD Title';
    const poster = this.fixUrl(resp.$('.posterImg img').attr('src') || resp.$('meta[property="og:image"]').attr('content'));
    const description = resp.$('.singleDesc p').text().trim();

    const episodes: ProviderEpisode[] = [];
    if (type === 'series' || fullUrl.includes('/series/')) {
      resp.$('#episodes div.epAll a, div.episodes-list a').each((idx, el) => {
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
    const resp = await http.get(fullUrl, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const streams: ResolvedStream[] = [];
    const iframeSrc = resp.$('iframe[src*="player"], iframe[src*="fasel"]').attr('src');
    if (iframeSrc) {
      const extracted = await extractStreams(this.fixUrl(iframeSrc), fullUrl);
      streams.push(...extracted);
    }

    // Check server buttons
    const serverLinks: string[] = [];
    resp.$('#show-servers-list button, ul.serversList li button').each((_, btn) => {
      const dataHref = resp.$(btn).attr('data-href') || resp.$(btn).attr('onclick')?.match(/https?:\/\/[^'"]+/)?.[0];
      if (dataHref) serverLinks.push(this.fixUrl(dataHref));
    });

    for (const sUrl of serverLinks) {
      const extracted = await extractStreams(sUrl, fullUrl);
      streams.push(...extracted);
    }

    return streams;
  }
}
