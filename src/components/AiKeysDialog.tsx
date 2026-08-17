import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldX,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  loadUsage,
  resetUsage,
  saveKeys,
  keyFormatOk,
  type UsageMap,
  type UserKeys,
} from "@/lib/keys";
import { diagnoseKey, validateKey, type DiagnosticStep, type ValidationResult } from "@/lib/providers";


const FIELDS: { id: keyof UserKeys; label: string; placeholder: string }[] = [
  { id: "gemini", label: "Gemini API key", placeholder: "Your Gemini key" },
  // OpenRouter is intentionally omitted: it is handled server-side via the
  // OPENROUTER_API_KEY secret so the UI cannot interfere with that integration.
  { id: "cloudflare", label: "Cloudflare Workers AI", placeholder: "accountId:apiToken" },
  { id: "groq", label: "Groq API key", placeholder: "gsk_..." },
];

type Props = {
  keys: UserKeys;
  onChange: (keys: UserKeys) => void;
  usage: UsageMap;
  onUsageChange: (usage: UsageMap) => void;
};

export function AiKeysDialog({ keys, onChange, usage, onUsageChange }: Props) {
  const [results, setResults] = useState<Partial<Record<keyof UserKeys, ValidationResult>>>({});
  const [checking, setChecking] = useState<keyof UserKeys | null>(null);

  const update = (id: keyof UserKeys, value: string) => {
    const next = { ...keys, [id]: value };
    onChange(next);
    saveKeys(next);
  };

  const check = async (id: keyof UserKeys) => {
    if (!keyFormatOk(id, keys[id])) {
      setResults((prev) => ({ ...prev, [id]: { ok: false, detail: "Key format looks wrong" } }));
      return;
    }
    setChecking(id);
    const result = await validateKey(id, keys[id]);
    setResults((prev) => ({ ...prev, [id]: result }));
    setChecking(null);
  };

  const usageRows = Object.entries(usage);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <KeyRound className="size-4" />
          <span className="hidden sm:inline">AI Keys &amp; Credits</span>
          <span className="sm:hidden">Keys</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Keys &amp; Credits</DialogTitle>
          <DialogDescription>
            Keys are stored in this browser only and always take priority over the project keys, so
            your own credits are used first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {FIELDS.map((field) => {
            const result = results[field.id];
            return (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id}>{field.label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={field.id}
                    type="password"
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={keys[field.id]}
                    onChange={(event) => update(field.id, event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void check(field.id)}
                    disabled={checking === field.id || !keys[field.id].trim()}
                  >
                    {checking === field.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>
                </div>
                {result ? (
                  <p
                    className={`flex items-center gap-1.5 text-xs ${
                      result.ok ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {result.ok ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <ShieldX className="size-3.5" />
                    )}
                    {result.detail}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Rewrite usage</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetUsage();
                onUsageChange({});
              }}
            >
              Reset
            </Button>
          </div>
          {usageRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No rewrites recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {usageRows.map(([label, entry]) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span className="truncate text-muted-foreground">{label}</span>
                  <span className="shrink-0 tabular-nums">
                    {entry?.rewrites ?? 0} rewrites · {(entry?.words ?? 0).toLocaleString()} words
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Project keys stay on the server and are only used once every key you supplied has
            failed. The free/open-source provider is the last resort.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
