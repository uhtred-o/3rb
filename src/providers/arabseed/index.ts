import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class ArabseedProvider extends BaseProvider {
  id = 'arabseed';
  name = 'Arabseed (عرب سيد)';
  lang = 'ar';
  mainUrl = 'https://m4.arabseed.one';
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
    const url = `${this.mainUrl}/find/?find=${encodeURIComponent(query)}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.MovieBlock, div.PostBlock').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('h4, .BlockItemTitle, .Title').text().trim() || a.attr('title') || '';
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
    resp.$('div.MovieBlock, div.PostBlock').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('h4, .BlockItemTitle, .Title').text().trim() || a.attr('title') || '';
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

    const title = resp.$('h1.Title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Arabseed Title';
    const poster = this.fixUrl(resp.$('.Poster img').attr('data-src') || resp.$('.Poster img').attr('src'));
    const description = resp.$('.Story p').text().trim();

    const episodes: ProviderEpisode[] = [];
    if (type === 'series' || fullUrl.includes('/series/')) {
      resp.$('div.ContainerEpisodesList a').each((idx, el) => {
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
    const watchBtnHref = resp.$('a.watchBTn, a[href*="/watch/"]').attr('href');
    const watchPageUrl = watchBtnHref ? this.fixUrl(watchBtnHref) : fullUrl;

    try {
      const watchResp = await http.get(watchPageUrl, {
        headers: { 'User-Agent': MOBILE_USER_AGENT, Referer: fullUrl },
      });

      const serverLinks: string[] = [];
      watchResp.$('ul.serversList li[data-link], [data-embed]').each((_, el) => {
        const link = watchResp.$(el).attr('data-link') || watchResp.$(el).attr('data-embed');
        if (link) serverLinks.push(this.fixUrl(link));
      });

      const iframeSrc = watchResp.$('iframe.player-iframe, iframe[src*="embed"]').attr('src');
      if (iframeSrc) serverLinks.push(this.fixUrl(iframeSrc));

      for (const sUrl of serverLinks) {
        const extracted = await extractStreams(sUrl, watchPageUrl);
        streams.push(...extracted);
      }
    } catch (e) {
      this.logger.debug(`Error loading watch page: ${(e as Error).message}`);
    }

    return streams;
  }
}
