# Re-3arabi Stremio Addon (عربي وأفلام وبث مباشر)

A high-performance Node.js / TypeScript Stremio Addon porting the Arabic streaming and Live TV providers from the CloudStream `re-3arabi` repository.

Supports **Movies**, **TV Series**, **Anime**, **Turkish Dramas**, and **Live TV / Matches** across 10 active providers with automated stream extraction and deobfuscation.

---

## 🌟 Supported Providers

| Provider | Name | Content Type | Upstream URL | Scrape / Bypass Method |
|---|---|---|---|---|
| **Akwam** | أكوام | Movies, Series | `https://akwam.to` | HTML parsing, direct download & stream resolution |
| **Yacine TV** | ياسين تيفي | Live TV, Sports | `https://def.ycnapi.com` | XOR cipher decryption (`c!xZj+N9&G@Ev@vw` + `t`), live HLS |
| **SyriaLive** | سيريا لايف | Live Matches | `https://www.syrlive.com` | Match container scraping, AlbaPlayer Base64 & Clappr extraction |
| **We Cima** | وي سيما | Movies, Series | `https://wecima.ac` | Custom Base64 (`aHR0c`) URL decoding, server list extraction |
| **FaselHD** | فاصل إعلاني | Movies, Series | `https://www.faselhd.ac` | Player iframe scraping, dynamic server button resolution |
| **Arabseed** | عرب سيد | Movies, Series | `https://m4.arabseed.one` | Watch page extraction, server embed resolution |
| **Anime4up** | أنمي فور اب | Anime, Movies | `https://w1.anime4up.rest` | Base64 server URLs, embed extraction |
| **WitAnime** | ويت أنمي | Anime, Movies | `https://witanime.pics` | Dual-buffer byte XOR deobfuscation (`part1 ^ part2`) |
| **3isk** | قصة عشق | Turkish Drama | `https://3esk.onl` | `data-clse` Base64 URLs, 2-stage POST token handshake, Dean Edwards unpacking |
| **Egydead** | إيجي ديد | Movies, Series | `https://egydead.beer` | Dynamic watch view form POST, server link collection, Turnstile graceful isolation |

---

## 🚀 Quick Stremio Installation

### 1. One-Click Install
If you have Stremio installed on your device, click the **"Install in Stremio"** button in the addon dashboard or use this protocol URL:
```text
stremio://<YOUR_DEPLOYED_URL>/manifest.json
```

### 2. Manual Installation
1. Open Stremio.
2. Navigate to **Community Addons** or search bar in the Addons section.
3. Paste the Manifest URL:
   ```text
   https://<YOUR_DEPLOYED_URL>/manifest.json
   ```
4. Click **Install**.

---

## 🛠️ Ported Extractors & Cryptographic Algorithms

- **Dean Edwards JavaScript Unpacker (`unpackPacker`)**: Algorithmically resolves packed scripts without invoking `eval()`.
- **YacineTV XOR Cipher**: Ports the Android Kotlin byte XOR decryptor using the base key and header seeds.
- **WitAnime Dual-Buffer XOR**: Decodes and decrypts split Base64 payloads for direct episode streams.
- **Base64 Normalization**: Handles non-standard padding, URL-safe characters, and custom prefixes (such as WeCima's `aHR0c`).
- **EarnVids & StreamHG Extractor**: Resolves multi-server HLS stream playlists.
- **Share4max / Megamax Extractor**: Queries Inertia.js partial component data endpoints.
- **Mail.ru Extractor**: Resolves `video_key` session cookies and metadata endpoints.
- **Videa Extractor**: Decrypts RC4 stream tokens using custom character permutation keys.

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ or 20+
- npm

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm run test
```

### Start Development Server
```bash
npm run dev
```
The server starts at `http://localhost:3000`.

---

## 📦 Production Build & Deployment

```bash
npm run build
npm start
```
This compiles the frontend assets with Vite, bundles the backend server into `dist/server.cjs` via `esbuild`, and launches the Node service on port 3000.

---

## 🛡️ Anti-Bot Handling & Known Limitations

- **Cloudflare Turnstile Challenges**: Providers like Egydead that occasionally invoke Cloudflare Turnstile CAPTCHA checks cannot run Android WebView touch simulations in a headless server environment. The addon detects 403 / 503 challenges and isolates the failure gracefully without crashing the addon.
- **Stream Hotlinking**: Some live streams require specific `Referer` or `User-Agent` headers. The addon provides proxy headers in Stremio's `behaviorHints.proxyHeaders` and includes a built-in proxy endpoint (`/api/stream-proxy`) for browser playback.
