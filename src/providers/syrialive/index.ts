import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http } from '../../utils/http.js';
import { safeBase64Decode } from '../../utils/crypto.js';
import { extractStreams } from '../../extractors/index.js';

export class SyriaLiveProvider extends BaseProvider {
  id = 'syrialive';
  name = 'SyriaLive (مباريات وبث مباشر)';
  lang = 'ar';
  mainUrl = 'https://www.syrlive.com';
  supportedTypes: StremioContentType[] = ['tv', 'channel'];

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
    const resp = await http.get(url);
    const items: ProviderItem[] = [];

    resp.$('.AY-PItem').each((_, el) => {
      const titleEl = resp.$(el).find('.AY-PostTitle a');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      if (!title || !href) return;

      const poster = this.fixUrl(resp.$(el).find('img').attr('data-src') || resp.$(el).find('img').attr('src'));
      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: 'tv',
        title,
        poster,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getCatalogInternal(_type: StremioContentType, _page: number = 1): Promise<ProviderItem[]> {
    const resp = await http.get('https://d.syrlive.com/');
    const items: ProviderItem[] = [];

    resp.$('.match-container').each((_, el) => {
      const rightTeam = resp.$(el).find('.right-team .team-name').text().trim();
      const leftTeam = resp.$(el).find('.left-team .team-name').text().trim();
      const time = resp.$(el).find('.match-time').text().trim();
      const result = resp.$(el).find('.result').text().trim() || 'VS';
      const href = resp.$(el).find('a').attr('href');
      if (!rightTeam || !leftTeam || !href) return;

      const title = `${rightTeam} ${result} ${leftTeam} (${time})`;
      const poster = this.fixUrl(
        resp.$(el).find('.right-team img').attr('data-src') || resp.$(el).find('.right-team img').attr('src')
      );

      items.push({
        id: this.formatId(href.replace(this.mainUrl, '')),
        provider: this.name,
        type: 'tv',
        title,
        poster,
        description: `توقيت المباراة: ${time}`,
        url: this.fixUrl(href),
      });
    });

    return items;
  }

  async getMetaInternal(contentId: string, _type: StremioContentType): Promise<ProviderDetail | null> {
    const fullUrl = this.fixUrl(contentId);
    const resp = await http.get(fullUrl);

    const title = resp.$('.EntryTitle').text().trim() || 'مباراة مباشرة';
    const poster = this.fixUrl(resp.$('meta[property="og:image"]').attr('content') || resp.$('.teamlogo').attr('data-src'));

    const descParts: string[] = [];
    resp.$('.AY-MatchInfo table tr').each((_, tr) => {
      const key = resp.$(tr).find('th').text().trim();
      const val = resp.$(tr).find('td').text().trim();
      if (key && val) descParts.push(`${key}: ${val}`);
    });

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: 'tv',
      title,
      poster,
      description: descParts.join('\n') || resp.$('.entry-content p').text().trim(),
      url: fullUrl,
    };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType): Promise<ResolvedStream[]> {
    const fullUrl = this.fixUrl(contentId);
    const browserUa = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

    const resp = await http.get(fullUrl, {
      headers: { 'User-Agent': browserUa, Referer: 'https://www.google.com/' },
    });

    const streams: ResolvedStream[] = [];
    const iframeSrc = resp.$('.entry-content iframe').attr('src');

    if (iframeSrc) {
      const playerUrl = this.fixUrl(iframeSrc);
      try {
        const playerResp = await http.get(playerUrl, {
          headers: { 'User-Agent': browserUa, Referer: fullUrl },
        });

        const playerText = playerResp.text;
        const albaMatch = playerText.match(/AlbaPlayerControl\('([^']+)'/);

        if (albaMatch) {
          const streamUrl = safeBase64Decode(albaMatch[1]);
          if (streamUrl && streamUrl.startsWith('http')) {
            streams.push({
              name: 'SyriaLive (Alba Player)',
              url: streamUrl,
              isM3u8: true,
              headers: {
                'User-Agent': browserUa,
                Referer: playerUrl,
                Origin: 'https://player.syria-player.live',
              },
            });
          }
        }

        const clapprMatch = playerText.match(/source\s*:\s*"([^"]+)"/);
        if (clapprMatch) {
          streams.push({
            name: 'SyriaLive (Clappr Player)',
            url: clapprMatch[1],
            isM3u8: true,
            headers: { 'User-Agent': browserUa, Referer: playerUrl },
          });
        }
      } catch (e) {
        this.logger.debug(`Error fetching player iframe: ${(e as Error).message}`);
      }
    }

    // Additional server buttons
    const serverButtons: string[] = [];
    resp.$('.video-serv a').each((_, a) => {
      const href = resp.$(a).attr('href');
      if (href) serverButtons.push(this.fixUrl(href));
    });

    for (const btn of serverButtons) {
      const extracted = await extractStreams(btn, fullUrl);
      streams.push(...extracted);
    }

    return streams;
  }
}
