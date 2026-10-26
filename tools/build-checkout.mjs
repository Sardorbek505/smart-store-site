// The landing loads this self-hosted 3D bundle only when its story is visible.
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = new URL("../", import.meta.url),
  check = process.argv.includes("--check");
const manifestUrl = new URL("assets/checkout-script.json", root);
const previous = await readFile(manifestUrl, "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT" && !check) return [];
    throw error;
  });
const result = await build({
  entryPoints: [fileURLToPath(new URL("scripts/checkout-scene.js", root))],
  bundle: true,
  write: false,
  minify: true,
  format: "esm",
  platform: "browser",
  target: ["safari16.4", "chrome110", "firefox115"],
  legalComments: "none",
});
if (result.warnings.length) throw new Error(JSON.stringify(result.warnings));
const code =
  "/*! Three.js r180 (MIT). License: ../third-party/three-LICENSE.txt */\n" +
  result.outputFiles[0].text;
const hash = createHash("sha256").update(code).digest("hex").slice(0, 12),
  file = `checkout3d.${hash}.js`;
const retained = [...new Set([file, ...previous])].slice(0, 2);
const loaderUrl = new URL("scripts/checkout.js", root),
  loader = await readFile(loaderUrl, "utf8");
const marker = /\/\/ checkout-bundle:start[\s\S]*?\/\/ checkout-bundle:end/;
const updated = loader.replace(
  marker,
  `// checkout-bundle:start\nconst loadScene = () => import("../assets/${file}");\n// checkout-bundle:end`,
);
if (updated === loader && !marker.test(loader))
  throw new Error("Missing checkout bundle marker");
const manifest = JSON.stringify(retained, null, 2) + "\n";
if (check) {
  if (
    loader !== updated ||
    (await readFile(new URL(`assets/${file}`, root), "utf8")) !== code ||
    (await readFile(manifestUrl, "utf8")) !== manifest
  )
    throw new Error("Stale 3D bundle; run npm run build:checkout");
  for (const name of retained) await readFile(new URL(`assets/${name}`, root));
} else {
  await writeFile(new URL(`assets/${file}`, root), code);
  await writeFile(loaderUrl, updated);
  await writeFile(manifestUrl, manifest);
}
for (const name of await readdir(new URL("assets/", root))) {
  if (!/^checkout3d\.[a-f0-9]{12}\.js$/.test(name) || retained.includes(name))
    continue;
  if (check) throw new Error(`Unused 3D bundle: ${name}`);
  await unlink(new URL(`assets/${name}`, root));
}
console.log(`Checkout: ${file} (${Buffer.byteLength(code)} bytes)`);
