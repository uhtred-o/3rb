import { http } from '../utils/http.js';
import { Logger } from '../utils/logger.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('GovidExtractor');

export async function extractGovid(url: string, referer?: string): Promise<ResolvedStream[]> {
  try {
    let targetUrl = url;

    // If it is a /play/ link, fetch page to resolve the real embed iframe
    if (targetUrl.includes('/play/')) {
      const playResp = await http.get(targetUrl, {
        headers: {
          Referer: referer || 'https://mycima.chat/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      const iframeSrc = playResp.$('iframe').attr('src');
      if (!iframeSrc) {
        logger.warn(`No iframe found in govid play page: ${url}`);
        return [];
      }
      targetUrl = iframeSrc;
    }

    if (!targetUrl.startsWith('http')) return [];

    // If iframe target is govid embed
    if (targetUrl.includes('govid.live')) {
      const embedResp = await http.get(targetUrl, {
        headers: {
          Referer: 'https://govid.live/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      const hexMatch = embedResp.text.match(/const\s+Mohix\s*=\s*"([0-9a-fA-F]+)"/);
      if (hexMatch && hexMatch[1]) {
        const hex = hexMatch[1];
        let m3u8Url = '';
        for (let i = 0; i < hex.length; i += 2) {
          m3u8Url += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }

        if (m3u8Url.includes('.m3u8')) {
          return [
            {
              name: 'GoVid (HLS)',
              url: m3u8Url,
              isM3u8: true,
              headers: {
                Referer: targetUrl,
                Origin: 'https://govid.live',
              },
            },
          ];
        }
      }
    }

    return [];
  } catch (err) {
    logger.warn(`Govid extraction failed for ${url}: ${(err as Error).message}`);
    return [];
  }
}
