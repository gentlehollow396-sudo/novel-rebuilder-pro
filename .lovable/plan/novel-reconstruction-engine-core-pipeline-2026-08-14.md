# Novel Reconstruction Engine — Core Pipeline

A single-page, mobile-first workspace that ingests a novel PDF, splits it into 10,000-word segments, rewrites each one with AI under human approval, and compiles the approved segments into a DOCX manuscript. Everything stays in the browser; AI keys never leave the device except to call the chosen provider.

## What gets built now

**1. Upload & split**
- Drag/tap-to-upload a PDF, parsed in-browser.
- Text extracted per page, then chunked into ~10,000-word segments on paragraph boundaries (never mid-paragraph).
- Page 1 is rendered to an image and stored as the book cover; it can be replaced later without reprocessing.
- Segment index persists in the browser, so a reload resumes the same project.

**2. Segment navigator**
- Vertical list: Segment 1..N with status chips (Pending / Rewriting / Awaiting approval / Verified).
- Tap any segment to jump straight to it.
- Progress bar showing verified vs total.

**3. Rewrite & approval loop**
- Rewrite prompt enforces: professional novel prose, no summarizing, no censoring, no omission, full dialogue and detail parity, `<p>` blocks only, no headings/page numbers/lists/preamble.
- After generation, a parity pass compares rewritten output against the source segment; any missing detail triggers an automatic re-injection round before the result is shown.
- Diff view (original vs rewritten) with a word-count comparison, switchable between side-by-side (wide) and stacked (phone).
- The flow pauses for the user: Approve, Edit then approve, or Regenerate. Approved segments are marked verified with the `<!-- SEGMENT_VERIFIED_BY_AI -->` marker.

**4. AI Keys & Credits menu**
- Header menu holding Gemini, OpenRouter, Cloudflare Workers AI (`accountId:apiToken`), and Groq keys.
- Keys stored in browser local storage only; a user key always overrides the project key.
- Per key: format check plus a live connectivity test with a clear pass/fail state.
- Panel shows OpenRouter balance/usage, Groq usage, Gemini/Cloudflare status, project-key status, per-provider rewrite counts and word totals, and a Reset button.

**5. Provider selection & fallback**
- Dropdown: Gemini, OpenRouter, Cloudflare Workers AI, Groq, Open-source fallback.
- Fallback order on failure or exhausted credits: user Gemini → user OpenRouter → user Cloudflare → user Groq → project Gemini → project OpenRouter → project Cloudflare → project Groq → free/open-source provider.
- Switching is silent and mid-flight; the rewrite is not interrupted and the UI reports which provider actually served it.
- Retired-model errors (e.g. the Gemini 404 "no longer available to new users") are treated as provider failures and advance the chain immediately.

**6. Compile & export**
- Collects every verified segment in order into one continuous narrative with paragraph structure preserved.
- Toggle: strip headings/page numbers ON/OFF.
- Cover image included as the first page, replaceable via an image upload without touching segments.
- Downloadable DOCX.

**7. Mobile**
- Designed for vertical phone first: sticky segment navigator drawer, stacked diff, thumb-reachable rewrite/approve controls, collapsible credit monitor.

## Deferred to a follow-up

Patch mode (`[PATCH_PARAGRAPH]` targeted paragraph fixes), standalone `[INCORPORATE_MISSING_PIECES]` deep-rescan command, and PDF export. The parity re-injection built into the rewrite loop already covers the common case for missing detail.

## Technical notes

- Stack: TanStack Start, single `/` route with panel-based UI; no backend tables since storage is browser-only.
- PDF text extraction and page-1 rendering with `pdfjs-dist` loaded client-side only (dynamic import behind a hydration gate, since it is browser-only).
- Segments, statuses, rewritten text, cover image, and usage counters in IndexedDB (via `idb-keyval`); API keys in local storage.
- Provider calls: Gemini REST, OpenRouter (`https://openrouter.ai/api/v1`), Cloudflare Workers AI REST, Groq (OpenAI-compatible). When a user key exists the call goes direct from the browser with that key; when falling back to project keys the call is proxied through a server function so project secrets are never exposed.
- Project-key path and the free/open-source fallback use the Lovable AI gateway from a server function.
- Long rewrites stream so a 10k-word segment does not stall behind a single buffered request.
- DOCX generation with the `docx` package in-browser; cover embedded as an image on page one.
- Design system: warm paper-and-ink manuscript palette with a serif display face for prose and a clean sans for UI chrome, defined as tokens in `src/styles.css`.
