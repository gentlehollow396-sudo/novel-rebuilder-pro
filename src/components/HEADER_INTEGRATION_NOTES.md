
// USAGE NOTES (place this text in your dev docs or copy into a README section):

// 1) Replace your existing app header with the HeaderWithTroubleshooter component, or import it and include it inside your header layout.
// Example (in App.tsx or layout file):
// import HeaderWithTroubleshooter from 'src/components/HeaderWithTroubleshooter';
// const [currentProvider, setCurrentProvider] = useState<string | null>(null);
// <HeaderWithTroubleshooter currentProviderId={currentProvider} setCurrentProvider={setCurrentProvider} providers={myProviders} />

// 2) Provide a `providers` array that points testUrl/remainingWordsUrl to either your Lovable gateway endpoints or direct provider endpoints
// that are CORS-friendly and return a normalized JSON shape for usage (recommended: { remainingWords: number }).

// 3) Persist provider selection where your app currently stores provider choices (localStorage/IndexedDB) so the selection will survive reloads.

// 4) Optionally wire the Troubleshooter diagnostics to run on app load and then pass results into your rewrite flow so `handleRewriteResult` can auto-switch when a too-short rewrite is detected.
