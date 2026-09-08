import React from 'react';
import { Search, Loader2, Film, Clapperboard, Radio, Sparkles, Play } from 'lucide-react';
import { ProviderItem } from '../types/provider.js';
import { StremioContentType } from '../types/stremio.js';

interface ContentExplorerProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  activeType: StremioContentType;
  onTypeChange: (type: StremioContentType) => void;
  items: ProviderItem[];
  loading: boolean;
  onSelectItem: (item: ProviderItem) => void;
}

export const ContentExplorer: React.FC<ContentExplorerProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  activeType,
  onTypeChange,
  items,
  loading,
  onSelectItem,
}) => {
  const typeTabs: { id: StremioContentType; label: string; icon: React.ReactNode }[] = [
    { id: 'movie', label: 'Movies (أفلام)', icon: <Film className="w-4 h-4" /> },
    { id: 'series', label: 'Series (مسلسلات)', icon: <Clapperboard className="w-4 h-4" /> },
    { id: 'anime', label: 'Anime (أنمي)', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'tv', label: 'Live TV (بث مباشر)', icon: <Radio className="w-4 h-4" /> },
  ];

  return (
    <section className="mb-8">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {/* Type selector tabs */}
        <div className="flex items-center space-x-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-full sm:w-auto overflow-x-auto">
          {typeTabs.map((tab) => {
            const isActive = activeType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTypeChange(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input form */}
        <form onSubmit={onSearchSubmit} className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search across all providers..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
          />
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          {loading && <Loader2 className="w-4 h-4 text-amber-500 animate-spin absolute right-3 top-2.5" />}
        </form>
      </div>

      {/* Grid of Content */}
      {loading && items.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-sm">Fetching catalog from active Arabic providers...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl p-8 bg-zinc-900/30">
          <Film className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-zinc-300 font-semibold mb-1">No content found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try searching with an Arabic or English title (e.g. "Game of Thrones", "قيامة عثمان", "ون بيس")
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer flex flex-col shadow-sm"
            >
              {/* Poster container */}
              <div className="relative aspect-[2/3] bg-zinc-950 overflow-hidden">
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800/40 text-zinc-600">
                    <Film className="w-8 h-8" />
                  </div>
                )}

                {/* Overlay badge */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-amber-400 border border-white/10">
                    {item.provider}
                  </span>
                </div>

                {item.year && (
                  <span className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-zinc-300">
                    {item.year}
                  </span>
                )}

                {/* Play hover effect */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Title info */}
              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <h4 className="text-xs font-semibold text-zinc-200 line-clamp-2 leading-snug group-hover:text-amber-400 transition">
                  {item.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
