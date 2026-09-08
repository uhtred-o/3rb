import { extractEarnVids } from './earnvids.js';
import { extractShare4max } from './share4max.js';
import { extractMailru } from './mailru.js';
import { extractVidea } from './videa.js';
import { extractGovid } from './govid.js';
import { http } from '../utils/http.js';
import { unpackAll } from '../utils/packer.js';
import { Logger } from '../utils/logger.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('ExtractorRouter');

export async function extractStreams(url: string, referer?: string): Promise<ResolvedStream[]> {
  if (!url || !url.startsWith('http')) return [];

  const lower = url.toLowerCase();

  // 1. Direct stream files
  if (lower.includes('.m3u8') || lower.includes('.mp4')) {
    return [
      {
        name: 'Direct Stream',
        url,
        isM3u8: lower.includes('.m3u8'),
        headers: referer ? { Referer: referer } : undefined,
      },
    ];
  }

  // 2. Specific extractors
  if (lower.includes('govid.live')) {
    const streams = await extractGovid(url, referer);
    if (streams.length > 0) return streams;
  }

  // 2. Specific extractors
  if (lower.includes('earnvids') || lower.includes('streamhg') || lower.includes('fdewsdc') || lower.includes('vidbem')) {
    const streams = await extractEarnVids(url, referer);
    if (streams.length > 0) return streams;
  }

  if (lower.includes('share4max') || lower.includes('megamax') || lower.includes('megabox')) {
    const streams = await extractShare4max(url, referer);
    if (streams.length > 0) return streams;
  }

  if (lower.includes('mail.ru')) {
    const streams = await extractMailru(url, referer);
    if (streams.length > 0) return streams;
  }

  if (lower.includes('videa.hu')) {
    const streams = await extractVidea(url, referer);
    if (streams.length > 0) return streams;
  }

  // 3. Generic player embed inspection
  try {
    const resp = await http.get(url, {
      referer,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    const html = resp.text;
    const streams: ResolvedStream[] = [];

    // Direct source tags
    resp.$('video source, source').each((_, el) => {
      const src = resp.$(el).attr('src');
      if (src && src.startsWith('http')) {
        streams.push({
          name: 'Video Source',
          url: src,
          isM3u8: src.includes('.m3u8'),
          headers: { Referer: url },
        });
      }
    });

    // Regex for m3u8 or mp4 in scripts
    const scriptM3u8 = html.match(/https?:\/\/[^'"\s\\]+?\.m3u8[^'"\s\\]*/g);
    if (scriptM3u8) {
      for (const m of scriptM3u8) {
        streams.push({
          name: 'Embedded HLS',
          url: m.replace(/\\\//g, '/'),
          isM3u8: true,
          headers: { Referer: url },
        });
      }
    }

    // Try packer if present
    if (html.includes('eval(function(p,a,c,k,e,d)')) {
      const unpacked = unpackAll(html, url);

      // 1. Mixdrop pattern (MDCore.wurl)
      const mdMatch = unpacked.match(/MDCore\.(?:wurl|wsrc)\s*=\s*["']([^"']+)["']/i);
      if (mdMatch) {
        let fileUrl = mdMatch[1];
        if (fileUrl.startsWith('//')) fileUrl = `https:${fileUrl}`;
        streams.push({
          name: 'Mixdrop Direct',
          url: fileUrl,
          isM3u8: fileUrl.includes('.m3u8'),
          headers: { Referer: url },
        });
      }

      // 2. Unpacked HLS m3u8
      const unpackedHls = unpacked.match(/https?:\/\/[^'"\s\\]+?\.m3u8[^'"\s\\]*/g);
      if (unpackedHls) {
        for (const m of unpackedHls) {
          streams.push({
            name: 'Unpacked HLS',
            url: m.replace(/\\\//g, '/'),
            isM3u8: true,
            headers: { Referer: url },
          });
        }
      }

      // 3. Unpacked MP4
      const unpackedMp4 = unpacked.match(/https?:\/\/[^'"\s\\]+?\.mp4[^'"\s\\]*/g);
      if (unpackedMp4) {
        for (const m of unpackedMp4) {
          streams.push({
            name: 'Unpacked Video',
            url: m.replace(/\\\//g, '/'),
            isM3u8: false,
            headers: { Referer: url },
          });
        }
      }
    }

    if (streams.length > 0) {
      // Deduplicate by URL
      const uniqueMap = new Map<string, ResolvedStream>();
      for (const s of streams) {
        if (!uniqueMap.has(s.url)) uniqueMap.set(s.url, s);
      }
      return Array.from(uniqueMap.values());
    }
  } catch (err) {
    logger.debug(`Generic embed inspection failed for ${url}: ${(err as Error).message}`);
  }

  return [];
}
