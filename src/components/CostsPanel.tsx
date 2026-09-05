import { Coins } from "lucide-react";
import { formatUsd, mergeRows, providerLabel, rowsFor } from "@/lib/costs";
import type { Project } from "@/lib/project-store";

/**
 * Shows what each segment spent — provider, tokens and estimated cost —
 * plus a per-provider roll-up so providers can be compared at a glance.
 */
export function CostsPanel({ project }: { project: Project }) {
  const perSegment = project.segments.map((segment) => ({
    id: segment.id,
    rows: rowsFor(segment.usage),
  }));
  const totals = mergeRows(perSegment.map((s) => s.rows));
  const grandTokens = totals.reduce((sum, r) => sum + r.totalTokens, 0);
  const grandCost = totals.reduce((sum, r) => sum + r.cost, 0);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Coins className="size-4" />
          Costs
        </span>
        <span className="text-muted-foreground">
          {grandTokens.toLocaleString()} tokens · {formatUsd(grandCost)}
        </span>
      </div>

      {grandTokens === 0 ? (
        <p className="text-muted-foreground">
          Run a segment and its provider, tokens and estimated cost will show up here.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-muted-foreground">By provider</p>
            {totals.map((row) => (
              <div key={row.provider} className="flex items-center justify-between gap-2">
                <span className="truncate">{providerLabel(row.provider)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {row.totalTokens.toLocaleString()} · {formatUsd(row.cost)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-border pt-2">
            <p className="text-muted-foreground">By segment</p>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {perSegment
                .filter((s) => s.rows.length > 0)
                .map((s) => {
                  const tokens = s.rows.reduce((sum, r) => sum + r.totalTokens, 0);
                  const cost = s.rows.reduce((sum, r) => sum + r.cost, 0);
                  const calls = s.rows.reduce((sum, r) => sum + r.calls, 0);
                  return (
                    <div key={s.id} className="flex items-start justify-between gap-2">
                      <span className="truncate">
                        Segment {s.id}
                        <span className="block text-[10px] text-muted-foreground">
                          {s.rows.map((r) => r.provider).join(", ")} · {calls} call
                          {calls === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {tokens.toLocaleString()} · {formatUsd(cost)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Costs are estimates from published list prices.
          </p>
        </>
      )}
    </div>
  );
}
