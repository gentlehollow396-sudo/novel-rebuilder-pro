import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Columns2,
  Loader2,
  Pencil,
  RefreshCw,
  Rows2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AiKeysDialog } from "@/components/AiKeysDialog";
import { CompilePanel } from "@/components/CompilePanel";
import { DiffView } from "@/components/DiffView";
import { UploadPanel } from "@/components/UploadPanel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_KEYS,
  loadKeys,
  loadPreferredProvider,
  loadUsage,
  PROVIDER_LABELS,
  recordUsage,
  savePreferredProvider,
  type ProviderId,
  type UsageMap,
  type UserKeys,
} from "@/lib/keys";
import { runWithFallback } from "@/lib/providers";
import { PARITY_SYSTEM, parityPrompt, REWRITE_SYSTEM, rewritePrompt } from "@/lib/prompts";
import { useProject, type Segment } from "@/lib/project-store";
import { countWords, parseProse, VERIFIED_MARKER } from "@/lib/segments";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Novel Reconstruction Engine — Split, Rewrite & Compile Novels" },
      {
        name: "description",
        content:
          "Upload a novel PDF, split it into 10,000-word segments, rewrite each one into professional prose with full detail parity, and export a clean DOCX manuscript.",
      },
      { property: "og:title", content: "Novel Reconstruction Engine" },
      {
        property: "og:description",
        content:
          "Split, rewrite and recompile a full novel PDF in your browser with multi-provider AI fallback.",
      },
    ],
  }),
  component: Workspace,
});

const STATUS_LABEL: Record<Segment["status"], string> = {
  pending: "Pending",
  rewriting: "Rewriting",
  review: "Awaiting approval",
  verified: "Verified",
};

const STATUS_CLASS: Record<Segment["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  rewriting: "bg-accent text-accent-foreground",
  review: "bg-secondary text-secondary-foreground",
  verified: "bg-primary/15 text-primary",
};

function toParagraphHtml(text: string) {
  return parseProse(text)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

function toPlainText(html: string) {
  return parseProse(html).join("\n\n");
}

function Workspace() {
  const { project, loaded, setProject, updateSegment } = useProject();
  const [keys, setKeys] = useState<UserKeys>(EMPTY_KEYS);
  const [usage, setUsage] = useState<UsageMap>({});
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [activeId, setActiveId] = useState(1);
  const [stream, setStream] = useState("");
  const [phase, setPhase] = useState<"idle" | "rewrite" | "parity">("idle");
  const [notice, setNotice] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [diffMode, setDiffMode] = useState<"stacked" | "side">("stacked");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setKeys(loadKeys());
    setUsage(loadUsage());
    setProvider(loadPreferredProvider());
    setDiffMode(window.innerWidth >= 1024 ? "side" : "stacked");
  }, []);

  const active = useMemo(
    () => project?.segments.find((segment) => segment.id === activeId) ?? project?.segments[0],
    [project, activeId],
  );

  const verifiedCount = project?.segments.filter((s) => s.status === "verified").length ?? 0;
  const busy = phase !== "idle";

  const runRewrite = async (segment: Segment) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setNotice([]);
    setStream("");
    setEditing(false);
    setPhase("rewrite");
    updateSegment(segment.id, { status: "rewriting" });

    try {
      const first = await runWithFallback(keys, provider, {
        system: REWRITE_SYSTEM,
        prompt: rewritePrompt(segment.original),
        onDelta: (chunk) => setStream((prev) => prev + chunk),
        signal: controller.signal,
      });

      setPhase("parity");
      setStream("");
      let finalText = first.text;
      let parityNote = "Parity confirmed";
      try {
        const audit = await runWithFallback(keys, provider, {
          system: PARITY_SYSTEM,
          prompt: parityPrompt(segment.original, first.text),
          onDelta: (chunk) => setStream((prev) => prev + chunk),
          signal: controller.signal,
        });
        if (!audit.text.trim().toUpperCase().startsWith("PARITY_OK")) {
          const restored = parseProse(audit.text);
          if (restored.length > 0) {
            finalText = audit.text;
            parityNote = "Missing detail was re-injected before review";
          }
        }
      } catch (error) {
        parityNote = `Parity pass unavailable: ${(error as Error).message}`;
      }

      const html = toParagraphHtml(finalText);
      updateSegment(segment.id, { rewritten: html, status: "review", servedBy: first.servedBy });
      setUsage(recordUsage(first.servedBy, countWords(html)));
      setNotice([
        `Served by ${first.servedBy}`,
        parityNote,
        ...first.attempts.filter((a) => a.error).map((a) => `${a.label}: ${a.error}`),
      ]);
    } catch (error) {
      updateSegment(segment.id, { status: segment.rewritten ? "review" : "pending" });
      setNotice([`Rewrite failed: ${(error as Error).message}`]);
    } finally {
      setPhase("idle");
      setStream("");
      abortRef.current = null;
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg leading-tight">Novel Reconstruction Engine</h1>
            {project ? (
              <p className="truncate text-xs text-muted-foreground">
                {project.fileName} · {project.segments.length} segments
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={provider}
              onValueChange={(value) => {
                setProvider(value as ProviderId);
                savePreferredProvider(value as ProviderId);
              }}
            >
              <SelectTrigger className="w-[130px] sm:w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {PROVIDER_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AiKeysDialog keys={keys} onChange={setKeys} usage={usage} onUsageChange={setUsage} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!project ? (
          <UploadPanel
            onReady={(next) => {
              setProject(next);
              setActiveId(1);
            }}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>
                    {verifiedCount}/{project.segments.length} verified
                  </span>
                </div>
                <Progress value={(verifiedCount / project.segments.length) * 100} />
                <div className="max-h-[38vh] space-y-1 overflow-y-auto pr-1 lg:max-h-[52vh]">
                  {project.segments.map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => {
                        setActiveId(segment.id);
                        setEditing(false);
                        setNotice([]);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        segment.id === active?.id ? "bg-accent" : "hover:bg-accent/60"
                      }`}
                    >
                      <span>Segment {segment.id}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[segment.status]}`}
                      >
                        {STATUS_LABEL[segment.status]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <CompilePanel project={project} onProjectChange={setProject} />

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  if (confirm("Discard this project and all rewrites?")) setProject(null);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Start over
              </Button>
            </aside>

            {active ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl">Segment {active.id}</h2>
                  <span className="text-xs text-muted-foreground">
                    {countWords(active.original).toLocaleString()} words original
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="hidden sm:inline-flex"
                      onClick={() => setDiffMode(diffMode === "side" ? "stacked" : "side")}
                      aria-label="Toggle diff layout"
                    >
                      {diffMode === "side" ? (
                        <Rows2 className="size-4" />
                      ) : (
                        <Columns2 className="size-4" />
                      )}
                    </Button>
                    <Button disabled={busy} onClick={() => void runRewrite(active)}>
                      {busy ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : active.rewritten ? (
                        <RefreshCw className="mr-2 size-4" />
                      ) : (
                        <Sparkles className="mr-2 size-4" />
                      )}
                      {active.rewritten ? "Rewrite again" : "Rewrite segment"}
                    </Button>
                  </div>
                </div>

                {busy ? (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {phase === "rewrite" ? "Rewriting…" : "Checking detail parity…"}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => abortRef.current?.abort()}
                      >
                        Stop
                      </Button>
                    </p>
                    <p className="max-h-56 overflow-y-auto whitespace-pre-wrap font-serif text-sm leading-relaxed text-muted-foreground">
                      {stream.slice(-4000) || "Waiting for the first tokens…"}
                    </p>
                  </div>
                ) : null}

                {notice.length > 0 ? (
                  <ul className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {notice.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                {active.rewritten && !busy ? (
                  editing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="min-h-[50vh] font-serif text-[15px] leading-relaxed"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            updateSegment(active.id, { rewritten: toParagraphHtml(draft) });
                            setEditing(false);
                          }}
                        >
                          Save edits
                        </Button>
                        <Button variant="ghost" onClick={() => setEditing(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <DiffView
                        original={active.original}
                        rewritten={toPlainText(active.rewritten)}
                        mode={diffMode}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            updateSegment(active.id, {
                              status: "verified",
                              rewritten: `${active.rewritten.replace(VERIFIED_MARKER, "").trim()}\n${VERIFIED_MARKER}`,
                            })
                          }
                          disabled={active.status === "verified"}
                        >
                          <Check className="mr-2 size-4" />
                          {active.status === "verified" ? "Approved" : "Approve segment"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDraft(toPlainText(active.rewritten));
                            setEditing(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit before approving
                        </Button>
                      </div>
                    </>
                  )
                ) : null}

                {!active.rewritten && !busy ? (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                      Original text
                    </p>
                    <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed">
                      {active.original}
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
