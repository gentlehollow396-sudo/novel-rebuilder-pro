import { useMemo, useState } from "react";
import { Highlighter, MessageSquareQuote, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findGaps, splitSentences, type Gap } from "@/lib/gaps";

type Props = {
  original: string;
  rewritten: string;
  /** Opens the rewrite editor with this line appended so it can be placed by hand. */
  onFixManually: (line: string) => void;
};

/**
 * Highlight tool: marks original sentences and spoken lines that look missing
 * from the rewrite, and hands them to the editor for a manual fix.
 */
export function GapPanel({ original, rewritten, onFixManually }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const gaps = useMemo(
    () => (open ? findGaps(original, rewritten) : []),
    [open, original, rewritten],
  );
  const gapIds = useMemo(() => new Set(gaps.map((g) => g.id)), [gaps]);
  const sentences = useMemo(() => (open ? splitSentences(original) : []), [open, original]);

  const dialogueCount = gaps.filter((g) => g.kind === "dialogue").length;

  return (
    <div className="space-y-3">
      <Button
        variant={open ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={!rewritten.trim()}
      >
        <Highlighter className="mr-2 size-4" />
        {open ? "Hide highlights" : "Highlight missing lines"}
      </Button>

      {open ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Original · highlighted gaps
            </p>
            <p className="max-h-[45vh] overflow-y-auto font-serif text-[15px] leading-relaxed">
              {sentences.map((sentence, index) => {
                const isGap = gapIds.has(`${index}`);
                const isSelected = selected === `${index}`;
                return (
                  <span
                    key={index}
                    onClick={() => isGap && setSelected(`${index}`)}
                    className={
                      isGap
                        ? `cursor-pointer rounded px-0.5 ${
                            isSelected
                              ? "bg-destructive/40 outline outline-1 outline-destructive"
                              : "bg-destructive/20"
                          }`
                        : ""
                    }
                  >
                    {sentence}{" "}
                  </span>
                );
              })}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Possibly missing</span>
              <span className="tabular-nums normal-case">
                {gaps.length} found · {dialogueCount} spoken
              </span>
            </div>
            {gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing obvious is missing from this rewrite.
              </p>
            ) : (
              <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {gaps.map((gap: Gap) => (
                  <li
                    key={gap.id}
                    className={`rounded-lg border p-2 text-sm ${
                      selected === gap.id ? "border-primary" : "border-border"
                    }`}
                    onClick={() => setSelected(gap.id)}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {gap.kind === "dialogue" ? (
                        <MessageSquareQuote className="size-3.5" />
                      ) : (
                        <ScrollText className="size-3.5" />
                      )}
                      {gap.kind === "dialogue" ? "Spoken line" : "Plot detail"}
                      <span className="ml-auto tabular-nums normal-case">
                        {Math.round(gap.score * 100)}% match
                      </span>
                    </div>
                    <p className="font-serif leading-relaxed">{gap.text}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onFixManually(gap.text)}>
                        Fix manually
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void navigator.clipboard?.writeText(gap.text)}
                      >
                        Copy
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
