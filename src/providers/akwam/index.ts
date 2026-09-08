import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class AkwamProvider extends BaseProvider {
  id = 'akwam';
  name = 'Akwam (أكوام)';
  lang = 'ar';
  mainUrl = 'https://ak.sv';
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
    const url = `${this.mainUrl}/search?q=${encodeURIComponent(query)}`;
    const resp = await http.get(url);
    const items: ProviderItem[] = [];

    resp.$('div.col-lg-auto.col-md-4.col-6, div.widget-body div.entry-box').each((_, el) => {
      const titleEl = resp.$(el).find('h3.entry-title a, .entry-title a');
      const title = titleEl.text().trim();
      const href = resp.$(el).find('a').first().attr('href') || titleEl.attr('href');
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
      const isSeries = href.includes('/series/') || title.includes('مسلسل');
      const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: isSeries ? 'series' : 'movie',
        title,
        poster,
        year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    const path = type === 'series' ? 'series' : 'movies';
    const url = `${this.mainUrl}/${path}${page > 1 ? `?page=${page}` : ''}`;
    const resp = await http.get(url);
    const items: ProviderItem[] = [];

    resp.$('div.col-lg-auto.col-md-4.col-6, div.widget-body div.entry-box').each((_, el) => {
      const titleEl = resp.$(el).find('h3.entry-title a, .entry-title a');
      const title = titleEl.text().trim();
      const href = resp.$(el).find('a').first().attr('href') || titleEl.attr('href');
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
      const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type,
        title,
        poster,
        year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const resp = await http.get(fullUrl);

    const title = resp.$('h1.entry-title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Akwam Title';
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.picture img').attr('src'));
    const description = resp.$('.widget-body p.text-white').text().trim() || resp.$('meta[name="description"]').attr('content');

    const episodes: ProviderEpisode[] = [];
    if (type === 'series') {
      resp.$('div.widget-body div.entry-box').each((idx, el) => {
        const epLink = resp.$(el).find('a').attr('href');
        const epTitle = resp.$(el).find('.entry-title').text().trim() || `حلقة ${idx + 1}`;
        if (!epLink) return;

        const epNumMatch = epTitle.match(/حلقة\s*(\d+)/i) || epLink.match(/episode-(\d+)/i);
        const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1;
        const seasonNumMatch = epTitle.match(/موسم\s*(\d+)/i) || fullUrl.match(/season-(\d+)/i);
        const seasonNum = seasonNumMatch ? parseInt(seasonNumMatch[1], 10) : 1;

        episodes.push({
          id: this.formatId(epLink.replace(this.mainUrl, '')),
          title: epTitle,
          season: seasonNum,
          episode: epNum,
          url: this.fixUrl(epLink),
          poster,
        });
      });
    }

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type,
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
    const resp = await http.get(fullUrl);

    const streams: ResolvedStream[] = [];
    const directLinks: string[] = [];

    resp.$('a.link-btn[href*="/watch/"], a.link-btn[href*="/download/"]').each((_, el) => {
      const link = resp.$(el).attr('href');
      if (link) directLinks.push(this.fixUrl(link));
    });

    for (const dl of directLinks) {
      try {
        const dlResp = await http.get(dl, { referer: fullUrl });
        const extracted = await extractStreams(dl, fullUrl);
        streams.push(...extracted);

        // Check if dlResp contains direct player hrefs
        dlResp.$('a[href*=".mp4"], a[href*=".m3u8"]').each((_, a) => {
          const streamUrl = dlResp.$(a).attr('href');
          if (streamUrl) {
            streams.push({
              name: 'Akwam Direct',
              url: streamUrl,
              isM3u8: streamUrl.includes('.m3u8'),
              headers: { Referer: dl },
            });
          }
        });
      } catch (e) {
        this.logger.debug(`Error fetching download page: ${(e as Error).message}`);
      }
    }

    return streams.filter(s => s.url && s.url.startsWith('http'));
  }
}
