/** Browser-only PDF ingestion: text extraction plus a cover render of page 1. */

export type IngestResult = { pages: string[]; cover: string | null };

export async function ingestPdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<IngestResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5] as number;
      if (lastY !== null && Math.abs(y - lastY) > 2) text += "\n";
      text += item.str;
      if (item.hasEOL) text += "\n";
      lastY = y;
    }
    pages.push(text);
    onProgress?.(i, doc.numPages);
  }

  let cover: string | null = null;
  try {
    const first = await doc.getPage(1);
    const viewport = first.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (context) {
      await first.render({ canvas, canvasContext: context, viewport }).promise;
      cover = canvas.toDataURL("image/jpeg", 0.85);
    }
  } catch {
    cover = null;
  }

  return { pages, cover };
}
