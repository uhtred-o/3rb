import { BaseProvider } from '../base.js';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../../types/provider.js';
import { StremioContentType } from '../../types/stremio.js';
import { http } from '../../utils/http.js';
import { decryptYacine } from '../../utils/crypto.js';

export class YacineTVProvider extends BaseProvider {
  id = 'yacinetv';
  name = 'Yacine TV (بث مباشر)';
  lang = 'ar';
  mainUrl = 'https://def.ycnapi.com/api';
  private fallbackUrl = 'https://deft.yacinelive.com/api';
  supportedTypes: StremioContentType[] = ['tv', 'channel'];

  constructor() {
    super();
    this.initLogger();
  }

  private async fetchApi(path: string): Promise<any> {
    const urls = [this.mainUrl, this.fallbackUrl];
    for (const baseUrl of urls) {
      try {
        const fullUrl = `${baseUrl}/${path}`.replace(/([^:]\/)\/+/g, '$1');
        const resp = await http.get(fullUrl, {
          headers: {
            'User-Agent': 'okhttp/4.12.0',
          },
          timeout: 8000,
        });

        if (resp.status === 200) {
          const tHeader = resp.headers['t'] || '';
          const decrypted = decryptYacine(resp.text, tHeader);
          if (decrypted) {
            return JSON.parse(decrypted);
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async searchInternal(query: string): Promise<ProviderItem[]> {
    const qLower = query.toLowerCase();
    const results: ProviderItem[] = [];

    // Search events (live matches)
    try {
      const evData = await this.fetchApi('events');
      const events = evData?.data || [];
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
          const timeStr = ev.start_time ? new Date(ev.start_time * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
          results.push({
            id: this.formatId(`event:${ev.id}`),
            provider: this.name,
            type: 'tv',
            title: `⚽ ${matchTitle} (${champ})`,
            poster: ev.team_1?.logo || ev.team_2?.logo,
            description: `🏆 ${champ} | ⏰ ${timeStr} | 📺 ${ev.channel || 'بث مباشر'} | 🎙️ ${ev.commentary || 'معلق رياضي'}`,
            url: `${this.mainUrl}/event/${ev.id}`,
          });
        }
      }
    } catch {}

    // Search channels
    const catData = await this.fetchApi('categories');
    const categories = catData?.data || [];

    for (const cat of categories) {
      const chData = await this.fetchApi(`categories/${cat.id}/channels`);
      const channels = chData?.data || [];

      for (const ch of channels) {
        if (ch.name?.toLowerCase().includes(qLower)) {
          results.push({
            id: this.formatId(String(ch.id)),
            provider: this.name,
            type: 'tv',
            title: ch.name || 'قناة',
            poster: ch.logo,
            description: `بث مباشر لقناة ${ch.name}`,
            url: `${this.mainUrl}/channel/${ch.id}`,
          });
        }
      }
    }

    return results;
  }

  async getCatalogInternal(_type: StremioContentType, _page: number = 1): Promise<ProviderItem[]> {
    const results: ProviderItem[] = [];

    // 1. Fetch live matches for today
    try {
      const evData = await this.fetchApi('events');
      const events = evData?.data || [];
      for (const ev of events) {
        const t1 = ev.team_1?.name || 'فريق 1';
        const t2 = ev.team_2?.name || 'فريق 2';
        const champ = ev.champions || 'مباراة مباشرة';
        const timeStr = ev.start_time ? new Date(ev.start_time * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
        results.push({
          id: this.formatId(`event:${ev.id}`),
          provider: this.name,
          type: 'tv',
          title: `⚽ ${t1} vs ${t2} - ${champ}`,
          poster: ev.team_1?.logo || ev.team_2?.logo,
          description: `🏆 البطولة: ${champ} | ⏰ التوقيت: ${timeStr} | 📺 القناة: ${ev.channel || 'beIN Sports'} | 🎙️ المعلق: ${ev.commentary || ''}`,
          url: `${this.mainUrl}/event/${ev.id}`,
        });
      }
    } catch (e) {
      this.logger.debug(`Error fetching events: ${(e as Error).message}`);
    }

    // 2. Fetch live channels
    const catData = await this.fetchApi('categories');
    const categories = catData?.data || [];

    for (const cat of categories.slice(0, 6)) {
      const chData = await this.fetchApi(`categories/${cat.id}/channels`);
      const channels = chData?.data || [];

      for (const ch of channels) {
        results.push({
          id: this.formatId(String(ch.id)),
          provider: this.name,
          type: 'tv',
          title: ch.name || 'قناة',
          poster: ch.logo,
          description: `قسم ${cat.name} - بث مباشر`,
          url: `${this.mainUrl}/channel/${ch.id}`,
        });
      }
    }

    return results;
  }

  async getMetaInternal(contentId: string, _type: StremioContentType): Promise<ProviderDetail | null> {
    if (contentId.startsWith('event:')) {
      const eventId = contentId.replace('event:', '');
      try {
        const evData = await this.fetchApi('events');
        const event = (evData?.data || []).find((e: any) => String(e.id) === eventId);
        if (event) {
          const t1 = event.team_1?.name || '';
          const t2 = event.team_2?.name || '';
          const champ = event.champions || '';
          const timeStr = event.start_time ? new Date(event.start_time * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
          return {
            id: this.formatId(contentId),
            provider: this.name,
            type: 'tv',
            title: `⚽ ${t1} vs ${t2}`,
            poster: event.team_1?.logo || event.team_2?.logo,
            description: `🏆 بطولة: ${champ}\n⏰ التوقيت: ${timeStr}\n📺 القناة الناقلة: ${event.channel || 'beIN'}\n🎙️ المعلق: ${event.commentary || 'غير محدد'}`,
            url: `${this.mainUrl}/event/${eventId}`,
          };
        }
      } catch {}

      return {
        id: this.formatId(contentId),
        provider: this.name,
        type: 'tv',
        title: 'مباراة اليوم بث مباشر',
        description: 'بث مباشر للمباراة بجودات متعددة',
        url: `${this.mainUrl}/event/${eventId}`,
      };
    }

    const chData = await this.fetchApi(`channel/${contentId}`);
    const streams = chData?.data || [];
    const firstStream = streams[0];

    return {
      id: this.formatId(contentId),
      provider: this.name,
      type: 'tv',
      title: firstStream?.name || `قناة ${contentId}`,
      poster: firstStream?.logo,
      description: `شاهد البث المباشر لقناة ${firstStream?.name || contentId}`,
      url: `${this.mainUrl}/channel/${contentId}`,
    };
  }

  async getStreamsInternal(contentId: string, _type: StremioContentType): Promise<ResolvedStream[]> {
    const resolved: ResolvedStream[] = [];

    if (contentId.startsWith('event:')) {
      const eventId = contentId.replace('event:', '');
      const data = await this.fetchApi(`event/${eventId}`);
      const streams = data?.data || [];

      for (const stream of streams) {
        let finalUrl = stream.url?.replace('www.elahmad.coo', 'www.elahmad.com') || '';
        if (!finalUrl) continue;

        const streamHeaders: Record<string, string> = {
          'User-Agent': stream.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        };

        if (stream.referer) {
          streamHeaders['Referer'] = stream.referer;
        }

        if (stream.headers && typeof stream.headers === 'object') {
          for (const [k, v] of Object.entries(stream.headers)) {
            if (typeof v === 'string') streamHeaders[k] = v;
          }
        }

        resolved.push({
          name: `Yacine TV - بث المباراة (${stream.name || 'HD'})`,
          quality: stream.name || 'HD',
          url: finalUrl,
          isM3u8: true,
          headers: streamHeaders,
        });
      }

      return resolved;
    }

    const data = await this.fetchApi(`channel/${contentId}`);
    const streams = data?.data || [];

    for (const stream of streams) {
      let finalUrl = stream.url?.replace('www.elahmad.coo', 'www.elahmad.com') || '';
      if (!finalUrl) continue;

      const streamHeaders: Record<string, string> = {
        'User-Agent': 'okhttp/4.12.0',
      };

      if (stream.headers && typeof stream.headers === 'object') {
        for (const [k, v] of Object.entries(stream.headers)) {
          if (typeof v === 'string') streamHeaders[k] = v;
        }
      }

      resolved.push({
        name: `Yacine TV - ${stream.name || 'Server'}`,
        quality: 'Live HD',
        url: finalUrl,
        isM3u8: true,
        headers: streamHeaders,
      });
    }

    return resolved;
  }
}
