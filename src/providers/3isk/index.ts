import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderEpisode, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http } from '../../utils/http.js';
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
    const resp = await http.get(url);

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
    const resp = await http.get(url);

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
    const resp = await http.get(fullUrl);

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
    const resp = await http.get(fullUrl);

    const streams: ResolvedStream[] = [];

    // Stage 1: Find the 3isk form with news token
    const form = resp.$('form:has(input[name="news"])').first();
    const actionUrl = form.attr('action') || resp.$('form[action*="aa.3isk.icu"]').first().attr('action');
    const newsVal = form.find('input[name="news"]').attr('value') || '';
    const uVal = form.find('input[name="u"]').attr('value') || '';

    if (actionUrl && newsVal) {
      try {
        // Submit step 1 to aa.3isk.icu
        const step2Resp = await http.post(this.fixUrl(actionUrl), {
          form: { news: newsVal, u: uVal },
          headers: { Referer: fullUrl },
        });

        // Step 2 contains myUrl and myInput.value
        const myUrlMatch = step2Resp.text.match(/var\s+myUrl\s*=\s*['"]([^'"]+)['"]/);
        const nextNewsMatch = step2Resp.text.match(/myInput\.value\s*=\s*['"]([^'"]+)['"]/);

        if (myUrlMatch && nextNewsMatch) {
          const step3Url = this.fixUrl(myUrlMatch[1]);
          const step3News = nextNewsMatch[1];

          // Submit step 2
          const step3Resp = await http.post(step3Url, {
            form: { news: step3News, u: '' },
            headers: { Referer: actionUrl },
          });

          // Step 3 yields embed iframes (e.g. https://3iskk.xyz/embed/1/264367/2/ or ukrcdn.club/e/...)
          const embedUrls: string[] = [];
          step3Resp.$('iframe[src*="embed"], iframe[src*="3isk"]').each((_, ifr) => {
            const src = step3Resp.$(ifr).attr('src');
            if (src) embedUrls.push(this.fixUrl(src));
          });

          // Also scan text for direct embed urls
          const textEmbeds = step3Resp.text.match(/https?:\/\/[^'"\s<>]+\/embed\/[^'"\s<>]+/g) || [];
          for (const u of textEmbeds) {
            if (!embedUrls.includes(u)) embedUrls.push(u);
          }

          for (const embedUrl of embedUrls) {
            try {
              const embedResp = await http.get(embedUrl, {
                headers: { Referer: step3Url },
              });

              // Check if embed contains nested ukrcdn iframe or direct video
              const ukrcdnIfr = embedResp.$('iframe[src*="ukrcdn"]').attr('src') ||
                embedResp.text.match(/https?:\/\/ukrcdn\.[a-z]+\/e\/[a-zA-Z0-9-]+/)?.[0];

              if (ukrcdnIfr) {
                const ukrUrl = this.fixUrl(ukrcdnIfr);
                const ukrResp = await http.get(ukrUrl, {
                  headers: { Referer: embedUrl },
                });

                // Extract fetch(".../playback?g=...")
                const playbackApiMatch = ukrResp.text.match(/fetch\s*\(\s*['"]([^'"]+playback[^'"]*)['"]/);
                if (playbackApiMatch) {
                  const playbackUrl = playbackApiMatch[1].replace(/\\\//g, '/');
                  const pbResp = await http.get(playbackUrl, {
                    headers: {
                      Referer: ukrUrl,
                      Accept: 'application/json',
                    },
                  });
                  try {
                    const pbJson = JSON.parse(pbResp.text);
                    if (pbJson.url) {
                      streams.push({
                        name: '3isk - سيرفر قصة عشق (HLS)',
                        quality: '1080p / 720p',
                        url: pbJson.url,
                        isM3u8: true,
                        headers: { Referer: 'https://ukrcdn.club/' },
                      });
                    }
                  } catch (e) {
                    this.logger.debug(`Error parsing ukrcdn playback JSON: ${(e as Error).message}`);
                  }
                }
              }

              // Also check for any unpacked m3u8/mp4
              const unpacked = unpackAll(embedResp.text, embedUrl);
              const m3u8Match = unpacked.match(/https?:\/\/[^'"\s\\]+?\.m3u8[^'"\s\\]*/);
              if (m3u8Match) {
                streams.push({
                  name: '3isk Server',
                  url: m3u8Match[0].replace(/\\\//g, '/'),
                  isM3u8: true,
                  headers: { Referer: embedUrl },
                });
              }
            } catch (err) {
              this.logger.debug(`Error fetching embed ${embedUrl}: ${(err as Error).message}`);
            }
          }
        }
      } catch (err) {
        this.logger.error(`Error during 3isk handshake: ${(err as Error).message}`);
      }
    }

    // Direct fallback extractors from main episode page iframes
    if (streams.length === 0) {
      const iframes: string[] = [];
      resp.$('iframe[src]').each((_, ifr) => {
        const src = resp.$(ifr).attr('src');
        if (src) iframes.push(this.fixUrl(src));
      });

      for (const ifrUrl of iframes) {
        try {
          const extracted = await extractStreams(ifrUrl, fullUrl);
          streams.push(...extracted);
        } catch {}
      }
    }

    return streams;
  }
}
