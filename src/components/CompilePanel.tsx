import { useRef, useState } from "react";
import { Download, FileText, ImageUp, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { buildDocx, compileParagraphs, downloadBlob } from "@/lib/docx-export";
import { buildPdf } from "@/lib/pdf-export";
import { countWords } from "@/lib/segments";
import type { Project } from "@/lib/project-store";

type Props = {
  project: Project;
  onProjectChange: (project: Project) => void;
};

export function CompilePanel({ project, onProjectChange }: Props) {
  const coverInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const verified = project.segments.filter((segment) => segment.status === "verified");

  const replaceCover = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onProjectChange({ ...project, cover: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const exportDocx = async () => {
    setBusy(true);
    try {
      const paragraphs = compileParagraphs(project);
      const blob = await buildDocx(project, paragraphs);
      downloadBlob(blob, `${project.fileName || "manuscript"}.docx`);
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const paragraphs = compileParagraphs(project);
      const blob = await buildPdf(project, paragraphs);
      downloadBlob(blob, `${project.fileName || "manuscript"}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  const words = verified.reduce((total, segment) => total + countWords(segment.rewritten), 0);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="font-serif text-lg">Compile manuscript</h3>
        <p className="text-sm text-muted-foreground">
          {verified.length} of {project.segments.length} segments verified ·{" "}
          {words.toLocaleString()} words ready
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
        <Label htmlFor="strip" className="text-sm font-normal">
          Strip headings &amp; page numbers
        </Label>
        <Switch
          id="strip"
          checked={project.stripHeadings}
          onCheckedChange={(checked) => onProjectChange({ ...project, stripHeadings: checked })}
        />
      </div>

      <div className="flex items-center gap-3">
        {project.cover ? (
          <img
            src={project.cover}
            alt="Book cover"
            className="h-24 w-16 rounded border border-border object-cover"
          />
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
            No cover
          </div>
        )}
        <div className="space-y-1">
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) replaceCover(file);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => coverInput.current?.click()}>
            <ImageUp className="mr-2 size-4" />
            Replace cover
          </Button>
          <p className="text-xs text-muted-foreground">Segments are not reprocessed.</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={busy || verified.length === 0} onClick={() => void exportDocx()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />}
          Export DOCX
        </Button>
        <Button variant="outline" disabled={busy || verified.length === 0} onClick={() => void exportPdf()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Printer className="mr-2 size-4" />}
          Export PDF
        </Button>
      </div>
    </div>
  );
}
