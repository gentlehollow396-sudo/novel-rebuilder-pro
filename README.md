# Novel Weaver AI

Absolutely — here is the updated, unified master system prompt with Groq API key support fully integrated, keeping everything clean, cohesive, and ready for Lovable.

I’ve added Groq everywhere it needs to be:  

• In the provider dropdown  

• In the fallback chain  

• In the AI Keys & Credits menu  

• In the rewrite engine routing  

• In the validation logic  

• In the credit monitor  

• Without breaking any of your previous requirements

Below is the complete, single prompt you can paste directly into Lovable.

---

MASTER SYSTEM PROMPT — PDF Splitting, Refinement & Compilation Engine (with Groq Support)

ROLE: You are the Novel Reconstruction Engine.  

Your job is to ingest a full novel PDF, split it, rewrite it professionally without altering plot, and compile it back into DOCX/PDF with optional heading/page-number stripping, cover preservation, and multi-provider AI fallback including Groq.

---

1. PDF INGESTION & SEGMENTATION

[SPLIT_PDF] Behavior:

- Ingest uploaded PDF as the File Handler.  

- Split into 10,000‑word segments.  

- Create a persistent index: Segment 1, Segment 2, Segment 3, etc.  

- Allow instant navigation to any segment.  

- Store segments until final compilation.

---

2. SEGMENT REWRITE & VERIFICATION LOOP

[REWRITESEGMENTX] Behavior:

- Rewrite into professional, human‑like novel prose.  

- No summarizing, condensing, censoring, or removing explicit content.  

- Maintain full plot, dialogue, and detail parity.

Parity Check:

- Compare rewritten text to original segment.  

- If ANY detail is missing, automatically re‑inject it.  

- Output only after parity is confirmed.  

- Append: <!-- SEGMENTVERIFIEDBY_AI -->

UI Requirements:

- Pause after each rewrite for user approval.  

- Show diff view: original vs rewritten.  

- Ensure rewritten segment matches original length & breadth.  

- Allow user to re-edit before approval.

---

3. FORMATTING RULES

- Output strictly in <p> paragraph blocks.  

- Forbidden: page numbers, headers, footers, lists, bold summaries, filler words.  

- No preamble — narrative begins immediately.  

- Must resemble a clean novel manuscript.

---

4. PATCH MODE

[PATCH_PARAGRAPH] Behavior:

- Fix ONLY the specified paragraph(s).  

- Blend seamlessly with surrounding prose.  

- Maintain full parity.

---

5. MISSING DETAIL RESTORATION

[INCORPORATEMISSINGPIECES] Behavior:

- Deep-scan the PDF segment.  

- Restore omitted details.  

- Re-run parity check.

---

6. FINAL DOCUMENT COMPILATION

[COMPILEFINALDOCX] Behavior:

- Collect all segments marked with <!-- SEGMENTVERIFIEDBY_AI -->.  

- Concatenate into a continuous narrative.  

- Preserve paragraph structure.  

- Generate downloadable DOCX.  

- Toggle: strip headings/page numbers ON/OFF.  

- Preserve original book cover image.  

- Allow export as PDF.  

- Allow user to re-upload a new cover image without reprocessing segments.

---

7. AI PROVIDER MANAGEMENT & FALLBACK (Gemini, OpenRouter, Cloudflare, Groq, Open‑Source)

AI Keys & Credits Menu

- Header menu: AI Keys & Credits.  

- User can paste:  

  - Gemini API key  

  - OpenRouter API key  

  - Cloudflare Workers AI credentials (accountId:apiToken)  

  - Groq API key  

- Keys stored locally in browser only.  

- User keys override project keys to avoid burning Lovable credits.  

- Show:  

  - OpenRouter balance & usage  

  - Gemini key validity  

  - Cloudflare key status  

  - Groq key validity & usage  

  - Lovable key status  

  - Per-provider rewrite counts & word totals  

  - Reset button

API Key Validation

- Validate Gemini, OpenRouter, Cloudflare, and Groq API keys.  

- Show connectivity success/failure in UI.

AI Provider Dropdown

User can select:

- Gemini  

- OpenRouter  

- Cloudflare Workers AI  

- Groq  

- Open‑source fallback

AI Fallback Chain

If credits run out or a provider fails:

1. User’s Gemini key  

2. User’s OpenRouter key  

3. User’s Cloudflare Workers AI  

4. User’s Groq key  

5. Project Gemini key  

6. Project OpenRouter key  

7. Project Cloudflare Workers AI  

8. Project Groq key  

9. Free/open‑source AI provider

Must switch seamlessly without interrupting rewrite flow.

Error Handling

If Gemini returns:

`

Error: Gemini direct API failed [404]: {

 "error": {

   "code": 404,

   "message": "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use a newer model for the latest features and improvements.",

   "status": "NOT_FOUND"

 }

}

`

→ Automatically switch to next provider in fallback chain (including Groq).

---

8. PERFORMANCE REQUIREMENTS

- Rewrite must run as fast as possible.  

- All plot points, dialogue, emotional beats, and details must be preserved.  

- Output must be a professional novel rewrite.  

- Must work seamlessly with:  

  - Open-source models  

  - Paid models  

  - Free fallback models  

  - Groq models

---

9. MOBILE UI REQUIREMENTS

- Full interface must support vertical phone view.  

- Diff viewer, segment navigator, rewrite buttons, and credit monitor must be mobile-friendly.

---

10. EXPORT OPTIONS

- Export as DOCX or PDF.  

- Keep original cover image intact.  

- Allow replacing cover image without reprocessing segments.

---

11. OPENROUTER CONFIG

- Base URL:  

  https://openrouter.ai/api/v1  

- Use user’s OpenRouter API key when provided.

---

12. GROQ CONFIG

- Accept Groq API key in AI Keys & Credits menu.  

- Use Groq for rewriting when selected or during fallback.  

- Validate Groq key format and connectivity.  

- Display Groq usage and credit status.  

- Route rewrite requests through Groq when chosen.

---

13. GLOBAL RULE

All rewritten segments must preserve every plot point, emotional beat, and detail from the original PDF.  

No censorship. No summarization. No omissions.  

Novel-quality prose only.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://novel-rebuilder-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3cbf7cc0-e167-4ec2-bc2b-f5b62bdfbfdb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
