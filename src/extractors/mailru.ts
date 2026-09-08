import { http } from '../utils/http.js';
import { Logger } from '../utils/logger.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('MailruExtractor');

export async function extractMailru(url: string, referer?: string): Promise<ResolvedStream[]> {
  try {
    const vidId = url.split('video/embed/')[1]?.trim();
    if (!vidId) return [];

    const metaUrl = `https://my.mail.ru/+/video/meta/${vidId}`;
    const resp = await http.get(metaUrl, { referer: referer || url });

    const cookieHeader = resp.headers['set-cookie'] || '';
    const videoKeyMatch = cookieHeader.match(/video_key=([^;]+)/);
    const videoKey = videoKeyMatch ? videoKeyMatch[1] : '';

    const data = JSON.parse(resp.text);
    const streams: ResolvedStream[] = [];

    for (const v of data.videos || []) {
      let vUrl = v.url.startsWith('//') ? `https:${v.url}` : v.url;
      if (videoKey) {
        vUrl += vUrl.includes('?') ? `&video_key=${videoKey}` : `?video_key=${videoKey}`;
      }

      streams.push({
        name: `Mail.ru (${v.key || 'Direct'})`,
        quality: v.key || 'Auto',
        url: vUrl,
        isM3u8: vUrl.includes('.m3u8'),
        headers: { Referer: referer || url },
      });
    }

    return streams;
  } catch (err) {
    logger.warn(`Mail.ru extraction failed: ${(err as Error).message}`);
    return [];
  }
}
