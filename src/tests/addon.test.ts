import { manifest } from '../addon/manifest.js';
import { registry } from '../providers/index.js';
import { unpackPacker } from '../utils/packer.js';
import { decryptYacine, decryptWitAnimeEpisodeData, safeBase64Decode } from '../utils/crypto.js';
import { MemoryCache } from '../utils/cache.js';

export async function runTests() {
  console.log('--- STARTING STREMIO ADDON TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Manifest Validation
  console.log('\n[Test Suite 1: Manifest Validation]');
  assert(manifest.id === 'community.re3arabi.addon', 'Manifest ID is correct');
  assert(manifest.name.includes('Re-3arabi'), 'Manifest Name contains Re-3arabi');
  assert(manifest.resources.includes('catalog') && manifest.resources.includes('stream'), 'Resources include catalog & stream');
  assert(manifest.types.includes('movie') && manifest.types.includes('series') && manifest.types.includes('tv'), 'Types include movie, series, tv');
  assert((manifest.catalogs || []).length >= 4, 'Has at least 4 catalogs (movies, series, anime, tv)');
  assert((manifest.idPrefixes || []).length === 10, 'All 10 provider ID prefixes registered in manifest');

  // 2. Provider Registry
  console.log('\n[Test Suite 2: Provider Registry]');
  const providers = registry.getAllProviders();
  assert(providers.length === 10, `Loaded all 10 target providers (found ${providers.length})`);

  const expectedIds = ['akwam', 'faselhd', 'arabseed', 'wecima', 'anime4up', 'syrialive', 'yacinetv', 'witanime', '3isk', 'egydead'];
  for (const id of expectedIds) {
    const p = registry.getProvider(id);
    assert(!!p, `Provider "${id}" is properly instantiated and registered`);
  }

  // 3. ID Parsing & Namespacing Round-Trip
  console.log('\n[Test Suite 3: ID Parsing & Namespacing]');
  const testId1 = 'akwam:series/12345';
  const parsed1 = registry.parseProviderAndId(testId1);
  assert(parsed1.provider?.id === 'akwam' && parsed1.contentId === 'series/12345', 'Namespaced ID parses correctly');

  const testId2 = 'yacinetv:channel/42';
  const parsed2 = registry.parseProviderAndId(testId2);
  assert(parsed2.provider?.id === 'yacinetv' && parsed2.contentId === 'channel/42', 'Live TV ID parses correctly');

  // 4. Crypto & Deobfuscation Algorithms
  console.log('\n[Test Suite 4: Deobfuscation & Decryption Algorithms]');
  // Base64 safe decoding
  const b64Input = 'aHR0cHM6Ly9leGFtcGxlLmNvbS9zdHJlYW0ubTN1OA';
  const decodedB64 = safeBase64Decode(b64Input);
  assert(decodedB64 === 'https://example.com/stream.m3u8', 'Base64 decodes URL correctly');

  // YacineTV XOR Decryption Test
  // Generate a test XOR payload with baseKey "c!xZj+N9&G@Ev@vw" + t "12345"
  const tHeader = '12345';
  const key = 'c!xZj+N9&G@Ev@vw12345';
  const plainText = JSON.stringify({ status: 200, data: [{ id: 1, name: 'beIN Sports 1' }] });
  const cipherBuf = Buffer.alloc(plainText.length);
  for (let i = 0; i < plainText.length; i++) {
    cipherBuf[i] = plainText.charCodeAt(i) ^ key.charCodeAt(i % key.length);
  }
  const encryptedBase64 = cipherBuf.toString('base64');
  const decryptedYacine = decryptYacine(encryptedBase64, tHeader);
  assert(decryptedYacine === plainText, 'YacineTV XOR cipher decrypts accurately');

  // WitAnime XOR Test
  const part1 = Buffer.from('hello_witanime_stream');
  const part2 = Buffer.from('secret_xor_key');
  const xored = Buffer.alloc(part1.length);
  for (let i = 0; i < part1.length; i++) {
    xored[i] = part1[i] ^ part2[i % part2.length];
  }
  const encodedWit = `${xored.toString('base64')}.${part2.toString('base64')}`;
  const decryptedWit = decryptWitAnimeEpisodeData(encodedWit);
  assert(decryptedWit === 'hello_witanime_stream', 'WitAnime dual-buffer XOR decryption works');

  // Dean Edwards Unpacker Test
  const packedScript = `eval(function(p,a,c,k,e,d){while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+c.toString(a)+'\\\\b','g'),k[c]);return p}('1 0="2";',3,3,'stream|var|https'.split('|')))`;
  const unpacked = unpackPacker(packedScript);
  assert(!!unpacked && unpacked.includes('var stream="https"'), 'Dean Edwards unpacker resolves successfully');

  // 5. Cache Module
  console.log('\n[Test Suite 5: In-Memory TTL Cache]');
  const cache = new MemoryCache(10);
  cache.set('key1', 'test_value', 10);
  assert(cache.get('key1') === 'test_value', 'Cache returns saved value');
  cache.delete('key1');
  assert(cache.get('key1') === null, 'Cache correctly deletes value');

  // 6. Provider Isolation
  console.log('\n[Test Suite 6: Provider Isolation & Graceful Fallback]');
  const invalidResult = await registry.getMeta('nonexistent:123', 'movie');
  assert(invalidResult === null, 'Non-existent provider gracefully returns null without crashing');

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  return { passed, failed };
}
