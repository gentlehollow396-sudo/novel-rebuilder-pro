// src/components/TroubleshooterPanel.tsx
import React, { useEffect, useState } from 'react';
import {
  Provider,
  DiagnosticResult,
  runDiagnostics as runDiagnosticsFn,
  recommendFastestProvider,
  ensureFastestProviderSelected,
  detectWordShortage,
} from '../utils/troubleshooter';

type Props = {
  // Providers to test. Each provider should include testUrl and optionally remainingWordsUrl.
  providers: Provider[];
  // Current provider id and setter used by the app to switch provider/fallback order.
  currentProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
};

export const TroubleshooterPanel: React.FC<Props> = ({ providers, currentProviderId = null, onSelectProvider }) => {
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runDiagnostics() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await runDiagnosticsFn(providers);
      setResults(res);
      const { shortage, providersUnder } = detectWordShortage(res);
      if (shortage) {
        setMessage(`Word shortage detected on: ${providersUnder?.join(', ')}`);
      }
    } catch (err: any) {
      setMessage(String(err?.message ?? err));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    // run diagnostics on mount but do not block UI
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUseFastest() {
    if (!results) {
      setMessage('Run diagnostics first');
      return;
    }
    const best = ensureFastestProviderSelected(results, (id) => {
      if (onSelectProvider) onSelectProvider(id);
    });
    if (best) setMessage(`Selected fastest provider: ${best.name} (id: ${best.id})`);
    else setMessage('No available provider found by diagnostics');
  }

  return (
    <div style={{ padding: 12, border: '1px solid var(--border, #ddd)', borderRadius: 8, background: 'var(--panel-bg, #fff)' }}>
      <h3 style={{ marginTop: 0 }}>AI Troubleshooter</h3>
      <p style={{ marginTop: 0, color: '#555' }}>Diagnose connectivity, latency, and word-credits for AI providers.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={runDiagnostics} disabled={running}>
          {running ? 'Running…' : 'Run diagnostics'}
        </button>
        <button onClick={handleUseFastest} disabled={!results || running}>
          Use fastest provider
        </button>
      </div>

      {message && (
        <div style={{ marginBottom: 12, padding: 8, background: '#fffbe6', border: '1px solid #ffe58f' }}>{message}</div>
      )}

      <div>
        {results ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6 }}>Provider</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Latency</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Remaining words</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} style={{ background: r.id === currentProviderId ? 'rgba(0, 120, 255, 0.05)' : undefined }}>
                  <td style={{ padding: 6 }}>{r.name}</td>
                  <td style={{ padding: 6 }}>{r.ok ? 'Reachable' : `Error: ${r.error ?? 'unknown'}`}</td>
                  <td style={{ padding: 6 }}>{r.latencyMs != null ? `${r.latencyMs} ms` : '—'}</td>
                  <td style={{ padding: 6 }}>{typeof r.remainingWords === 'number' ? r.remainingWords : 'unknown'}</td>
                  <td style={{ padding: 6 }}>
                    <button
                      onClick={() => {
                        if (onSelectProvider) onSelectProvider(r.id);
                        setMessage(`Selected provider: ${r.name}`);
                      }}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: '#777' }}>Diagnostics not run yet.</div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <small style={{ color: '#666' }}>Notes: Test endpoints should be provided by the app and may be proxied through the project gateway if provider APIs require server-side keys.</small>
      </div>
    </div>
  );
};

export default TroubleshooterPanel;
