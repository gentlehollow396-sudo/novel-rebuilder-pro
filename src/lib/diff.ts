export type DiffPart = { value: string; type: "same" | "added" | "removed" };

function tokenize(text: string) {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/** Compact LCS word diff, good enough for segment-sized prose. */
export function wordDiff(a: string, b: string): DiffPart[] {
  const left = tokenize(a);
  const right = tokenize(b);

  // Trim shared prefix/suffix so the LCS table stays small.
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start++;
  let endL = left.length;
  let endR = right.length;
  while (endL > start && endR > start && left[endL - 1] === right[endR - 1]) {
    endL--;
    endR--;
  }

  const midL = left.slice(start, endL);
  const midR = right.slice(start, endR);
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], value: string) => {
    if (!value) return;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.value += value;
    else parts.push({ type, value });
  };

  push("same", left.slice(0, start).join(""));

  const MAX = 2500;
  if (midL.length > MAX || midR.length > MAX) {
    push("removed", midL.join(""));
    push("added", midR.join(""));
  } else {
    const n = midL.length;
    const m = midR.length;
    const table = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * (m + 1) + j] =
          midL[i] === midR[j]
            ? table[(i + 1) * (m + 1) + j + 1] + 1
            : Math.max(table[(i + 1) * (m + 1) + j], table[i * (m + 1) + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midL[i] === midR[j]) {
        push("same", midL[i]);
        i++;
        j++;
      } else if (table[(i + 1) * (m + 1) + j] >= table[i * (m + 1) + j + 1]) {
        push("removed", midL[i]);
        i++;
      } else {
        push("added", midR[j]);
        j++;
      }
    }
    while (i < n) push("removed", midL[i++]);
    while (j < m) push("added", midR[j++]);
  }

  push("same", left.slice(endL).join(""));
  return parts;
}
