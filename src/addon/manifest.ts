import { StremioManifest } from '../types/stremio.js';

export const manifest: StremioManifest = {
  id: 'community.re3arabi.addon',
  version: '1.0.0',
  name: 'Re-3arabi (عربي وأفلام وبث مباشر)',
  description:
    'Arabic Movies, TV Series, Anime, Turkish Drama, and Live TV from Akwam, FaselHD, Arabseed, WeCima, Anime4up, WitAnime, 3isk, Egydead, SyriaLive, and YacineTV.',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series', 'anime', 'channel', 'tv'],
  idPrefixes: [
    'akwam:',
    'faselhd:',
    'arabseed:',
    'wecima:',
    'anime4up:',
    'syrialive:',
    'yacinetv:',
    'witanime:',
    '3isk:',
    'egydead:',
  ],
  catalogs: [
    {
      type: 'movie',
      id: 're3arabi_movies',
      name: 'أفلام عربية وأجنبية (Movies)',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
    {
      type: 'series',
      id: 're3arabi_series',
      name: 'مسلسلات عربية وتركية (Series)',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
    {
      type: 'anime',
      id: 're3arabi_anime',
      name: 'أنمي مترجم (Anime)',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
        {
          name: 'skip',
          isRequired: false,
        },
      ],
    },
    {
      type: 'tv',
      id: 're3arabi_tv',
      name: 'بث مباشر وقنوات ومباريات (Live TV)',
      extra: [
        {
          name: 'search',
          isRequired: false,
        },
      ],
    },
  ],
  background: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1920&auto=format&fit=crop',
  logo: 'https://cdn-icons-png.flaticon.com/512/860/860331.png',
  behaviorHints: {
    configurable: false,
    configurationRequired: false,
  },
};
