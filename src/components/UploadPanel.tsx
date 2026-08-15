import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ingestPdf } from "@/lib/pdf";
import { chunkParagraphs, toParagraphs, WORDS_PER_SEGMENT } from "@/lib/segments";
import type { Project } from "@/lib/project-store";

export function UploadPanel({ onReady }: { onReady: (project: Project) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      setStatus("Reading PDF…");
      const { pages, cover } = await ingestPdf(file, (done, total) =>
        setStatus(`Extracting text · page ${done} of ${total}`),
      );
      setStatus("Splitting into segments…");
      const paragraphs = toParagraphs(pages, true);
      const chunks = chunkParagraphs(paragraphs);
      onReady({
        fileName: file.name.replace(/\.pdf$/i, ""),
        createdAt: Date.now(),
        cover,
        stripHeadings: true,
        segments: chunks.map((original, index) => ({
          id: index + 1,
          original,
          rewritten: "",
          status: "pending" as const,
        })),
      });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void handleFile(file);
      }}
      className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"
    >
      <FileUp className="size-9 text-muted-foreground" />
      <div>
        <h2 className="font-serif text-2xl">Upload your novel</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The PDF is read here in your browser and split into{" "}
          {WORDS_PER_SEGMENT.toLocaleString()}-word segments. Page one becomes the cover.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button size="lg" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {busy ? "Working…" : "Choose PDF"}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
