import React, { useState, useEffect } from 'react';
import { X, Play, Loader2, Copy, Check, Tv, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { ProviderDetail, ProviderItem, ResolvedStream } from '../types/provider.js';

interface StreamModalProps {
  item: ProviderItem | null;
  onClose: () => void;
}

export const StreamModal: React.FC<StreamModalProps> = ({ item, onClose }) => {
  const [meta, setMeta] = useState<ProviderDetail | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  const [streams, setStreams] = useState<ResolvedStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;

    let isMounted = true;
    setLoadingMeta(true);
    setMeta(null);
    setStreams([]);
    setErrorMsg(null);
    setActivePlaybackUrl(null);

    fetch(`/api/meta?id=${encodeURIComponent(item.id)}&type=${item.type}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setLoadingMeta(false);
        if (data.meta) {
          setMeta(data.meta);
          if (data.meta.episodes && data.meta.episodes.length > 0) {
            setSelectedEpisodeId(data.meta.episodes[0].id);
          } else {
            resolveStreams(item.id, item.type);
          }
        } else {
          resolveStreams(item.id, item.type);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadingMeta(false);
        resolveStreams(item.id, item.type);
      });

    return () => {
      isMounted = false;
    };
  }, [item]);

  useEffect(() => {
    if (selectedEpisodeId && item) {
      resolveStreams(item.id, item.type, selectedEpisodeId);
    }
  }, [selectedEpisodeId]);

  const resolveStreams = async (contentId: string, type: string, episodeId?: string) => {
    setLoadingStreams(true);
    setStreams([]);
    setErrorMsg(null);
    setActivePlaybackUrl(null);

    try {
      const epParam = episodeId ? `&episodeId=${encodeURIComponent(episodeId)}` : '';
      const res = await fetch(`/api/streams?id=${encodeURIComponent(contentId)}&type=${type}${epParam}`);
      const data = await res.json();
      setLoadingStreams(false);

      if (data.streams && data.streams.length > 0) {
        setStreams(data.streams);
      } else {
        setErrorMsg('No direct streams returned from this provider server. The provider may require anti-bot bypass.');
      }
    } catch (err) {
      setLoadingStreams(false);
      setErrorMsg(`Failed to resolve streams: ${(err as Error).message}`);
    }
  };

  const copyStreamUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {item.provider}
            </span>
            <h3 className="font-bold text-zinc-100 text-sm sm:text-base line-clamp-1">{item.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Metadata banner */}
          <div className="flex gap-4">
            {item.poster && (
              <img
                src={item.poster}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-24 sm:w-28 aspect-[2/3] object-cover rounded-xl border border-zinc-800 shrink-0"
              />
            )}
            <div className="space-y-2">
              <h4 className="font-bold text-zinc-100 text-base">{item.title}</h4>
              <p className="text-xs text-zinc-400 line-clamp-3">
                {meta?.description || item.description || 'No overview available for this title.'}
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                <span className="px-2 py-0.5 rounded bg-zinc-800">Type: {item.type}</span>
                {item.year && <span className="px-2 py-0.5 rounded bg-zinc-800">Year: {item.year}</span>}
              </div>
            </div>
          </div>

          {/* Episode Selector if series */}
          {meta?.episodes && meta.episodes.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Select Episode ({meta.episodes.length} Episodes available)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                {meta.episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                      selectedEpisodeId === ep.id
                        ? 'bg-amber-500 text-zinc-950 font-bold'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {ep.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video Player Preview if active */}
          {activePlaybackUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-amber-400">Active Player Preview</span>
                <button
                  onClick={() => setActivePlaybackUrl(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  Close Player
                </button>
              </div>
              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-inner">
                <video
                  src={activePlaybackUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Stream List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <span>Extracted Streams</span>
                {loadingStreams && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
              </h4>
              <button
                onClick={() => resolveStreams(item.id, item.type, selectedEpisodeId || undefined)}
                className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-amber-400 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh Streams</span>
              </button>
            </div>

            {loadingStreams ? (
              <div className="py-8 flex flex-col items-center justify-center text-zinc-400 bg-zinc-950 rounded-xl border border-zinc-800">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin mb-2" />
                <p className="text-xs">Extracting direct streams and video hosts...</p>
              </div>
            ) : errorMsg ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Notice</p>
                  <p className="text-zinc-400 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            ) : streams.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 bg-zinc-950 rounded-xl border border-zinc-800">
                Click refresh to resolve streams for this item.
              </div>
            ) : (
              <div className="space-y-2">
                {streams.map((s, idx) => {
                  const isCopied = copiedUrl === s.url;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-zinc-200">{s.name}</span>
                          {s.quality && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                              {s.quality}
                            </span>
                          )}
                          {s.isM3u8 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                              HLS
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono truncate max-w-md">{s.url}</p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => copyStreamUrl(s.url)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition flex items-center space-x-1"
                          title="Copy Stream URL"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          onClick={() => setActivePlaybackUrl(s.url)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition flex items-center space-x-1"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
