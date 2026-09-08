import crypto from 'crypto';

/**
 * Base64 decoding with padding normalization and URL-safe character handling
 */
export function safeBase64Decode(str: string): string {
  if (!str) return '';
  try {
    let cleaned = str.trim().replace(/-/g, '+').replace(/_/g, '/');
    const padNeeded = (4 - (cleaned.length % 4)) % 4;
    cleaned = cleaned + '='.repeat(padNeeded);
    return Buffer.from(cleaned, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Base64 decoding directly to Buffer
 */
export function safeBase64DecodeBuffer(str: string): Buffer {
  if (!str) return Buffer.alloc(0);
  try {
    let cleaned = str.trim().replace(/-/g, '+').replace(/_/g, '/');
    const padNeeded = (4 - (cleaned.length % 4)) % 4;
    cleaned = cleaned + '='.repeat(padNeeded);
    return Buffer.from(cleaned, 'base64');
  } catch {
    return Buffer.alloc(0);
  }
}

/**
 * Decrypts YacineTV API responses using the XOR cipher with baseKey and 't' header
 */
export function decryptYacine(encryptedBase64: string, tHeader: string): string {
  try {
    const baseKey = 'c!xZj+N9&G@Ev@vw';
    const fullKey = baseKey + (tHeader || '');
    const decodedBytes = safeBase64DecodeBuffer(encryptedBase64);
    if (decodedBytes.length === 0) return '';

    const result = Buffer.alloc(decodedBytes.length);
    for (let i = 0; i < decodedBytes.length; i++) {
      result[i] = decodedBytes[i] ^ fullKey.charCodeAt(i % fullKey.length);
    }
    return result.toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Decrypts WitAnime processedEpisodeData string (part1.part2)
 */
export function decryptWitAnimeEpisodeData(encodedData: string): string {
  try {
    const parts = encodedData.split('.');
    if (parts.length !== 2) return '';

    const buf1 = safeBase64DecodeBuffer(parts[0]);
    const buf2 = safeBase64DecodeBuffer(parts[1]);

    if (buf1.length === 0 || buf2.length === 0) return '';

    const result = Buffer.alloc(buf1.length);
    for (let i = 0; i < buf1.length; i++) {
      result[i] = buf1[i] ^ buf2[i % buf2.length];
    }
    return result.toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * RC4 Decryption (used in VideaExtractor)
 */
export function rc4Decrypt(data: Buffer, key: string): string {
  try {
    const keyBuf = Buffer.from(key, 'utf-8');
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;

    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + keyBuf[i % keyBuf.length]) & 0xff;
      const tmp = s[i];
      s[i] = s[j];
      s[j] = tmp;
    }

    let i = 0;
    j = 0;
    const out = Buffer.alloc(data.length);
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) & 0xff;
      j = (j + s[i]) & 0xff;
      const tmp = s[i];
      s[i] = s[j];
      s[j] = tmp;
      out[k] = data[k] ^ s[(s[i] + s[j]) & 0xff];
    }

    return out.toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Generates random alphanumeric string
 */
export function randomAlphaNumeric(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
