// Materialize the first gallery frame so first paint never waits for JavaScript.
import { readFile, writeFile } from "node:fs/promises";
import { initialPosition, ribbonLayout } from "../scripts/ribbon-layout.js";
const file = new URL("../index.html", import.meta.url);
let html = await readFile(file, "utf8");
const start = html.indexOf('<div class="gallery-stage">');
const end = html.indexOf('<div class="gallery-bottom wrap">', start);
if (start < 0 || end < 0) throw new Error("Gallery markup not found");
const anchors = html
  .slice(start, end)
  .match(/<a\b[^>]*data-gallery-card[\s\S]*?<\/a\s*>/g);
if (anchors?.length !== 5) throw new Error("Expected five gallery cards");
const layout = ribbonLayout(anchors.length, initialPosition);
if (process.argv.includes("--check")) {
  for (const [index, anchor] of anchors.entries()) {
    const tag = anchor.match(/^<a\b[^>]*>/)[0];
    const item = layout[index];
    const hidden = /\shidden(?:\s|>)/.test(tag);
    const actual = (tag.match(/\sstyle="([^"]*)"/)?.[1] || "").replace(
      /\s/g,
      "",
    );
    const expected = (item.style || "").replace(/\s/g, "");
    if (hidden !== item.hidden || actual !== expected)
      throw new Error(
        `Initial card ${index + 1} is stale; run tools/sync-hero-layout.mjs`,
      );
  }
  console.log("Initial hero layout is current.");
  process.exit(0);
}
const cards = anchors.map((anchor, index) => {
  const match = anchor.match(/^<a\b[^>]*>/);
  let tag = match[0]
    .replace(/\sstyle="[^"]*"/g, "")
    .replace(/\stabindex="[^"]*"/g, "")
    .replace(/\shidden(?:="[^"]*")?/g, "");
  const item = layout[index];
  const attrs = item.hidden
    ? " hidden"
    : ` tabindex="${item.tabIndex}" style="${item.style}"`;
  tag = tag.replace(/>$/, attrs + ">");
  return tag + anchor.slice(match[0].length);
});
html =
  html.slice(0, start) +
  `<div class="gallery-stage"><div class="ribbon-track" data-ribbon-track data-position="${initialPosition}">${cards.join("\n")}</div></div>\n` +
  html.slice(end);
await writeFile(file, html);
