import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { extractStreams } from '../../extractors/index.js';

export class ArabseedProvider extends BaseProvider {
  id = 'arabseed';
  name = 'Arabseed (عرب سيد)';
  lang = 'ar';
  mainUrl = 'https://arabseeds.watch';
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
    const resp = await http.get(url);

    const items: ProviderItem[] = [];
    resp.$('a.movie__block, div.MovieBlock, div.PostBlock').each((_, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a').first();
      const title = resp.$(el).find('h3, h4, .BlockItemTitle, .Title').text().trim() || a.attr('title') || '';
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
    const url = `${this.mainUrl}/${path}${page > 1 ? `/page/${page}/` : '/'}`;
    const resp = await http.get(url);

    const items: ProviderItem[] = [];
    const seen = new Set<string>();

    resp.$('a.movie__block, div.MovieBlock, div.PostBlock').each((_, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a').first();
      const title = resp.$(el).find('h3, h4, .BlockItemTitle, .Title').text().trim() || a.attr('title') || '';
      const href = a.attr('href');
      if (!title || !href || seen.has(href)) return;
      seen.add(href);

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
    const resp = await http.get(fullUrl);

    const title = resp.$('h1.Title, h1, h3').first().text().trim() || resp.$('meta[property="og:title"]').attr('content') || 'Arabseed Title';
    const poster = this.fixUrl(resp.$('.Poster img, .post__image img').attr('data-src') || resp.$('.Poster img, .post__image img').attr('src') || resp.$('meta[property="og:image"]').attr('content'));
    const description = resp.$('.Story p, .post__info p').text().trim();

    const episodes: ProviderEpisode[] = [];
    if (type === 'series' || fullUrl.includes('/series/')) {
      resp.$('a[href*="-الحلقة-"], a[href*="/episode-"], div.ContainerEpisodesList a').each((idx, el) => {
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
    const resp = await http.get(fullUrl);

    const streams: ResolvedStream[] = [];
    const serverLinks: string[] = [];

    // 1. Find watch page link
    const watchBtnHref = resp.$('a[href*="/watch/"], a.watchBTn').attr('href');
    const watchPageUrl = watchBtnHref ? this.fixUrl(watchBtnHref) : `${fullUrl.replace(/\/$/, '')}/watch/`;

    try {
      const watchResp = await http.get(watchPageUrl, {
        headers: { Referer: fullUrl },
      });

      watchResp.$('.server-item[data-src], ul.serversList li[data-link], [data-embed]').each((_, el) => {
        const link = watchResp.$(el).attr('data-src') || watchResp.$(el).attr('data-link') || watchResp.$(el).attr('data-embed');
        if (link) serverLinks.push(this.fixUrl(link));
      });

      const iframeSrc = watchResp.$('iframe.player-frame, iframe[src*="embed"], iframe').attr('src');
      if (iframeSrc) serverLinks.push(this.fixUrl(iframeSrc));
    } catch (e) {
      this.logger.debug(`Error loading watch page: ${(e as Error).message}`);
    }

    // 2. Also check download page for mirrors
    const downloadBtnHref = resp.$('a[href*="/download/"]').attr('href');
    if (downloadBtnHref) {
      try {
        const downloadResp = await http.get(this.fixUrl(downloadBtnHref), {
          headers: { Referer: fullUrl },
        });
        downloadResp.$('a[href*="mixdrop"], a[href*="dood"], a[href*="myvid"]').each((_, a) => {
          const href = downloadResp.$(a).attr('href');
          if (href) {
            // Convert /d/ to /e/ for player embed
            const embedLink = href.replace('/d/', '/e/').replace('/f/', '/e/');
            serverLinks.push(embedLink);
          }
        });
      } catch {}
    }

    // 3. Resolve all servers
    for (const sUrl of serverLinks) {
      try {
        const extracted = await extractStreams(sUrl, watchPageUrl);
        streams.push(...extracted);
      } catch {}
    }

    return streams;
  }
}
