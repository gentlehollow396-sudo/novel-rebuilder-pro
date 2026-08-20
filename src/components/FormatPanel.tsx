import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_WORDS_PER_PAGE,
  defaultWordsPerPageFor,
  targetWordsFor,
  type DetailLevel,
  type RewriteLanguage,
} from "@/lib/format-lock";
import type { Project, Segment } from "@/lib/project-store";

type Props = {
  project: Project;
  segment: Segment | undefined;
  originalWords: number;
  onProjectChange: (project: Project) => void;
  onSegmentChange: (patch: Partial<Segment>) => void;
};

export function FormatPanel({
  project,
  segment,
  originalWords,
  onProjectChange,
  onSegmentChange,
}: Props) {
  const effectiveWordsPerPage = defaultWordsPerPageFor(
    project.rewriteLanguage,
    project.detailLevel,
  );
  const wordsPerPage = project.wordsPerPage ?? effectiveWordsPerPage ?? DEFAULT_WORDS_PER_PAGE;
  const naturalPages = Math.max(1, Math.round(originalWords / wordsPerPage));
  const pages = segment?.targetPages ?? naturalPages;
  const targetWords = targetWordsFor(pages, wordsPerPage);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="font-serif text-lg">Uniformity &amp; page lock</h3>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <div>
          <Label htmlFor="format-lock" className="text-sm font-normal">
            Format Lock
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Curly quotes, tight em-dashes, 0.5in indents
          </p>
        </div>
        <Switch
          id="format-lock"
          checked={project.formatLock !== false}
          onCheckedChange={(checked) => onProjectChange({ ...project, formatLock: checked })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Rewrite language</Label>
        <Select
          value={project.rewriteLanguage ?? "English"}
          onValueChange={(value: RewriteLanguage) => {
            const nextWordsPerPage = defaultWordsPerPageFor(value, project.detailLevel ?? "detailed");
            onProjectChange({
              ...project,
              rewriteLanguage: value,
              wordsPerPage: nextWordsPerPage,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Spanish">Spanish</SelectItem>
            <SelectItem value="French">French</SelectItem>
            <SelectItem value="German">German</SelectItem>
            <SelectItem value="Italian">Italian</SelectItem>
            <SelectItem value="Portuguese">Portuguese</SelectItem>
            <SelectItem value="Japanese">Japanese</SelectItem>
            <SelectItem value="Chinese">Chinese</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Detail level</Label>
        <Select
          value={project.detailLevel ?? "detailed"}
          onValueChange={(value: DetailLevel) => {
            const nextWordsPerPage = defaultWordsPerPageFor(
              project.rewriteLanguage ?? "English",
              value,
            );
            onProjectChange({
              ...project,
              detailLevel: value,
              wordsPerPage: nextWordsPerPage,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
            <SelectItem value="maximal">Maximal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Words per page</Label>
        <Select
          value={String(wordsPerPage)}
          onValueChange={(value) =>
            onProjectChange({ ...project, wordsPerPage: Number(value) })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="250">250 (double-spaced standard)</SelectItem>
            <SelectItem value="275">275 (manuscript average)</SelectItem>
            <SelectItem value="300">300 (dense)</SelectItem>
            <SelectItem value={String(effectiveWordsPerPage)}>
              {effectiveWordsPerPage} (default for {project.rewriteLanguage ?? "English"}/{project.detailLevel ?? "detailed"})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="page-target" className="text-xs text-muted-foreground">
          Page target for this segment
        </Label>
        <Input
          id="page-target"
          type="number"
          min={1}
          step={1}
          value={pages}
          disabled={!segment}
          onChange={(event) => {
            const next = Math.max(1, Math.round(Number(event.target.value) || 1));
            onSegmentChange({ targetPages: next });
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Targets {targetWords.toLocaleString()} words, with up to 2,000 extra for detail. Natural
          length:
          {naturalPages} pages.
        </p>
      </div>
    </div>
  );
}
