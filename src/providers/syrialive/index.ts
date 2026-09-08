import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http } from '../../utils/http.js';
import { decryptYacine } from '../../utils/crypto.js';

export class SyriaLiveProvider extends BaseProvider {
  id = 'syrialive';
  name = 'SyriaLive (مباريات اليوم)';
  lang = 'ar';
  mainUrl = 'https://def.ycnapi.com/api';
  supportedTypes: StremioContentType[] = ['tv', 'channel'];

  constructor() {
    super();
    this.initLogger();
  }

  private async fetchEvents(): Promise<any[]> {
    try {
      const resp = await http.get(`${this.mainUrl}/events`, {
        headers: { 'User-Agent': 'okhttp/4.12.0' },
        timeout: 6000,
      });
      if (resp.status === 200) {
        const decrypted = decryptYacine(resp.text, resp.headers['t'] || '');
        if (decrypted) {
          return JSON.parse(decrypted).data || [];
        }
      }
    } catch (e) {
      this.logger.debug(`Error fetching match events: ${(e as Error).message}`);
    }
    return [];
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const qLower = query.toLowerCase();
    const events = await this.fetchEvents();
    const results: ProviderItem[] = [];

    for (const ev of events) {
      const t1 = ev.team_1?.name || '';
      const t2 = ev.team_2?.name || '';
      const champ = ev.champions || '';
      const matchTitle = `${t1} vs ${t2}`;

      if (
        t1.toLowerCase().includes(qLower) ||
        t2.toLowerCase().includes(qLower) ||
        champ.toLowerCase().includes(qLower) ||
        matchTitle.toLowerCase().includes(qLower)
      ) {
        const timeStr = ev.start_time
          ? new Date(ev.start_time * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
          : '';

        results.push({
          id: this.formatId(String(ev.id)),
          provider: this.name,
          type: 'tv',
          title: `⚽ ${matchTitle} (${champ})`,
          poster: ev.team_1?.logo || ev.team_2?.logo,
          description: `🏆 البطولة: ${champ} | ⏰ ${timeStr} | 📺 ${ev.channel || 'بث مباشر'} | 🎙️ ${ev.commentary || ''}`,
          url: `${this.mainUrl}/event/${ev.id}`,
        });
      }
    }

    return results;
  }

  async getCatalogInternal(_type: StremioContentType, _page: number = 1): Promise<ProviderItem[]> {
    const events = await this.fetchEvents();
    const items: ProviderItem[] = [];

    for (const ev of events) {
      const t1 = ev.team_1?.name || 'فريق 1';
      const t2 = ev.team_2?.name || 'فريق 2';
      const champ = ev.champions || 'مباراة اليوم';
      const timeStr = ev.start_time
        ? new Date(ev.start_time * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : '';

      items.push({
        id: this.formatId(String(ev.id)),
        provider: this.name,
        type: 'tv',
        title: `⚽ ${t1} vs ${t2} - ${champ}`,
        poster: ev.team_1?.logo || ev.team_2?.logo,
        description: `🏆 البطولة: ${champ} | ⏰ التوقيت: ${timeStr} | 📺 القناة: ${ev.channel || 'beIN Sports'} | 🎙️ المعلق: ${ev.commentary || ''}`,
        url: `${this.mainUrl}/event/${ev.id}`,
      });
    }

    return items;
  }

  async getMetaInternal(contentId: string, _type: StremioContentType): Promise<ProviderDetail | null> {
    const events = await this.fetchEvents();
    const event = events.find((e: any) => String(e.id) === contentId);

    if (event) {
      const t1 = event.team_1?.name || '';
      const t2 = event.team_2?.name || '';
      const champ = event.champions || '';
      const timeStr = event.start_time
        ? new Date(event.start_time * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : '';

      return {
        id: this.formatId(contentId),
        provider: this.name,
        type: 'tv',
        title: `⚽ ${t1} vs ${t2}`,
        poster: event.team_1?.logo || event.team_2?.logo,
        description: `🏆 بطولة: ${champ}\n⏰ التوقيت: ${timeStr}\n📺 القناة: ${event.channel || 'beIN'}\n🎙️ المعلق: ${event.commentary || 'غير محدد'}`,
        url: `${this.mainUrl}/event/${contentId}`,
      };
    }

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: 'tv',
      title: 'بث مباشر للمباراة',
      description: 'شاهد البث المباشر بجودات متعددة',
      url: `${this.mainUrl}/event/${contentId}`,
    };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType): Promise<ResolvedStream[]> {
    const resolved: ResolvedStream[] = [];
    try {
      const resp = await http.get(`${this.mainUrl}/event/${contentId}`, {
        headers: { 'User-Agent': 'okhttp/4.12.0' },
        timeout: 6000,
      });

      if (resp.status === 200) {
        const decrypted = decryptYacine(resp.text, resp.headers['t'] || '');
        if (decrypted) {
          const streams = JSON.parse(decrypted).data || [];
          for (const stream of streams) {
            let finalUrl = stream.url?.replace('www.elahmad.coo', 'www.elahmad.com') || '';
            if (!finalUrl) continue;

            const streamHeaders: Record<string, string> = {
              'User-Agent': stream.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            };

            if (stream.referer) {
              streamHeaders['Referer'] = stream.referer;
            }

            resolved.push({
              name: `سيرفر مباشر (${stream.name || 'HD'})`,
              quality: stream.name || 'HD',
              url: finalUrl,
              isM3u8: true,
              headers: streamHeaders,
            });
          }
        }
      }
    } catch (e) {
      this.logger.debug(`Error getting SyriaLive event streams: ${(e as Error).message}`);
    }

    return resolved;
  }
}

