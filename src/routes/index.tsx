import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Combine,
  FileText,
  Loader2,
  Merge,
  MessagesSquare,
  PlayCircle,

  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CompilePanel } from "@/components/CompilePanel";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import { FormatPanel } from "@/components/FormatPanel";
import { DiffView } from "@/components/DiffView";
import { UploadPanel } from "@/components/UploadPanel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { callAiRouter } from "@/lib/ai-client";
import { buildDocx, downloadBlob } from "@/lib/docx-export";
import {
  applyFormatLock,
  checkLength,
  DEFAULT_WORDS_PER_PAGE,
  MAX_WORDS_UNDER_ORIGINAL,

  pagesFromWords,
  targetWordsFor,
} from "@/lib/format-lock";
import {
  autosaveProject,
  clearDraft,
  loadAutosavedProject,
  loadDraft,
  saveDraft,
} from "@/lib/local-drafts";
import {
  LENGTH_SYSTEM,
  lengthPrompt,
  PARITY_SYSTEM,
  parityPrompt,
  DIALOGUE_SYSTEM,
  dialoguePrompt,
  REWRITE_SYSTEM,
  rewritePrompt,
} from "@/lib/prompts";
import { useProject, type Project, type Segment } from "@/lib/project-store";
import {
  countDialogueLines,
  countWords,
  parseProse,
  VERIFIED_MARKER,
} from "@/lib/segments";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Novel Reconstruction Engine — Split, Rewrite & Compile Novels" },
      {
        name: "description",
        content:
          "Upload a novel PDF, split it into 5,000-word segments, rewrite each one into professional prose with full detail parity, and export a clean DOCX manuscript.",
      },
      { property: "og:title", content: "Novel Reconstruction Engine" },
      {
        property: "og:description",
        content:
          "Split, rewrite and recompile a full novel PDF in your browser with automatic AI provider fallback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

function driftPercent(original: number, rewritten: number) {
  if (!original) return 0;
  return ((rewritten - original) / original) * 100;
}

function WordMeter({
  label,
  words,
  drift,
}: {
  label: string;
  words: number;
  drift?: number | undefined;
}) {
  const off = drift !== undefined && Math.abs(drift) > 5;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <span className="uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{words.toLocaleString()} words</span>
      {drift !== undefined ? (
        <span
          className={`ml-auto flex items-center gap-1 tabular-nums ${
            off ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {off ? <AlertTriangle className="size-3.5" /> : null}
          {drift > 0 ? "+" : ""}
          {drift.toFixed(1)}%
        </span>
      ) : null}
    </div>
  );
}

function Workspace() {
  const { project, loaded, setProject, updateSegment } = useProject();
  const [activeId, setActiveId] = useState(1);
  const [phase, setPhase] = useState<"idle" | "rewrite" | "parity" | "length" | "dialogue">(
    "idle",
  );
  const [notice, setNotice] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);

  const [mobileTab, setMobileTab] = useState<"original" | "rewrite">("rewrite");
  const abortRef = useRef<AbortController | null>(null);
  const restored = useRef(false);

  // Offline restore: if IndexedDB came back empty, fall back to the LocalStorage mirror.
  useEffect(() => {
    if (!loaded || restored.current) return;
    restored.current = true;
    if (!project) {
      const saved = loadAutosavedProject();
      if (saved) setProject(saved);
    }
  }, [loaded, project, setProject]);

  // Autosave every change (segments, rewrites, approvals) to LocalStorage.
  useEffect(() => {
    if (!loaded) return;
    autosaveProject(project);
  }, [project, loaded]);

  const active = useMemo(
    () => project?.segments.find((segment) => segment.id === activeId) ?? project?.segments[0],
    [project, activeId],
  );

  // Restore any unsaved edit draft for this segment.
  useEffect(() => {
    if (!active) return;
    const saved = loadDraft(active.id);
    if (saved && saved.trim()) {
      setDraft(saved);
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const verifiedCount = project?.segments.filter((s) => s.status === "verified").length ?? 0;
  const busy = phase !== "idle";

  const originalWords = active ? countWords(active.original) : 0;
  const rewrittenPlain = active?.rewritten ? toPlainText(active.rewritten) : "";
  const rewrittenWords = editing ? countWords(draft) : countWords(rewrittenPlain);
  const liveRewriteWords = rewrittenWords;
  const drift = driftPercent(originalWords, rewrittenWords);
  const wordsPerPage = project?.wordsPerPage ?? DEFAULT_WORDS_PER_PAGE;
  const naturalPages = Math.max(1, Math.round(originalWords / wordsPerPage));
  const targetPages = active?.targetPages ?? naturalPages;
  const targetWords = targetWordsFor(targetPages, wordsPerPage);
  const currentPages = pagesFromWords(rewrittenWords, wordsPerPage);
  const pageDrift = driftPercent(targetWords, liveRewriteWords);

  const originalDialogue = active ? countDialogueLines(active.original) : 0;
  const rewrittenDialogue = countDialogueLines(editing ? draft : rewrittenPlain);
  const dialogueMissing = Math.max(0, originalDialogue - rewrittenDialogue);

  // Live elapsed clock for the running pass, so every section is visibly timed.
  useEffect(() => {
    if (phase === "idle") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => window.clearInterval(id);
  }, [phase]);


  const runRewrite = async (segment: Segment) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();
    setNotice([]);
    setEditing(false);
    setPhase("rewrite");
    updateSegment(segment.id, { status: "rewriting" });


    const formatLock = project?.formatLock !== false;
    const wpp = project?.wordsPerPage ?? DEFAULT_WORDS_PER_PAGE;
    const sourceWords = countWords(segment.original);
    const pages = segment.targetPages ?? Math.max(1, Math.round(sourceWords / wpp));
    const target = targetWordsFor(pages, wpp);
    // Hardwired floor: a rewrite may never come in more than 1,000 words under the original.
    const hardFloor = Math.max(0, sourceWords - MAX_WORDS_UNDER_ORIGINAL);

    try {
      const first = await callAiRouter(
        { system: REWRITE_SYSTEM, prompt: rewritePrompt(segment.original, target, hardFloor) },
        controller.signal,
      );

      setPhase("parity");
      let finalText = first.content;
      let parityNote = "Parity confirmed";
      try {
        const audit = await callAiRouter(
          { system: PARITY_SYSTEM, prompt: parityPrompt(segment.original, first.content) },
          controller.signal,
        );
        if (!audit.content.trim().toUpperCase().startsWith("PARITY_OK")) {
          if (parseProse(audit.content).length > 0) {
            finalText = audit.content;
            parityNote = "Missing detail was re-injected before review";
          }
        }
      } catch (error) {
        parityNote = `Parity pass unavailable: ${(error as Error).message}`;
      }

      // Page lockdown + hard word floor: expand until the text clears the floor.
      const lengthNotes: string[] = [];
      for (let pass = 0; pass < 3; pass++) {
        const plain = parseProse(finalText).join("\n\n");
        const check = checkLength(plain, target, hardFloor);
        if (check.action === "ok") {
          if (pass === 0) lengthNotes.push(`Length on target (${check.words.toLocaleString()} words)`);
          break;
        }
        setPhase("length");
        try {
          const adjusted = await callAiRouter(
            {
              system: LENGTH_SYSTEM,
              prompt: lengthPrompt(plain, check.words, target, check.action, hardFloor),
            },
            controller.signal,
          );
          if (parseProse(adjusted.content).length > 0) {
            finalText = adjusted.content;
            lengthNotes.push(
              `${check.action === "expand" ? "Expanded" : "Trimmed"} from ${check.words.toLocaleString()} toward ${target.toLocaleString()} words`,
            );
          } else break;
        } catch (error) {
          lengthNotes.push(`Length pass failed: ${(error as Error).message}`);
          break;
        }
      }

      // Dialogue lockdown: if spoken lines came back short, automatically re-run a
      // restoration pass (up to twice) instead of only warning the user.
      const spokenBefore = countDialogueLines(segment.original);
      const dialogueNotes: string[] = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const plain = parseProse(finalText).join("\n\n");
        const spokenNow = countDialogueLines(plain);
        if (spokenNow >= spokenBefore) break;
        setPhase("dialogue");
        dialogueNotes.push(
          `Auto re-run ${attempt + 1}: ${spokenBefore - spokenNow} spoken line(s) missing — restoring`,
        );
        try {
          const repaired = await callAiRouter(
            {
              system: DIALOGUE_SYSTEM,
              prompt: dialoguePrompt(segment.original, plain, spokenBefore, spokenNow),
            },
            controller.signal,
          );
          const repairedPlain = parseProse(repaired.content).join("\n\n");
          if (
            repairedPlain.length > 0 &&
            countDialogueLines(repairedPlain) > spokenNow &&
            countWords(repairedPlain) >= countWords(plain) * 0.9
          ) {
            finalText = repaired.content;
          } else {
            dialogueNotes.push("Restoration pass produced no usable gain — keeping best version");
            break;
          }
        } catch (error) {
          dialogueNotes.push(`Dialogue restoration failed: ${(error as Error).message}`);
          break;
        }
      }

      const finalWords = countWords(parseProse(finalText).join("\n\n"));
      lengthNotes.push(
        finalWords >= hardFloor
          ? `Word floor held: ${finalWords.toLocaleString()} vs ${sourceWords.toLocaleString()} original (floor ${hardFloor.toLocaleString()})`
          : `Below hard floor by ${(hardFloor - finalWords).toLocaleString()} words — rerun before approving`,
      );



      const html = formatLock ? applyFormatLock(finalText) : toParagraphHtml(finalText);
      updateSegment(segment.id, {
        rewritten: html,
        status: "review",
        ...(first.provider_used ? { servedBy: first.provider_used } : {}),
      });
      const spokenAfter = countDialogueLines(parseProse(html).join("\n\n"));
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      setNotice([
        `Finished in ${seconds}s · served by ${first.provider_used ?? "unknown provider"}`,
        parityNote,
        ...dialogueNotes,
        spokenAfter >= spokenBefore
          ? `Dialogue intact (${spokenAfter}/${spokenBefore} spoken lines)`
          : `Dialogue check: ${spokenBefore - spokenAfter} spoken line(s) still missing after auto re-runs — edit before approving`,
        formatLock ? "Format Lock applied (curly quotes, em-dashes, indents)" : "Format Lock off",
        ...lengthNotes,
      ]);
      return true;
    } catch (error) {
      updateSegment(segment.id, { status: segment.rewritten ? "review" : "pending" });
      setNotice([`Rewrite failed: ${(error as Error).message}`]);
      return false;
    } finally {
      setPhase("idle");
      abortRef.current = null;
    }
  };

  /** Runs every remaining segment back to back, showing live timing for each. */
  const runAllRemaining = async () => {
    if (!project) return;
    const queue = project.segments.filter((s) => s.status !== "verified" && !s.rewritten);
    if (queue.length === 0) {
      setNotice(["Every segment already has a rewrite."]);
      return;
    }
    setBatch({ done: 0, total: queue.length });
    for (let i = 0; i < queue.length; i++) {
      const segment = queue[i];
      if (!segment) break;
      setActiveId(segment.id);
      const ok = await runRewrite(segment);
      setBatch({ done: i + 1, total: queue.length });
      if (!ok) break;
    }
    setBatch(null);
  };


  const combineWithNext = () => {
    if (!project || !active) return;
    const index = project.segments.findIndex((s) => s.id === active.id);
    const next = project.segments[index + 1];
    if (!next) return;
    const merged: Segment = {
      id: active.id,
      original: `${active.original}\n\n${next.original}`.trim(),
      rewritten:
        active.rewritten || next.rewritten
          ? `${active.rewritten}\n${next.rewritten}`.trim()
          : "",
      status: "pending",
    };
    const segments = [
      ...project.segments.slice(0, index),
      merged,
      ...project.segments.slice(index + 2),
    ].map((segment, i) => ({ ...segment, id: i + 1 }));
    const updated: Project = { ...project, segments };
    setProject(updated);
    setActiveId(merged.id);
    setNotice(["Segments combined — rerun the rewrite for the merged block."]);
  };

  const mergeUnedited = () => {
    if (!project) return;
    const segments = project.segments.map((segment) =>
      segment.rewritten
        ? segment
        : {
            ...segment,
            rewritten: `${toParagraphHtml(segment.original)}\n${VERIFIED_MARKER}`,
            status: "verified" as const,
          },
    );
    setProject({ ...project, segments });
    setNotice(["Un-rewritten segments were merged into the manuscript as-is."]);
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const originalPanel = (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Original text</p>
      <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed">
        {active?.original}
      </p>
    </div>
  );

  const rewritePanel = active?.rewritten ? (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Rewritten</p>
      <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed">
        {rewrittenPlain}
      </p>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      No rewrite yet for this segment.
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg leading-tight">
              Novel Reconstruction Engine
            </h1>
            {project ? (
              <p className="truncate text-xs text-muted-foreground">
                {project.fileName} · {project.segments.length} segments
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ApiKeyDialog />
            {project ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {verifiedCount}/{project.segments.length} verified
              </span>
            ) : null}
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
                <div className="max-h-[30vh] space-y-1 overflow-y-auto pr-1 lg:max-h-[52vh]">
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

              <FormatPanel
                project={project}
                segment={active}
                originalWords={originalWords}
                onProjectChange={setProject}
                onSegmentChange={(patch) => {
                  if (active) updateSegment(active.id, patch);
                }}
              />

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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[active.status]}`}
                  >
                    {STATUS_LABEL[active.status]}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <WordMeter label="Original" words={originalWords} />
                  <WordMeter
                    label="Rewrite"
                    words={liveRewriteWords}
                    drift={driftPercent(originalWords, liveRewriteWords)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    Page target:{" "}
                    <span className="font-medium text-foreground">{targetPages} pages</span> ·{" "}
                    {targetWords.toLocaleString()} words @ {wordsPerPage}/page
                  </span>
                  {rewrittenWords > 0 ? (
                    <span
                      className={`ml-auto tabular-nums ${
                        Math.abs(pageDrift) > 2 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      Now {currentPages.toFixed(1)} pages ({pageDrift > 0 ? "+" : ""}
                      {pageDrift.toFixed(1)}%)
                    </span>
                  ) : null}
                </div>

                <div
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    dialogueMissing > 0 && rewrittenWords > 0
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {dialogueMissing > 0 && rewrittenWords > 0 ? (
                    <AlertTriangle className="size-4 shrink-0" />
                  ) : (
                    <MessagesSquare className="size-4 shrink-0" />
                  )}
                  <span className="tabular-nums">
                    Dialogue lines {rewrittenWords > 0 ? rewrittenDialogue : "—"} /{" "}
                    {originalDialogue} in original
                  </span>
                  {dialogueMissing > 0 && rewrittenWords > 0 ? (
                    <span className="ml-auto">
                      {dialogueMissing} spoken line(s) may be missing
                    </span>
                  ) : null}
                </div>

                {Math.abs(drift) > 5 && rewrittenWords > 0 ? (
                  <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="size-4 shrink-0" />
                    Word count differs from the original by {Math.abs(drift).toFixed(1)}% — check for
                    condensed or dropped material.
                  </p>
                ) : null}

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    className="col-span-2 sm:col-auto"
                    disabled={busy}
                    onClick={() => void runRewrite(active)}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : active.rewritten ? (
                      <RefreshCw className="mr-2 size-4" />
                    ) : (
                      <Sparkles className="mr-2 size-4" />
                    )}
                    {active.rewritten ? "Rerun segment" : "Rewrite segment"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="col-span-2 sm:col-auto"
                    disabled={busy}
                    onClick={() => void runAllRemaining()}
                  >
                    <PlayCircle className="mr-2 size-4" />
                    Run all remaining
                  </Button>

                  <Button variant="outline" disabled={busy} onClick={combineWithNext}>
                    <Combine className="mr-2 size-4" />
                    Combine
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={mergeUnedited}>
                    <Merge className="mr-2 size-4" />
                    Merge unedited
                  </Button>
                </div>

                {busy ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {phase === "rewrite"
                      ? "Rewriting…"
                      : phase === "parity"
                        ? "Checking dialogue & detail parity…"
                        : phase === "dialogue"
                          ? "Restoring missing dialogue…"
                          : "Locking to page target…"}
                    <span className="tabular-nums font-medium text-foreground">
                      {elapsed.toFixed(1)}s elapsed
                    </span>
                    {batch ? (
                      <span className="tabular-nums">
                        segment {Math.min(batch.done + 1, batch.total)} of {batch.total}
                      </span>
                    ) : null}
                    <span className="tabular-nums">target {targetWords.toLocaleString()} words</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => abortRef.current?.abort()}
                    >
                      Stop
                    </Button>
                  </div>
                ) : null}


                {notice.length > 0 ? (
                  <ul className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {notice.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                {editing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        saveDraft(active.id, event.target.value);
                      }}
                      className="min-h-[45vh] font-serif text-[15px] leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          updateSegment(active.id, { rewritten: toParagraphHtml(draft) });
                          clearDraft(active.id);
                          setEditing(false);
                        }}
                      >
                        Save edits
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          clearDraft(active.id);
                          setEditing(false);
                        }}
                      >
                        Discard draft
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile: tabbed Original vs Rewrite */}
                    <div className="lg:hidden">
                      <Tabs
                        value={mobileTab}
                        onValueChange={(value) => setMobileTab(value as "original" | "rewrite")}
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="original">Original</TabsTrigger>
                          <TabsTrigger value="rewrite">Rewrite</TabsTrigger>
                        </TabsList>
                        <TabsContent value="original" className="mt-3">
                          {originalPanel}
                        </TabsContent>
                        <TabsContent value="rewrite" className="mt-3">
                          {rewritePanel}
                        </TabsContent>
                      </Tabs>
                    </div>

                    {/* Desktop: side-by-side review */}
                    <div className="hidden lg:block">
                      {active.rewritten ? (
                        <DiffView
                          original={active.original}
                          rewritten={rewrittenPlain}
                          mode="side"
                        />
                      ) : (
                        originalPanel
                      )}
                    </div>

                    {active.rewritten ? (
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
                            setDraft(rewrittenPlain);
                            setEditing(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit before approving
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
