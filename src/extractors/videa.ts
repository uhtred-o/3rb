import * as cheerio from 'cheerio';
import { http } from '../utils/http.js';
import { Logger } from '../utils/logger.js';
import { randomAlphaNumeric, rc4Decrypt, safeBase64DecodeBuffer } from '../utils/crypto.js';
import { ResolvedStream } from '../types/provider.js';

const logger = new Logger('VideaExtractor');
const STUPID_KEY = 'xHb0ZvME5q8CBcoQi6AngerDu3FGO9fkUlwPmLVY_RTzj2hJIS4NasXWKy1td7p';

export async function extractVidea(url: string, referer?: string): Promise<ResolvedStream[]> {
  try {
    const pageResp = await http.get(url, { referer });
    const html = pageResp.text;

    const nonceMatch = html.match(/_xt\s*=\s*"([^"]+)"/);
    if (!nonceMatch) return [];

    const nonce = nonceMatch[1];
    const paramL = nonce.length >= 32 ? nonce.substring(0, 32) : nonce.padEnd(32, 'a');
    const paramSPart = nonce.length > 32 ? nonce.substring(32) : '';

    let result = '';
    for (let i = 0; i < 32; i++) {
      const ch = paramL[i] || 'a';
      const idxInStupid = STUPID_KEY.indexOf(ch);
      const index = i - ((idxInStupid >= 0 ? idxInStupid : 0) - 31);
      let safeIndex = 0;
      if (paramSPart.length === 0) {
        safeIndex = 0;
      } else if (index < 0) {
        safeIndex = 0;
      } else if (index >= paramSPart.length) {
        safeIndex = paramSPart.length - 1;
      } else {
        safeIndex = index;
      }
      result += paramSPart[safeIndex] || 'a';
    }

    const seed = randomAlphaNumeric(8);
    const paramT = result.length >= 16 ? result.substring(0, 16) : result.padEnd(16, '0');
    const rc4KeyPart = result.length > 16 ? result.substring(16) : '';

    const videoIdMatch = url.match(/[?&]v=([^&]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';
    if (!videoId) return [];

    const xmlUrl = `https://videa.hu/player/xml?platform=desktop&_s=${seed}&_t=${paramT}&v=${videoId}`;
    const xmlResp = await http.get(xmlUrl, {
      headers: {
        Referer: url,
        Origin: 'https://videa.hu',
      },
    });

    const body = xmlResp.text;
    const xVideaXsHeader = xmlResp.headers['x-videa-xs'] || '';

    let xmlDoc: cheerio.CheerioAPI;
    if (body.trimStart().startsWith('<?xml') || body.includes('<video_source')) {
      xmlDoc = cheerio.load(body, { xmlMode: true });
    } else {
      const decoded = safeBase64DecodeBuffer(body.trim());
      const finalRc4Key = rc4KeyPart + seed + xVideaXsHeader;
      const decrypted = rc4Decrypt(decoded, finalRc4Key);
      xmlDoc = cheerio.load(decrypted, { xmlMode: true });
    }

    const streams: ResolvedStream[] = [];
    xmlDoc('video_source').each((_, elem) => {
      const el = xmlDoc(elem);
      const name = el.attr('name') || 'Videa';
      const videoUrlPart = el.text().trim();
      const exp = el.attr('exp') || '';
      const hashTagName = `hash_value_${name}`;
      const md5 = xmlDoc(hashTagName).first().text().trim();

      if (videoUrlPart && md5) {
        const fullUrl = videoUrlPart.startsWith('http')
          ? `${videoUrlPart}?md5=${md5}&expires=${exp}`
          : `https:${videoUrlPart}?md5=${md5}&expires=${exp}`;

        streams.push({
          name: `Videa (${name})`,
          quality: name,
          url: fullUrl,
          isM3u8: fullUrl.includes('.m3u8'),
          headers: { Referer: url },
        });
      }
    });

    return streams;
  } catch (err) {
    logger.warn(`Videa extraction failed: ${(err as Error).message}`);
    return [];
  }
}
