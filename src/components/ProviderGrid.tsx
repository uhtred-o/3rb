import React from 'react';
import { Film, Clapperboard, Radio, Sparkles, CheckCircle2, Globe } from 'lucide-react';

export interface ProviderInfo {
  id: string;
  name: string;
  lang: string;
  mainUrl: string;
  supportedTypes: string[];
}

interface ProviderGridProps {
  providers: ProviderInfo[];
  selectedProvider: string | null;
  onSelectProvider: (id: string | null) => void;
}

export const ProviderGrid: React.FC<ProviderGridProps> = ({
  providers,
  selectedProvider,
  onSelectProvider,
}) => {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span>Supported Providers</span>
            <span className="text-xs font-normal text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              {providers.length} Active
            </span>
          </h2>
          <p className="text-xs text-zinc-400">Integrated directly from the CloudStream re-3arabi repository</p>
        </div>

        {selectedProvider && (
          <button
            onClick={() => onSelectProvider(null)}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 underline"
          >
            Show All Providers
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {providers.map((p) => {
          const isSelected = selectedProvider === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelectProvider(isSelected ? null : p.id)}
              className={`p-3 rounded-xl border transition cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-amber-100 shadow-md shadow-amber-500/5'
                  : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[90px]">
                    {p.mainUrl.replace(/^https?:\/\/(www\.)?/, '')}
                  </span>
                </div>
                <h3 className="font-semibold text-sm line-clamp-1 mb-1">{p.name}</h3>
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {p.supportedTypes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium"
                  >
                    {t === 'movie' && <Film className="w-2.5 h-2.5 mr-1" />}
                    {t === 'series' && <Clapperboard className="w-2.5 h-2.5 mr-1" />}
                    {(t === 'tv' || t === 'channel') && <Radio className="w-2.5 h-2.5 mr-1 text-red-400" />}
                    {t === 'anime' && <Sparkles className="w-2.5 h-2.5 mr-1 text-purple-400" />}
                    {t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
