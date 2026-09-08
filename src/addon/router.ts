import { Router, Request, Response } from 'express';
import { manifest } from './manifest.js';
import { registry } from '../providers/index.js';
import { StremioCatalogItem, StremioContentType, StremioMetaDetail, StremioStream } from '../types/stremio.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('StremioRouter');
export const stremioRouter = Router();

// Middleware for Stremio CORS and cache headers
stremioRouter.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'max-age=120, public');
  next();
});

// 1. Manifest
stremioRouter.get('/manifest.json', (_req: Request, res: Response) => {
  res.json(manifest);
});

// Helper to parse extra parameters from Stremio path
function parseExtra(extraStr?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!extraStr) return result;

  const parts = extraStr.split('&');
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k && v) {
      result[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return result;
}

// 2. Catalog handler
async function handleCatalog(req: Request, res: Response) {
  const type = req.params.type as StremioContentType;
  const extra = parseExtra(req.params.extra);
  const searchQuery = extra.search;
  const skip = parseInt(extra.skip || '0', 10);
  const page = Math.floor(skip / 20) + 1;

  try {
    let items = [];
    if (searchQuery) {
      logger.info(`Catalog search: type=${type} q="${searchQuery}"`);
      items = await registry.searchAll(searchQuery);
    } else {
      logger.info(`Catalog browse: type=${type} page=${page}`);
      items = await registry.getCatalog(type, page);
    }

    const metas: StremioCatalogItem[] = items.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.title,
      poster: item.poster,
      description: item.description,
      releaseInfo: item.year ? String(item.year) : undefined,
    }));

    res.json({ metas });
  } catch (err) {
    logger.error(`Error in catalog: ${(err as Error).message}`);
    res.json({ metas: [] });
  }
}

stremioRouter.get('/catalog/:type/:id.json', handleCatalog);
stremioRouter.get('/catalog/:type/:id/:extra.json', handleCatalog);

// 3. Meta handler
stremioRouter.get('/meta/:type/:id.json', async (req: Request, res: Response) => {
  const type = req.params.type as StremioContentType;
  const id = decodeURIComponent(req.params.id);

  try {
    logger.info(`Meta request: type=${type} id=${id}`);
    const detail = await registry.getMeta(id, type);

    if (!detail) {
      return res.status(404).json({ meta: null });
    }

    const meta: StremioMetaDetail = {
      id: detail.id,
      type: detail.type,
      name: detail.title,
      poster: detail.poster,
      background: detail.background || detail.poster,
      description: detail.description,
      releaseInfo: detail.year ? String(detail.year) : undefined,
      year: detail.year,
      genres: detail.genres,
      cast: detail.cast,
      videos: detail.episodes?.map((ep) => ({
        id: ep.id,
        title: ep.title,
        season: ep.season,
        episode: ep.episode,
        thumbnail: ep.poster,
      })),
    };

    res.json({ meta });
  } catch (err) {
    logger.error(`Error in meta for ${id}: ${(err as Error).message}`);
    res.json({ meta: null });
  }
});

// 4. Stream handler
stremioRouter.get('/stream/:type/:id.json', async (req: Request, res: Response) => {
  const type = req.params.type as StremioContentType;
  const id = decodeURIComponent(req.params.id);

  try {
    logger.info(`Stream request: type=${type} id=${id}`);

    // If ID is for a series episode or movie
    let contentId = id;
    let episodeId: string | undefined = undefined;

    // Check if ID is an episode format (e.g. provider:item:ep)
    const parts = id.split(':');
    if (parts.length > 2) {
      episodeId = id;
      contentId = `${parts[0]}:${parts[1]}`;
    }

    const resolved = await registry.getStreams(contentId, type, episodeId);

    const streams: StremioStream[] = resolved.map((s) => {
      // Build stream object with behaviorHints and proxy headers if needed
      const streamObj: StremioStream = {
        name: s.name,
        title: `${s.name} ${s.quality ? `[${s.quality}]` : ''}\nRe-3arabi High-Speed Stream`,
        url: s.url,
      };

      if (s.headers && Object.keys(s.headers).length > 0) {
        streamObj.behaviorHints = {
          notWebReady: false,
          proxyHeaders: {
            request: s.headers,
          },
        };
      }

      return streamObj;
    });

    res.json({ streams });
  } catch (err) {
    logger.error(`Error in stream request for ${id}: ${(err as Error).message}`);
    res.json({ streams: [] });
  }
});
