export type Candidate = {
  name: string;
  quantity: string;
  price: string;
  unit: string;
};
export function parseInvoiceText(text: string): Candidate[] {
  const rows: Candidate[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/toplam|kdv|vergi|iban|iskonto|tutarı|ara toplam/i.test(line)) continue;
    const match = line.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|lt|l|adet|ad|g|gr)\s+(\d[\d.,]*)(?:\s|$)/i,
    );
    if (match)
      rows.push({
        name: match[1].replace(/^\d+[.)]?\s+/, ""),
        quantity: match[2],
        unit: match[3].toLowerCase(),
        price: match[4],
      });
  }
  return rows;
}
export function parseDecimal(input: string): number {
  const s = input.trim().replace(/\s|₺/g, "");
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  return Number(normalized);
}
export async function readDocument(
  file: File,
  onProgress: (v: string) => void,
): Promise<string> {
  const pdf = file.type === "application/pdf";
  let worker:
    | Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>
    | undefined;
  async function recognize(image: File | HTMLCanvasElement) {
    worker ??= await (
      await import("tesseract.js")
    ).createWorker("tur+eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      gzip: false,
      logger: (m) => {
        if (m.status === "recognizing text")
          onProgress(`Okunuyor · %${Math.round(m.progress * 100)}`);
      },
    });
    return (await worker.recognize(image)).data.text;
  }
  try {
    if (!pdf) {
      const image = await createImageBitmap(file);
      const pixels = image.width * image.height;
      image.close();
      if (pixels > 16_000_000)
        throw new Error("Görsel 16 megapikselden küçük olmalı.");
      return await recognize(file);
    }
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    try {
      const doc=await task.promise;
      if (doc.numPages > 20)
        throw new Error("Tek belgede en fazla 20 sayfa destekleniyor.");
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        onProgress(`Sayfa ${i} / ${doc.numPages}`);
        const p = await doc.getPage(i);
        const content = await p.getTextContent();
        let text = "";
        let lastY: number | undefined;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5];
          if (lastY !== undefined && Math.abs(y - lastY) > 3) text += "\n";
          text += item.str + " ";
          lastY = y;
          if (item.hasEOL) text += "\n";
        }
        if (text.trim().length < 30) {
          const base = p.getViewport({ scale: 1 });
          const viewport = p.getViewport({
            scale: Math.min(2, 2000 / Math.max(base.width, base.height)),
          });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await p.render({ canvas, viewport }).promise;
          text = await recognize(canvas);
        }
        pages.push(text);
      }
      return pages.join("\n");
    } finally {
      await task.destroy();
    }
  } finally {
    await worker?.terminate();
  }
}
