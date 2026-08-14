import {
  AlignmentType,
  Document,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { parseProse } from "./segments";
import type { Project } from "./project-store";

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** All verified segments, concatenated into one continuous narrative. */
export function compileParagraphs(project: Project): string[] {
  return project.segments
    .filter((segment) => segment.status === "verified")
    .flatMap((segment) => parseProse(segment.rewritten));
}

export async function buildDocx(project: Project, paragraphs: string[]): Promise<Blob> {
  const children: Paragraph[] = [];

  if (project.cover) {
    try {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: "jpg",
              data: dataUrlToBytes(project.cover),
              transformation: { width: 468, height: 648 },
              altText: { title: "Cover", description: "Book cover", name: "Cover" },
            }),
          ],
        }),
      );
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } catch {
      /* cover is optional */
    }
  }

  for (const text of paragraphs) {
    children.push(
      new Paragraph({
        spacing: { after: 160, line: 340 },
        indent: { firstLine: 360 },
        children: [new TextRun({ text, font: "Georgia", size: 24 })],
      }),
    );
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Georgia", size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
