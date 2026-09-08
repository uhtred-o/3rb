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
  mainUrl = 'https://mycima.chat';
  supportedTypes: StremioContentType[] = ['movie', 'series'];

  constructor() {
    super();
    this.initLogger();
  }

  private decodeWecimaUrl(encodedStr?: string): string | null {
    if (!encodedStr || !encodedStr.trim()) return null;
    try {
      const cleaned = encodedStr.replace(/\+/g, '').trim();
      const finalB64 = !cleaned.startsWith('aHR0c') ? `aHR0c${cleaned}` : cleaned;
      const decoded = safeBase64Decode(finalB64);
      return decoded.startsWith('http') ? decoded : null;
    } catch {
      return null;
    }
  }

  private fixUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (!url.startsWith('http')) return `${this.mainUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    return url;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const url = `${this.mainUrl}/filtering/?keywords=${encodeURIComponent(query)}`;
    const resp = await http.get(url, {
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Referer: `${this.mainUrl}/`,
      },
    });

    const items: ProviderItem[] = [];
    resp.$('.GridItem').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('strong, h2, a').first().text().trim();
      const href = a.attr('href');
      if (!title || !href) return;

      const posterSpan = resp.$(el).find('span.BG--GridItem');
      let poster = posterSpan.attr('data-src');
      if (!poster) {
        const style = posterSpan.attr('style') || '';
        const match = style.match(/url\(['"]?(.*?)['"]?\)/i);
        if (match) poster = match[1];
      }

      const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
      const isSeries = href.includes('/series/') || href.includes('مسلسل') || title.includes('مسلسل');

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: isSeries ? 'series' : 'movie',
        title,
        poster: this.fixUrl(poster),
        year,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    const path = type === 'series' ? 'episodes' : 'movies';
    const url = page === 1 ? `${this.mainUrl}/${path}/` : `${this.mainUrl}/${path}/page/${page}/`;
    const resp = await http.get(url, {
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Referer: `${this.mainUrl}/`,
      },
    });

    const items: ProviderItem[] = [];
    resp.$('.GridItem').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('strong, h2, a').first().text().trim();
      const href = a.attr('href');
      if (!title || !href) return;

      const posterSpan = resp.$(el).find('span.BG--GridItem');
      let poster = posterSpan.attr('data-src');
      if (!poster) {
        const style = posterSpan.attr('style') || '';
        const match = style.match(/url\(['"]?(.*?)['"]?\)/i);
        if (match) poster = match[1];
      }

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type,
        title,
        poster: this.fixUrl(poster),
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const resp = await http.get(fullUrl, {
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Referer: `${this.mainUrl}/`,
      },
    });

    const isSeries = fullUrl.includes('/series/') || fullUrl.includes('مسلسل') || resp.$('.List--Seasons--Episodes').length > 0;
    const title = resp.$('div.Title--Content--Single-begin h1').text().trim() || resp.$('h1').first().text().trim() || 'WeCima Title';
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content'));
    const description = resp.$('div.StoryMovieContent').text().trim();

    const episodes: ProviderEpisode[] = [];
    if (isSeries || type === 'series') {
      // 1. Check multi-season / episode buttons
      resp.$('.Episodes--Seasons--Episodes a, .List--Seasons--Episodes a, .EpisodesList a').each((idx, el) => {
        const epHref = resp.$(el).attr('href');
        const epTitle = resp.$(el).text().trim() || `حلقة ${idx + 1}`;
        if (!epHref) return;

        const epNumMatch = epTitle.match(/حلقة\s*(\d+)/i) || epHref.match(/episode-(\d+)/i) || epHref.match(/الحلقة-(\d+)/i);
        const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : idx + 1;
        const seasonNumMatch = epTitle.match(/الموسم\s*(\d+)/i) || fullUrl.match(/الموسم-(\d+)/i);
        const seasonNum = seasonNumMatch ? parseInt(seasonNumMatch[1], 10) : 1;

        episodes.push({
          id: this.formatId(epHref.replace(this.mainUrl, '')),
          title: epTitle,
          season: seasonNum,
          episode: epNum,
          url: this.fixUrl(epHref),
          poster,
        });
      });
    }

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: isSeries ? 'series' : 'movie',
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
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Referer: `${this.mainUrl}/`,
      },
    });

    const streams: ResolvedStream[] = [];
    const targetServerUrls: string[] = [];

    // 1. Data-watch attributes on ul.WatchServersList li
    resp.$('ul.WatchServersList li').each((_, el) => {
      const dataWatch = resp.$(el).attr('data-watch');
      if (dataWatch && dataWatch.startsWith('http')) {
        targetServerUrls.push(dataWatch);
      }
    });

    // 2. Encoded data-url buttons
    resp.$('ul.WatchServersList li btn, ul.WatchServersList li button').each((_, btn) => {
      const dataUrl = resp.$(btn).attr('data-url');
      if (dataUrl) {
        const decoded = this.decodeWecimaUrl(dataUrl);
        if (decoded) targetServerUrls.push(decoded);
      }
    });

    // 3. Download links
    resp.$('.openLinkDown').each((_, btn) => {
      const dataHref = resp.$(btn).attr('data-href');
      if (dataHref) {
        const decoded = this.decodeWecimaUrl(dataHref);
        if (decoded) targetServerUrls.push(decoded);
      }
    });

    // Extract streams from found servers
    for (const sUrl of targetServerUrls) {
      try {
        const extracted = await extractStreams(sUrl, fullUrl);
        if (extracted && extracted.length > 0) {
          streams.push(...extracted);
        }
      } catch (err) {
        this.logger.debug(`Failed extracting from ${sUrl}: ${(err as Error).message}`);
      }
    }

    return streams;
  }
}
