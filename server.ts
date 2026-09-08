import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dns from 'node:dns';
import { createServer as createViteServer } from 'vite';
import { stremioRouter } from './src/addon/router.js';
import { registry } from './src/providers/index.js';
import { StremioContentType } from './src/types/stremio.js';
import { Logger } from './src/utils/logger.js';

// Ensure IPv4 is resolved first to avoid cloud environment (Render/Docker) IPv6 hanging
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if not supported
}

const logger = new Logger('Server');
const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    if (!req.url.startsWith('/@') && !req.url.startsWith('/src') && !req.url.startsWith('/node_modules')) {
      logger.debug(`${req.method} ${req.url}`);
    }
    next();
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      providersCount: registry.getAllProviders().length,
      uptime: process.uptime(),
    });
  });

  // Stream proxy endpoint (to allow Stremio web and browser preview player to bypass CORS / hotlink protection)
  app.get('/api/stream-proxy', async (req: Request, res: Response) => {
    const streamUrl = req.query.url as string;
    const referer = req.query.referer as string;
    const origin = req.query.origin as string;
    const userAgent = req.query.userAgent as string;

    if (!streamUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent':
          userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      };
      if (referer) headers['Referer'] = referer;
      if (origin) headers['Origin'] = origin;

      const upstream = await fetch(streamUrl, {
        headers,
        redirect: 'follow',
      });

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      logger.error(`Proxy stream error for ${streamUrl}: ${(err as Error).message}`);
      res.status(500).send(`Failed to proxy stream: ${(err as Error).message}`);
    }
  });

  // Provider API for Web Dashboard & diagnostics
  app.get('/api/providers', (_req: Request, res: Response) => {
    const list = registry.getAllProviders().map((p) => ({
      id: p.id,
      name: p.name,
      lang: p.lang,
      mainUrl: p.mainUrl,
      supportedTypes: p.supportedTypes,
    }));
    res.json({ providers: list });
  });

  app.get('/api/search', async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const providerId = req.query.provider as string;

    if (!q) return res.json({ results: [] });

    try {
      if (providerId) {
        const p = registry.getProvider(providerId);
        if (!p) return res.status(404).json({ error: 'Provider not found' });
        const items = await p.search(q);
        return res.json({ results: items });
      }

      const items = await registry.searchAll(q);
      res.json({ results: items });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/catalog', async (req: Request, res: Response) => {
    const type = (req.query.type as StremioContentType) || 'movie';
    const providerId = req.query.provider as string;
    const page = parseInt((req.query.page as string) || '1', 10);

    try {
      if (providerId) {
        const p = registry.getProvider(providerId);
        if (!p) return res.status(404).json({ error: 'Provider not found' });
        const items = await p.getCatalog(type, page);
        return res.json({ results: items });
      }

      const items = await registry.getCatalog(type, page);
      res.json({ results: items });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/meta', async (req: Request, res: Response) => {
    const id = req.query.id as string;
    const type = (req.query.type as StremioContentType) || 'movie';

    if (!id) return res.status(400).json({ error: 'Missing id parameter' });

    try {
      const meta = await registry.getMeta(id, type);
      res.json({ meta });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/streams', async (req: Request, res: Response) => {
    const id = req.query.id as string;
    const type = (req.query.type as StremioContentType) || 'movie';
    const episodeId = req.query.episodeId as string | undefined;

    if (!id) return res.status(400).json({ error: 'Missing id parameter' });

    try {
      const streams = await registry.getStreams(id, type, episodeId);
      res.json({ streams });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Diagnostic endpoint to check upstream provider connectivity from host
  app.get('/api/debug-fetch', async (req: Request, res: Response) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: 'Missing url query parameter' });

    try {
      const resp = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      const text = await resp.text();
      res.json({
        url: targetUrl,
        status: resp.status,
        statusText: resp.statusText,
        headers: Object.fromEntries(resp.headers.entries()),
        preview: text.slice(0, 500),
      });
    } catch (err) {
      res.status(500).json({
        url: targetUrl,
        error: (err as Error).message,
      });
    }
  });

  // Stremio Addon Protocol Routes
  app.use('/', stremioRouter);

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve static files with proper MIME types
    app.use(express.static(distPath, { index: false }));
    // Serve index.html for root and any non-API client routes
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Re-3arabi Stremio Addon Server running on http://0.0.0.0:${PORT}`);
    logger.info(`Stremio Manifest URL: http://0.0.0.0:${PORT}/manifest.json`);
  });
}

startServer().catch((err) => {
  logger.error(`Fatal server startup error: ${err.message}`, err);
});
