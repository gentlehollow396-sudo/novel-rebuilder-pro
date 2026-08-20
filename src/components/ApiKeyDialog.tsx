import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearUserApiKeys,
  loadUserApiKeys,
  saveUserApiKeys,
  type UserApiKeys,
} from "@/lib/user-api-keys";

function maskKey(key: string) {
  return key ? `${key.slice(0, 4)}${"•".repeat(Math.max(4, key.length - 8))}${key.slice(-4)}` : "";
}

export function ApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<UserApiKeys>({});
  const [visible, setVisible] = useState<{ gemini: boolean; groq: boolean }>({
    gemini: false,
    groq: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) setKeys(loadUserApiKeys());
  }, [open]);

  const update = (provider: keyof UserApiKeys, value: string) => {
    setSaved(false);
    setKeys((current) => ({ ...current, [provider]: value }));
  };

  const save = () => {
    saveUserApiKeys(keys);
    setKeys(loadUserApiKeys());
    setSaved(true);
  };

  const clear = () => {
    clearUserApiKeys();
    setKeys({});
    setSaved(false);
  };

  const configured = Boolean(keys.gemini || keys.groq);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Manage API keys">
          <KeyRound />
          <span className="hidden sm:inline">API keys</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API keys</DialogTitle>
          <DialogDescription>
            Your keys stay in this browser and are sent only with rewrite requests. They are never
            saved in the project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(["gemini", "groq"] as const).map((provider) => {
            const label = provider === "gemini" ? "Gemini API key" : "Groq API key";
            const isVisible = visible[provider];
            const value = keys[provider] ?? "";
            return (
              <div key={provider} className="space-y-2">
                <Label htmlFor={`${provider}-api-key`}>{label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={`${provider}-api-key`}
                    type={isVisible ? "text" : "password"}
                    value={value}
                    placeholder={configured && value ? maskKey(value) : "Paste key"}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => update(provider, event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
                    onClick={() =>
                      setVisible((current) => ({ ...current, [provider]: !isVisible }))
                    }
                  >
                    {isVisible ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {value ? (
                  <p className="text-xs text-muted-foreground">Stored as {maskKey(value)}</p>
                ) : null}
              </div>
            );
          })}
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Only the browser storage and your configured AI provider receive these credentials.
              Clear them before using a shared computer.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={clear} disabled={!configured}>
            <Trash2 />
            Clear keys
          </Button>
          <Button type="button" onClick={save}>
            {saved ? "Saved" : "Save keys"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
