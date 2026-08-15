import { useMemo } from "react";
import { wordDiff } from "@/lib/diff";
import { countWords } from "@/lib/segments";

type Props = { original: string; rewritten: string; mode: "stacked" | "side" };

function Column({
  title,
  words,
  children,
}: {
  title: string;
  words: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {words.toLocaleString()} words
        </span>
      </div>
      <div className="max-h-[52vh] overflow-y-auto px-3 py-3 font-serif text-[15px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function DiffView({ original, rewritten, mode }: Props) {
  const parts = useMemo(() => wordDiff(original, rewritten), [original, rewritten]);

  const originalNode = parts
    .filter((part) => part.type !== "added")
    .map((part, index) => (
      <span
        key={index}
        className={part.type === "removed" ? "rounded bg-destructive/15 text-foreground" : ""}
      >
        {part.value}
      </span>
    ));

  const rewrittenNode = parts
    .filter((part) => part.type !== "removed")
    .map((part, index) => (
      <span key={index} className={part.type === "added" ? "rounded bg-primary/15" : ""}>
        {part.value}
      </span>
    ));

  return (
    <div className={mode === "side" ? "flex gap-3" : "flex flex-col gap-3"}>
      <Column title="Original" words={countWords(original)}>
        <p className="whitespace-pre-wrap">{originalNode}</p>
      </Column>
      <Column title="Rewritten" words={countWords(rewritten)}>
        <p className="whitespace-pre-wrap">{rewrittenNode}</p>
      </Column>
    </div>
  );
}
