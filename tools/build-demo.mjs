// Separate, content-addressed bundle: the landing never imports the demo engine.
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const manifestUrl = new URL("assets/demo-script.json", root);
const previous = await readFile(manifestUrl, "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT" && !check) return [];
    throw error;
  });
const result = await build({
  entryPoints: [fileURLToPath(new URL("demo/app.js", root))],
  bundle: true,
  write: false,
  minify: true,
  format: "esm",
  platform: "browser",
  target: ["safari16.4", "chrome110", "firefox115"],
  legalComments: "none",
});
if (result.warnings.length) throw new Error(JSON.stringify(result.warnings));
const code = result.outputFiles[0].text;
const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
const file = `demo.${hash}.js`;
const retained = [...new Set([file, ...previous])].slice(0, 2);
const htmlUrl = new URL("demo/index.html", root);
const html = await readFile(htmlUrl, "utf8");
const marker = /<!-- demo-script:start -->[\s\S]*?<!-- demo-script:end -->/;
if (!marker.test(html)) throw new Error("Missing demo script markers");
const updated = html.replace(
  marker,
  `<!-- demo-script:start -->
    <script
      type="module"
      src="../assets/${file}"
      onerror="
        document.getElementById('boot-label').textContent =
          'Демо не загрузилось. Обновите страницу или вернитесь на сайт.'
      "
    ></script>
    <!-- demo-script:end -->`,
);
const manifest = `${JSON.stringify(retained, null, 2)}\n`;
if (check) {
  if (
    updated !== html ||
    (await readFile(new URL(`assets/${file}`, root), "utf8")) !== code ||
    (await readFile(manifestUrl, "utf8")) !== manifest
  )
    throw new Error("Stale demo bundle; run npm run build:demo");
  for (const name of retained) await readFile(new URL(`assets/${name}`, root));
} else {
  await writeFile(new URL(`assets/${file}`, root), code);
  await writeFile(htmlUrl, updated);
  await writeFile(manifestUrl, manifest);
}
for (const name of await readdir(new URL("assets/", root))) {
  if (!/^demo\.[a-f0-9]{12}\.js$/.test(name) || retained.includes(name))
    continue;
  if (check) throw new Error(`Unused demo bundle: ${name}`);
  await unlink(new URL(`assets/${name}`, root));
}
console.log(`Demo: ${file} (${Buffer.byteLength(code)} bytes)`);
