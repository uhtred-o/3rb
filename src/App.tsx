import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { ProviderGrid, ProviderInfo } from './components/ProviderGrid.js';
import { ContentExplorer } from './components/ContentExplorer.js';
import { StreamModal } from './components/StreamModal.js';
import { SetupGuide } from './components/SetupGuide.js';
import { ProviderItem } from './types/provider.js';
import { StremioContentType } from './types/stremio.js';

export default function App() {
  const [manifestUrl, setManifestUrl] = useState<string>('');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const [activeType, setActiveType] = useState<StremioContentType>('movie');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<ProviderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [selectedItem, setSelectedItem] = useState<ProviderItem | null>(null);

  useEffect(() => {
    // Determine manifest URL dynamically
    const origin = window.location.origin;
    setManifestUrl(`${origin}/manifest.json`);

    // Fetch provider fleet
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.providers) setProviders(data.providers);
      })
      .catch((err) => console.error('Failed to load providers:', err));

    // Load initial catalog
    loadCatalog('movie', null);
  }, []);

  const loadCatalog = (type: StremioContentType, providerId: string | null) => {
    setLoadingItems(true);
    const providerParam = providerId ? `&provider=${encodeURIComponent(providerId)}` : '';
    fetch(`/api/catalog?type=${type}${providerParam}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.results || []);
        setLoadingItems(false);
      })
      .catch(() => setLoadingItems(false));
  };

  const handleProviderSelect = (pId: string | null) => {
    setSelectedProvider(pId);
    setSearchQuery('');
    loadCatalog(activeType, pId);
  };

  const handleTypeChange = (type: StremioContentType) => {
    setActiveType(type);
    setSearchQuery('');
    loadCatalog(type, selectedProvider);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadCatalog(activeType, selectedProvider);
      return;
    }

    setLoadingItems(true);
    const providerParam = selectedProvider ? `&provider=${encodeURIComponent(selectedProvider)}` : '';
    fetch(`/api/search?q=${encodeURIComponent(searchQuery)}${providerParam}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.results || []);
        setLoadingItems(false);
      })
      .catch(() => setLoadingItems(false));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      <Navbar manifestUrl={manifestUrl} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProviderGrid
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={handleProviderSelect}
        />

        <ContentExplorer
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          activeType={activeType}
          onTypeChange={handleTypeChange}
          items={items}
          loading={loadingItems}
          onSelectItem={(item) => setSelectedItem(item)}
        />

        <SetupGuide manifestUrl={manifestUrl} />
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Re-3arabi Stremio Addon • High Performance Node.js Architecture</span>
          <span>Ported from CloudStream 3arabi repository</span>
        </div>
      </footer>

      {/* Stream Modal */}
      {selectedItem && (
        <StreamModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
