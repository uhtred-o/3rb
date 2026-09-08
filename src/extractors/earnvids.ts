import { http } from '../utils/http.js';
import { unpackAll } from '../utils/packer.js';
import { Logger } from '../utils/logger.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('EarnVidsExtractor');

export async function extractEarnVids(pageUrl: string, referer?: string): Promise<ResolvedStream[]> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };

    if (pageUrl.includes('fdewsdc.sbs')) {
      headers['Referer'] = 'https://shhahid4u.cam';
    } else if (referer) {
      headers['Referer'] = referer;
    }

    const resp = await http.get(pageUrl, { headers });
    const html = resp.text || '';

    // Check for direct m3u8
    const directM3u8 = html.match(/https?:\/\/[^'"\s>]+\.m3u8[^'"\s>]*/i);
    if (directM3u8) {
      let link = directM3u8[0].replace(/\\\//g, '/');
      if (link.startsWith('/')) {
        link = new URL(link, pageUrl).toString();
      }
      return [
        {
          name: 'EarnVids / StreamHG (Direct)',
          url: link,
          isM3u8: true,
          headers: { Referer: pageUrl },
        },
      ];
    }

    if (!html.includes('eval(function')) {
      return [];
    }

    const unpacked = unpackAll(html, pageUrl, 4);
    if (!unpacked) return [];

    const cleaned = unpacked.replace(/\\\//g, '/');
    const linksMatch = cleaned.match(/var\s+links\s*=\s*(\{[\s\S]*?\})\s*;/);

    if (linksMatch) {
      try {
        const jsonStr = linksMatch[1].replace(/'/g, '"');
        const linksObj = JSON.parse(jsonStr);
        const streamUrl = linksObj.hls4 || linksObj.hls || linksObj.file;
        if (streamUrl) {
          let resolved = streamUrl;
          if (resolved.startsWith('/')) {
            resolved = new URL(resolved, pageUrl).toString();
          }
          return [
            {
              name: 'EarnVids (HLS)',
              url: resolved,
              isM3u8: resolved.includes('.m3u8'),
              headers: { Referer: pageUrl },
            },
          ];
        }
      } catch (e) {
        logger.debug(`JSON parse failed for unpacked links: ${(e as Error).message}`);
      }
    }

    // Direct HLS regex from unpacked payload
    const hlsMatch = cleaned.match(/"hls4?"\s*:\s*"([^"]+)"/i) || cleaned.match(/file\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
    if (hlsMatch) {
      let link = hlsMatch[1];
      if (link.startsWith('/')) {
        link = new URL(link, pageUrl).toString();
      }
      return [
        {
          name: 'EarnVids (Unpacked)',
          url: link,
          isM3u8: true,
          headers: { Referer: pageUrl },
        },
      ];
    }

    return [];
  } catch (err) {
    logger.warn(`EarnVids extraction failed for ${pageUrl}: ${(err as Error).message}`);
    return [];
  }
}
