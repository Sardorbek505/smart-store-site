// Keep the seamless loop in HTML so the first frame never waits for JavaScript.
import { readFile, writeFile } from "node:fs/promises";
const file = new URL("../index.html", import.meta.url);
const html = await readFile(file, "utf8");
const start = html.indexOf('<div class="gallery-stage">');
const end = html.indexOf("<!-- hero-ribbon:end -->", start);
if (start < 0 || end < 0) throw new Error("Gallery markup not found");
const anchors = html
  .slice(start, end)
  .match(/<a\b[^>]*data-gallery-card[\s\S]*?<\/a\s*>/g);
if (anchors?.length !== 5)
  throw new Error("Expected five original gallery cards");
const cards = anchors.map((anchor) =>
  anchor.replace(/^<a\b[^>]*>/, (tag) =>
    tag
      .replace(/\sstyle="[^"]*"/g, "")
      .replace(/\stabindex="[^"]*"/g, "")
      .replace(/\shidden(?:="[^"]*")?/g, ""),
  ),
);
const copies = cards.map((card, i) =>
  card.replace(
    "data-gallery-card",
    `data-ribbon-copy data-source-index="${i}" tabindex="-1"`,
  ),
);
const gallery = `<div class="gallery-stage">
  <svg class="ribbon-defs" width="0" height="0" aria-hidden="true"><defs><clipPath id="hero-ribbon-clip" clipPathUnits="objectBoundingBox"><path d="M0 .035 C.16 .15 .32 .24 .5 .24 C.68 .24 .84 .15 1 .035 L1 .965 C.84 .85 .68 .76 .5 .76 C.32 .76 .16 .85 0 .965 Z"/></clipPath></defs></svg>
  <div class="ribbon-window">
    <div class="ribbon-track" data-ribbon-track>
      <div class="ribbon-set" data-ribbon-set="before" aria-hidden="true">${copies.join("\n")}</div>
      <div class="ribbon-set" data-ribbon-set="main">${cards.join("\n")}</div>
      <div class="ribbon-set" data-ribbon-set="after" aria-hidden="true">${copies.join("\n")}</div>
    </div>
  </div>
</div>\n`;
const normalize = (s) => s.replace(/\s+/g, "").replace(/\/>/g, ">");
if (process.argv.includes("--check")) {
  if (normalize(html.slice(start, end)) !== normalize(gallery))
    throw new Error("Initial ribbon is stale; run tools/sync-hero-layout.mjs");
  console.log("Initial hero layout and loop copies are current.");
} else {
  await writeFile(file, html.slice(0, start) + gallery + html.slice(end));
}
