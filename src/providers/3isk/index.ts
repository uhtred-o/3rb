import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http, MOBILE_USER_AGENT } from '../../utils/http.js';
import { safeBase64Decode } from '../../utils/crypto.js';
import { unpackAll } from '../../utils/packer.js';
import { extractStreams } from '../../extractors/index.js';

export class ThreeIskProvider extends BaseProvider {
  id = '3isk';
  name = '3isk - قصة عشق (مسلسلات تركية)';
  lang = 'ar';
  mainUrl = 'https://3esk.onl';
  supportedTypes: StremioContentType[] = ['series', 'movie'];

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

  private extractItemUrl(el: any, $: any): string {
    const dataClse = $(el).attr('data-clse');
    if (dataClse) {
      const decoded = safeBase64Decode(dataClse);
      if (decoded.startsWith('http') || decoded.startsWith('/')) {
        return this.fixUrl(decoded);
      }
    }
    const a = $(el).find('a').first();
    const href = a.attr('href');
    return href ? this.fixUrl(href) : '';
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const url = `${this.mainUrl}/search.php?keywords=${encodeURIComponent(query)}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    resp.$('div.post-item, div.block-post, div.video-item').each((_, el) => {
      const a = resp.$(el).find('a').first();
      const title = resp.$(el).find('.post-title, .title').text().trim() || a.attr('title') || '';
      const href = this.extractItemUrl(el, resp.$);
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
      const isMovie = href.includes('/movie/') || title.includes('فيلم');

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: isMovie ? 'movie' : 'series',
        title,
        poster,
        url: href,
      });
    });

    return items;
  }

  async getCatalogInternal(type: StremioContentType, page: number = 1): Promise<ProviderItem[]> {
    const path = type === 'movie' ? 'w-mvs' : 'w-srs';
    const url = `${this.mainUrl}/${path}/${page > 1 ? `page/${page}/` : ''}`;
    const resp = await http.get(url, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const items: ProviderItem[] = [];
    const seenHrefs = new Set<string>();

    resp.$('a[href*="/serie-"], a[href*="/tvshows/"], div.post-item, div.block-post').each((_, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a').first();
      const rawTitle = resp.$(el).find('.post-title, .title').text().trim() || a.text().trim() || a.attr('title') || '';
      const title = rawTitle.replace(/\s+/g, ' ').trim();
      const href = a.attr('href');
      if (!title || !href || seenHrefs.has(href)) return;
      seenHrefs.add(href);

      const poster = this.fixUrl(
        resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src') || a.find('img').attr('src')
      );

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type,
        title,
        poster,
        url: href,
      });
    });

    return items;
  }

  async getMetaInternal(contentId: string, type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const resp = await http.get(fullUrl, {
      headers: { 'User-Agent': MOBILE_USER_AGENT },
    });

    const title = resp.$('h1.entry-title, .post-title').text().trim() || resp.$('meta[property="og:title"]').attr('content') || '3isk Title';
    const poster = this.fixUrl(resp.$('.post-thumbnail img').attr('src') || resp.$('meta[property="og:image"]').attr('content'));
    const description = resp.$('.entry-content p, .story').text().trim();

    const episodes: ProviderEpisode[] = [];
    resp.$('ul.episodes-list li, div.episodes-container a').each((idx, el) => {
      const a = resp.$(el).is('a') ? resp.$(el) : resp.$(el).find('a');
      const epHref = this.extractItemUrl(el, resp.$) || a.attr('href');
      const epTitle = a.text().trim() || `حلقة ${idx + 1}`;
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
      type: type === 'movie' ? 'movie' : 'series',
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

    // Stage 1: Form search
    const form = resp.$('form[action*="watch"], form[action*="3isk"], form:has(button.single-watch-btn)').first();
    let actionUrl = form.attr('action') || fullUrl;
    actionUrl = this.fixUrl(actionUrl);

    const formData: Record<string, string> = {};
    form.find('input[type="hidden"]').each((_, input) => {
      const name = resp.$(input).attr('name');
      const val = resp.$(input).attr('value') || '';
      if (name) formData[name] = val;
    });

    const watchBtn = form.find('button.single-watch-btn, input[type="submit"]').first();
    const btnName = watchBtn.attr('name') || 'watch';
    const btnVal = watchBtn.attr('value') || '1';
    formData[btnName] = btnVal;

    try {
      const stage1Resp = await http.post(actionUrl, {
        form: formData,
        headers: { 'User-Agent': MOBILE_USER_AGENT, Referer: fullUrl },
      });

      const stage1Html = stage1Resp.text;
      const myUrlMatch = stage1Html.match(/var\s+myUrl\s*=\s*['"]([^'"]+)['"]/);
      const newsMatch = stage1Html.match(/myInput\.value\s*=\s*['"]([^'"]+)['"]/);

      if (myUrlMatch && newsMatch) {
        const stage2Url = this.fixUrl(myUrlMatch[1]);
        const newsVal = newsMatch[1];

        const stage2Resp = await http.post(stage2Url, {
          form: { news: newsVal, u: '', submit: 'submit' },
          headers: { 'User-Agent': MOBILE_USER_AGENT, Referer: actionUrl },
        });

        // Stage 2 embed servers rotation
        const baseEmbedMatch = stage2Resp.text.match(/https?:\/\/[^'"]+\/embed\/(\d+)\/([^'"\s]+)/);
        if (baseEmbedMatch) {
          const trailingPart = baseEmbedMatch[2];
          for (let s = 1; s <= 4; s++) {
            const serverEmbedUrl = `${this.mainUrl}/embed/${s}/${trailingPart}`;
            try {
              const embedResp = await http.get(serverEmbedUrl, {
                headers: { Referer: stage2Url },
              });
              const unpacked = unpackAll(embedResp.text, serverEmbedUrl);
              const m3u8Match = unpacked.match(/https?:\/\/[^'"\s\\]+?\.m3u8[^'"\s\\]*/);
              if (m3u8Match) {
                streams.push({
                  name: `3isk Server ${s}`,
                  url: m3u8Match[0].replace(/\\\//g, '/'),
                  isM3u8: true,
                  headers: { Referer: serverEmbedUrl },
                });
              }
            } catch {
              continue;
            }
          }
        }
      }
    } catch (e) {
      this.logger.debug(`Error during 3isk two-stage handshake: ${(e as Error).message}`);
    }

    // Direct fallback extractors if stage handshake failed or returned few streams
    if (streams.length === 0) {
      resp.$('iframe[src*="embed"], iframe[src*="player"]').each((_, ifr) => {
        const src = resp.$(ifr).attr('src');
        if (src) {
          serverLinksFallback.push(this.fixUrl(src));
        }
      });
    }

    return streams;
  }
}
const serverLinksFallback: string[] = [];
