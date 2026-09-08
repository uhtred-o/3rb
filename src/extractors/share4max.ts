import { http } from '../utils/http.js';
import { Logger } from '../utils/logger.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('Share4maxExtractor');

export async function extractShare4max(url: string, referer?: string): Promise<ResolvedStream[]> {
  try {
    const initialResp = await http.get(url, {
      referer,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    const html = initialResp.text;
    const pageMatch = html.match(/<script[^>]+data-page="app"[^>]*>([\s\S]*?)<\/script>/i) ||
                      html.match(/data-page="([^"]+)"/i);

    let version: string | undefined;
    if (pageMatch) {
      try {
        const raw = pageMatch[1].startsWith('{') ? pageMatch[1] : pageMatch[1].replace(/&quot;/g, '"');
        const parsed = JSON.parse(raw);
        version = parsed.version;
      } catch {
        // Try regex
        const vMatch = html.match(/"version"\s*:\s*"([^"]+)"/);
        if (vMatch) version = vMatch[1];
      }
    }

    if (!version) return [];

    const inertiaHeaders = {
      'X-Inertia': 'true',
      'X-Inertia-Partial-Component': 'files/mirror/video',
      'X-Inertia-Partial-Data': 'streams',
      'X-Inertia-Version': version,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: url,
    };

    const streamResp = await http.get(url, { headers: inertiaHeaders });
    const json = JSON.parse(streamResp.text);

    const streams: ResolvedStream[] = [];
    const qualities = json?.props?.streams?.data || [];

    for (const q of qualities) {
      const label = q.label || 'Unknown';
      for (const mirror of q.mirrors || []) {
        if (mirror.link) {
          let link = mirror.link;
          if (link.startsWith('//')) link = `https:${link}`;
          streams.push({
            name: `Share4max (${mirror.driver || 'Mirror'} - ${label})`,
            quality: label,
            url: link,
            isM3u8: link.includes('.m3u8'),
            headers: { Referer: url },
          });
        }
      }
    }

    return streams;
  } catch (err) {
    logger.warn(`Share4max extraction failed: ${(err as Error).message}`);
    return [];
  }
}
