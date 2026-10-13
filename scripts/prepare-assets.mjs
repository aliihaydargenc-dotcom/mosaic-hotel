import {
  mkdir,
  copyFile,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
await mkdir("public/ocr/core", { recursive: true });
await mkdir("public/pdf", { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
for (const name of await readdir("node_modules/tesseract.js-core")) {
  if (name.endsWith(".wasm") || name.endsWith(".wasm.js"))
    await copyFile(
      join("node_modules/tesseract.js-core", name),
      join("public/ocr/core", name),
    );
}
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf/pdf.worker.min.mjs",
);
await mkdir("public/ocr/lang", { recursive: true });
const models = {
  tur: "7393381111e1152420fc4092cb44eef4237580d21b92bf30d7d221aad192c6b7",
  eng: "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
};
for (const [language, expected] of Object.entries(models)) {
  const path = `public/ocr/lang/${language}.traineddata`;
  let data;
  try {
    data = await readFile(path);
  } catch {}
  if (!data || createHash("sha256").update(data).digest("hex") !== expected) {
    const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/${language}.traineddata`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`OCR model download failed: ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(data).digest("hex") !== expected)
      throw new Error(`OCR model checksum mismatch: ${language}`);
    await writeFile(path, data);
  }
}
console.log("Document workers prepared.");
const notices = [];
const direct = JSON.parse(await readFile("package.json", "utf8")).dependencies;
for (const name of [...Object.keys(direct), "tesseract.js-core"]) {
  const dir = `node_modules/${name}`;
  const meta = JSON.parse(await readFile(`${dir}/package.json`, "utf8"));
  notices.push(`\n${name} ${meta.version} (${meta.license})\n`);
  for (const file of await readdir(dir))
    if (/^(license|copying|notice)(\.|$)/i.test(file))
      notices.push(await readFile(`${dir}/${file}`, "utf8"));
}
notices.push(await readFile("docs/research/INVENTREE-LICENSE.txt", "utf8"));
notices.push(
  await readFile(
    "docs/research/dependency-licenses/tessdata-fast-LICENSE",
    "utf8",
  ),
);
await writeFile("public/third-party-notices.txt", notices.join("\n"));
