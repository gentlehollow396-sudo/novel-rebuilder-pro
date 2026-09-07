import { useState } from "react";
import { ExternalLink, Globe, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURATED_FREE_AI, type FreeAiProvider } from "@/lib/free-ai-providers";

type ScanResult = {
  scannedAt: string;
  curated: FreeAiProvider[];
  discovered: FreeAiProvider[];
  error: string | null;
};

function ProviderCard({ provider }: { provider: FreeAiProvider }) {
  return (
    <li className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{provider.name}</p>
        {!provider.verified ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            new
          </span>
        ) : null}
      </div>
      {provider.summary ? (
        <p className="mt-1 text-xs text-muted-foreground">{provider.summary}</p>
      ) : null}
      <p className="mt-1 text-xs text-primary">{provider.freeTier}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={provider.apiUrl} target="_blank" rel="noreferrer noopener">
            API page <ExternalLink />
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener">
            Get a key
          </a>
        </Button>
      </div>
    </li>
  );
}

export function FreeAiPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/free-ai-scan", { method: "POST" });
      const json = (await res.json()) as ScanResult;
      setResult(json);
      if (json.error && json.discovered.length === 0) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const list = result ? [...result.discovered, ...result.curated] : CURATED_FREE_AI;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Free AI services</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Services with a free API tier you can plug into the rewrite engine. Scan the web for
            newly launched ones.
          </p>
          <Button size="sm" onClick={scan} disabled={loading} className="w-full">
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Scanning…" : "Scan for new free AI"}
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {result ? (
            <p className="text-xs text-muted-foreground">
              {result.discovered.length} newly suggested · checked{" "}
              {new Date(result.scannedAt).toLocaleTimeString()}. Entries marked “new” come from the
              AI scan — confirm the link before trusting it.
            </p>
          ) : null}
          <ul className="space-y-2">
            {list.map((p) => (
              <ProviderCard key={`${p.name}-${p.apiUrl}`} provider={p} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
