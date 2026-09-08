import { Logger } from './logger.js';

const logger = new Logger('PackerUnpacker');

/**
 * Unpacks Dean Edwards packed JavaScript code:
 * eval(function(p,a,c,k,e,d){...}('payload', radix, count, 'symtab'.split('|')))
 * Operates purely via string substitution without calling eval()
 */
export function unpackPacker(packedJs: string, pageUrl: string = ''): string | null {
  try {
    const packerRegex =
      /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]+?)['"]\s*,\s*(\d+)\s*,\s*\d+\s*,\s*['"]([\s\S]+?)['"]\.split\(['"]\|['"]\)/;

    const match = packedJs.match(packerRegex);
    if (!match) {
      // Alternate regex without .split('|') explicitly in the match
      const altRegex =
        /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]+?)['"]\s*,\s*(\d+)\s*,\s*\d+\s*,\s*['"]([\s\S]+?)['"]/;
      const altMatch = packedJs.match(altRegex);
      if (!altMatch) return null;
      return unpackPayload(altMatch[1], parseInt(altMatch[2], 10), altMatch[3].split('|'), pageUrl);
    }

    const [, payloadRaw, radixStr, sympipe] = match;
    const radix = parseInt(radixStr, 10) || 36;
    const symtab = sympipe.split('|');

    return unpackPayload(payloadRaw, radix, symtab, pageUrl);
  } catch (err) {
    logger.warn(`Failed to unpack packer script: ${(err as Error).message}`);
    return null;
  }
}

function unpackPayload(payloadRaw: string, radix: number, symtab: string[], pageUrl: string): string {
  let payload = payloadRaw
    .replace(/location\.href/g, `'${pageUrl}'`)
    .replace(/window\.location/g, `'${pageUrl}'`)
    .replace(/document\.cookie/g, `''`);

  const tokenRegex = /\b[0-9a-zA-Z]+\b/g;

  return payload.replace(tokenRegex, (token) => {
    try {
      const idx = parseInt(token, radix);
      if (!isNaN(idx) && idx >= 0 && idx < symtab.length && symtab[idx]) {
        return symtab[idx];
      }
    } catch {
      // Ignore
    }
    return token;
  });
}

/**
 * Recursively unpacks nested packed scripts (up to maxIterations)
 */
export function unpackAll(code: string, pageUrl: string = '', maxIterations: number = 5): string {
  let current = code;
  for (let i = 0; i < maxIterations; i++) {
    if (!current.includes('eval(function(p,a,c,k,e,d)')) {
      break;
    }
    const unpacked = unpackPacker(current, pageUrl);
    if (!unpacked) break;
    current = unpacked;
  }
  return current;
}
