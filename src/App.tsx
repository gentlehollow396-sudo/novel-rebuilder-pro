import React, { useEffect, useState } from 'react';
import HeaderWithTroubleshooter from './components/HeaderWithTroubleshooter';
import type { Provider } from './utils/troubleshooter';

// Main application shell that wires the HeaderWithTroubleshooter into the app and
// persists the selected provider in localStorage so selection survives reloads.

const LOCALSTORAGE_KEY = 'novelrebuilder.selectedProviderId';

const appProviders: Provider[] = [
  { id: 'gemini-user', name: 'Gemini (user)', testUrl: '/api/test/gemini', remainingWordsUrl: '/api/usage/gemini' },
  { id: 'openrouter-user', name: 'OpenRouter (user)', testUrl: '/api/test/openrouter', remainingWordsUrl: '/api/usage/openrouter' },
  { id: 'cloudflare-user', name: 'Cloudflare (user)', testUrl: '/api/test/cloudflare', remainingWordsUrl: '/api/usage/cloudflare' },
  // Add project-key / fallback providers here as needed
];

export const App: React.FC = () => {
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);

  // Load persisted provider on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY);
      if (saved) setCurrentProvider(saved);
    } catch (e) {
      // ignore
    }
  }, []);

  // Persist provider changes
  useEffect(() => {
    try {
      if (currentProvider) localStorage.setItem(LOCALSTORAGE_KEY, currentProvider);
      else localStorage.removeItem(LOCALSTORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }, [currentProvider]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeaderWithTroubleshooter
        currentProviderId={currentProvider}
        setCurrentProvider={(id: string) => setCurrentProvider(id)}
        providers={appProviders}
      />

      <main style={{ flex: 1, padding: 16 }}>
        {/* TODO: replace with your app's router / main workspace */}
        <h2>Welcome to Novel Rebuilder</h2>
        <p>Current provider: {currentProvider ?? 'not selected'}</p>

        {/* Example buttons to clear or pick default provider for testing */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              setCurrentProvider(appProviders[0].id);
            }}
          >
            Select {appProviders[0].name}
          </button>
          <button
            onClick={() => {
              setCurrentProvider(null);
            }}
          >
            Clear selection
          </button>
        </div>
      </main>

      <footer style={{ padding: 12, borderTop: '1px solid var(--border, #eee)', textAlign: 'center', color: '#666' }}>
        © Novel Rebuilder
      </footer>
    </div>
  );
};

export default App;
