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
const bundles = [
  {
    page: "index.html",
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
    page: "privacy.html",
    name: "privacy",
    sources: ["styles.css", "buttons.css"],
  },
];
const expected = new Set();
await mkdir(new URL("assets/", root), { recursive: true });
for (const { page, name, sources } of bundles) {
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
  // Keep the last published name too: a cached HTML document can still need it.
  retained[name] = [...new Set([file, ...(previous[name] || [])])].slice(0, 2);
  for (const sheet of retained[name]) expected.add(sheet);
  const url = new URL(`assets/${file}`, root);
  const htmlUrl = new URL(page, root);
  const html = await readFile(htmlUrl, "utf8");
  const marker = /<!-- styles:start -->[\s\S]*?<!-- styles:end -->/;
  if (!marker.test(html)) throw new Error(`Missing style markers in ${page}`);
  const updated = html.replace(
    marker,
    `<!-- styles:start -->\n    <link rel="stylesheet" href="${posix.relative(posix.dirname(page), `assets/${file}`)}" />\n    <!-- styles:end -->`,
  );
  if (check) {
    if (html !== updated || (await readFile(url, "utf8")) !== code)
      throw new Error(`Stale styles for ${page}; run npm run build:styles`);
  } else {
    await writeFile(url, code);
    await writeFile(htmlUrl, updated);
  }
  console.log(
    `${page}: ${sources.length} sources → ${file} (${Buffer.byteLength(code)} bytes)`,
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
