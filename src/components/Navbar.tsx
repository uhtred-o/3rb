import React, { useState } from 'react';
import { Tv, Play, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  manifestUrl: string;
}

export const Navbar: React.FC<NavbarProps> = ({ manifestUrl }) => {
  const [copied, setCopied] = useState(false);

  const copyManifest = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stremioProtocolUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');
  const stremioWebUrl = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;

  return (
    <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shadow-sm">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-zinc-100 tracking-tight">Re-3arabi</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Stremio Addon
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">10 Arabic Streaming & Live TV Providers</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={copyManifest}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
            title="Copy Manifest URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
            <span className="hidden md:inline">{copied ? 'Copied!' : 'Copy Manifest URL'}</span>
          </button>

          <a
            href={stremioProtocolUrl}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Install in Stremio</span>
          </a>

          <a
            href={stremioWebUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
          >
            <ExternalLink className="w-4 h-4 text-zinc-400" />
            <span>Stremio Web</span>
          </a>
        </div>
      </div>
    </header>
  );
};
