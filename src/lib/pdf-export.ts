import { jsPDF } from "jspdf";
import type { Project } from "./project-store";

function coverFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" | null {
  const match = /^data:image\/(png|jpg|jpeg|webp);base64,/i.exec(dataUrl);
  if (!match) return null;
  const kind = (match[1] ?? "").toLowerCase();
  if (kind === "png") return "PNG";
  if (kind === "webp") return "WEBP";
  return "JPEG";
}

export async function buildPdf(project: Project, paragraphs: string[]): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const lineHeight = 20;
  const maxWidth = pageWidth - margin * 2;

  if (project.cover) {
    const format = coverFormat(project.cover);
    if (format) {
      try {
        doc.addImage(project.cover, format, pageWidth / 2 - 120, margin, 240, 330, undefined, "FAST");
        doc.addPage();
      } catch {
        // Ignore invalid cover data and continue.
      }
    }
  }

  let y = margin;

  doc.setTextColor(28, 28, 28);
  doc.setFont("times", "normal");
  doc.setFontSize(12);


  for (const paragraph of paragraphs) {
    const cleaned = paragraph.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    const lines = doc.splitTextToSize(cleaned, maxWidth);
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += lineHeight * 0.6;
  }

  return doc.output("blob");
}
