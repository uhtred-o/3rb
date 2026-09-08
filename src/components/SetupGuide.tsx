import React from 'react';
import { Tv, Monitor, Smartphone, Globe, Shield, Terminal, ArrowRight } from 'lucide-react';

interface SetupGuideProps {
  manifestUrl: string;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ manifestUrl }) => {
  const stremioProtocolUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');

  return (
    <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-12">
      <div className="max-w-3xl">
        <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2 mb-2">
          <Tv className="w-5 h-5 text-amber-400" />
          <span>How to Install into Stremio</span>
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          Follow these simple instructions to install the Re-3arabi multi-provider addon into any Stremio client.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm mb-3">
              1
            </div>
            <h4 className="font-semibold text-xs text-zinc-200 mb-1">Click Install</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Click <strong>"Install in Stremio"</strong> in the top navigation or copy the manifest URL.
            </p>
          </div>

          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm mb-3">
              2
            </div>
            <h4 className="font-semibold text-xs text-zinc-200 mb-1">Confirm Installation</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Stremio will automatically open and prompt you to confirm adding <strong>Re-3arabi</strong> to your addons.
            </p>
          </div>

          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm mb-3">
              3
            </div>
            <h4 className="font-semibold text-xs text-zinc-200 mb-1">Stream Instantly</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Browse Arabic movies, series, anime, and live channels directly within the Stremio Discover and Search tabs!
            </p>
          </div>
        </div>

        {/* Manual Installation bar */}
        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-zinc-400 w-full sm:w-auto truncate">
            <Terminal className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="font-mono text-[11px] text-amber-300 truncate">{manifestUrl}</span>
          </div>
          <a
            href={stremioProtocolUrl}
            className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium whitespace-nowrap text-center transition"
          >
            Launch in App
          </a>
        </div>
      </div>
    </section>
  );
};
