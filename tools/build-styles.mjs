// Sources stay readable; GitHub Pages serves one complete, content-addressed sheet.
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { transform } from "esbuild";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const manifestUrl = new URL("assets/styles.json", root);
const previous = await readFile(manifestUrl, "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT" && !check) return {};
    throw error;
  });
const retained = {};
const sitePages = JSON.parse(
  await readFile(new URL("tools/pages.json", root), "utf8"),
);
const bundles = [
  {
    pages: sitePages.filter((p) => p.styles === "site").map((p) => p.file),
    name: "site",
    sources: [
      "styles.css",
      "cinema.css",
      "buttons.css",
      "screens.css",
      "components.css",
      "story.css",
      "checkout-3d.css",
      "micro-scenes.css",
      "trial.css",
      "journey.css",
      "glass.css",
    ],
  },
  {
    pages: sitePages.filter((p) => p.styles === "privacy").map((p) => p.file),
    name: "privacy",
    sources: ["styles.css", "buttons.css"],
  },
];
const expected = new Set();
await mkdir(new URL("assets/", root), { recursive: true });
for (const { pages, name, sources } of bundles) {
  const input = (
    await Promise.all(
      sources.map((file) => readFile(new URL(file, root), "utf8")),
    )
  ).join("\n");
  const { code, warnings } = await transform(input, {
    loader: "css",
    minify: true,
    target: ["safari16.4", "chrome110", "firefox115"],
    legalComments: "inline",
  });
  if (warnings.length) throw new Error(JSON.stringify(warnings));
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
  const file = `${name}.${hash}.css`;
  // Cached HTML can reference older releases; keep both previously published sheets.
  retained[name] = [...new Set([file, ...(previous[name] || [])])].slice(0, 3);
  for (const sheet of retained[name]) expected.add(sheet);
  const url = new URL(`assets/${file}`, root);
  if (check && (await readFile(url, "utf8")) !== code)
    throw new Error(`Stale ${name} styles; run npm run build:styles`);
  if (!check) await writeFile(url, code);
  for (const page of pages) {
    const htmlUrl = new URL(page, root);
    const html = await readFile(htmlUrl, "utf8");
    const marker = /<!-- styles:start -->[\s\S]*?<!-- styles:end -->/;
    if (!marker.test(html)) throw new Error(`Missing style markers in ${page}`);
    // 404.html is served at arbitrary missing paths; its assets are root-relative.
    const href =
      page === "404.html"
        ? `/assets/${file}`
        : posix.relative(posix.dirname(page), `assets/${file}`);
    const updated = html.replace(
      marker,
      `<!-- styles:start -->\n    <link rel="stylesheet" href="${href}" />\n    <!-- styles:end -->`,
    );
    if (check && html !== updated)
      throw new Error(`Stale styles for ${page}; run npm run build:styles`);
    if (!check) await writeFile(htmlUrl, updated);
  }
  console.log(
    `${pages.join(", ")}: ${sources.length} sources → ${file} (${Buffer.byteLength(code)} bytes)`,
  );
}
const manifest = `${JSON.stringify(retained, null, 2)}\n`;
if (check) {
  if ((await readFile(manifestUrl, "utf8")) !== manifest)
    throw new Error("Stale style manifest; run npm run build:styles");
  for (const file of expected) await readFile(new URL(`assets/${file}`, root));
} else await writeFile(manifestUrl, manifest);
for (const file of await readdir(new URL("assets/", root))) {
  if (
    !/^(site|privacy|demo)\.[a-f0-9]{12}\.css$/.test(file) ||
    expected.has(file)
  )
    continue;
  if (check) throw new Error(`Unused generated sheet: ${file}`);
  await unlink(new URL(`assets/${file}`, root));
}
