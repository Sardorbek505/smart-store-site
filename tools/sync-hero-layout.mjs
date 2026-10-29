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
const refractionFilter = (
  id,
  field,
) => `<filter id="${id}" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
  <feImage href="img/${field}" xlink:href="img/${field}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="field"/>
  <feDisplacementMap in="SourceGraphic" in2="field" scale=".162" xChannelSelector="R" yChannelSelector="G" result="warp-r"/>
  <feDisplacementMap in="SourceGraphic" in2="field" scale=".1485" xChannelSelector="R" yChannelSelector="G" result="warp-g"/>
  <feDisplacementMap in="SourceGraphic" in2="field" scale=".135" xChannelSelector="R" yChannelSelector="G" result="warp-b"/>
  <feColorMatrix in="warp-r" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
  <feColorMatrix in="warp-g" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
  <feColorMatrix in="warp-b" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
  <feBlend in="red" in2="green" mode="screen" result="rg"/>
  <feBlend in="rg" in2="blue" mode="screen" result="spectrum"/>
  <feGaussianBlur in="spectrum" stdDeviation=".0072 .0027" result="soft-spectrum"/>
  <feColorMatrix in="field" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="periphery"/>
  <feComposite in="soft-spectrum" in2="periphery" operator="in" result="edge-optics"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="edge-optics"/></feMerge>
</filter>`;
const gallery = `<div class="gallery-stage">
  <svg xmlns:xlink="http://www.w3.org/1999/xlink" class="ribbon-defs" width="0" height="0" aria-hidden="true"><defs><clipPath id="hero-ribbon-clip" clipPathUnits="objectBoundingBox"><path d="M0 .035 C.16 .07 .32 .10 .5 .10 C.68 .10 .84 .07 1 .035 L1 .965 C.84 .93 .68 .90 .5 .90 C.32 .90 .16 .93 0 .965 Z"/></clipPath>
${refractionFilter("hero-refraction", "hero-refraction-field-v82.png")}${refractionFilter("hero-refraction-mobile", "hero-refraction-mobile-v83.png")}</defs></svg>
  <div class="ribbon-window">
    <div class="ribbon-refraction">
    <div class="ribbon-track motion-ready" data-ribbon-track>
      <div class="ribbon-set" data-ribbon-set="before" aria-hidden="true">${copies.join("\n")}</div>
      <div class="ribbon-set" data-ribbon-set="main">${cards.join("\n")}</div>
      <div class="ribbon-set" data-ribbon-set="after" aria-hidden="true">${copies.join("\n")}</div>
    </div>
    </div>
    <svg class="ribbon-rim" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><linearGradient id="ribbon-rim-light"><stop stop-color="#ededf5" stop-opacity=".65"/><stop offset=".4" stop-color="#8aa9ff" stop-opacity=".12"/><stop offset=".65" stop-color="#ededf5" stop-opacity=".25"/><stop offset="1" stop-color="#8aa9ff" stop-opacity=".65"/></linearGradient></defs>
      <path d="M0 35 C160 70 320 100 500 100 C680 100 840 70 1000 35 L1000 965 C840 930 680 900 500 900 C320 900 160 930 0 965 Z" fill="none" stroke="url(#ribbon-rim-light)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </svg>
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
