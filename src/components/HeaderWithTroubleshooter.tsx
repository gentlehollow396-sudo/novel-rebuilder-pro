import React from 'react';
import TroubleshooterIconBox from './TroubleshooterIconBox';
import type { Provider } from '../utils/troubleshooter';

type Props = {
  currentProviderId?: string | null;
  setCurrentProvider?: (id: string) => void;
  // Optional: pass your app's providers; if omitted, the component will use a placeholder and you should replace it.
  providers?: Provider[];
};

// NOTE: Replace these placeholder endpoints with your actual gateway/test endpoints.
const defaultProviders: Provider[] = [
  { id: 'gemini-user', name: 'Gemini (user)', testUrl: '/api/test/gemini', remainingWordsUrl: '/api/usage/gemini' },
  { id: 'openrouter-user', name: 'OpenRouter (user)', testUrl: '/api/test/openrouter', remainingWordsUrl: '/api/usage/openrouter' },
  { id: 'cloudflare-user', name: 'Cloudflare (user)', testUrl: '/api/test/cloudflare', remainingWordsUrl: '/api/usage/cloudflare' },
  // add project keys / fallback entries as needed
];

export const HeaderWithTroubleshooter: React.FC<Props> = ({ currentProviderId = null, setCurrentProvider, providers = defaultProviders }) => {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border, #eee)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* App logo / title area */}
        <div style={{ fontWeight: 700, fontSize: 18 }}>Novel Rebuilder</div>
        <div style={{ color: '#666', fontSize: 13 }}>Rebuild novels with human-reviewed AI rewrites</div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Other header controls can go here (profile, project selector, credits) */}

        <TroubleshooterIconBox
          providers={providers}
          currentProviderId={currentProviderId}
          onSelectProvider={(id) => {
            if (setCurrentProvider) setCurrentProvider(id);
            // Persist selection where your app stores it (localStorage/indexedDB)
          }}
        />
      </div>
    </header>
  );
};

export default HeaderWithTroubleshooter;
