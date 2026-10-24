// Build the capture harness outside the published site. No application files are changed.
const fs = require("node:fs");
const path = require("node:path");
const [source, modules, out] = process.argv
  .slice(2)
  .map((p) => path.resolve(p));
if (!source || !modules || !out)
  throw new Error(
    "Pass application root, isolated node_modules and output directory",
  );
const { build } = require(path.join(modules, "esbuild"));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await build({
    entryPoints: [path.join(__dirname, "entry.tsx")],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: path.join(out, "entry.js"),
    jsx: "automatic",
    loader: { ".png": "dataurl" },
    nodePaths: [modules],
    alias: {
      "@app": path.join(source, "src/renderer"),
      "@shared": path.join(source, "src/shared"),
    },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await build({
    entryPoints: [path.join(source, "src/main/mobile/page.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(out, "mobile.cjs"),
  });
  fs.copyFileSync(
    path.join(source, "src/main/mobile/terminal.css"),
    path.join(out, "terminal.css"),
  );
  const { mobilePage } = require(path.join(out, "mobile.cjs"));
  fs.writeFileSync(
    path.join(out, "phone.html"),
    mobilePage("МАСТЕР · ИНСТРУМЕНТЫ"),
  );
  const css = fs
    .readFileSync(path.join(source, "src/renderer/styles/tokens.css"), "utf8")
    .replace(
      "@import 'tailwindcss';",
      `@import '${path.join(modules, "tailwindcss")}';\n@source '${path.join(source, "src/renderer")}';\n@source '${__dirname}';`,
    );
  fs.writeFileSync(path.join(out, "input.css"), css);
  fs.writeFileSync(
    path.join(out, "index.html"),
    '<html lang="ru"><head><meta charset="utf-8"><link rel="stylesheet" href="out.css"></head><body><div id="root"></div><script src="entry.js"></script></body></html>',
  );
  fs.cpSync(
    path.join(__dirname, "../../img/demo/products"),
    path.join(out, "products"),
    { recursive: true },
  );
  const fixture = await import(path.join(__dirname, "fixture.mjs"));
  fs.writeFileSync(
    path.join(out, "fixture.json"),
    JSON.stringify({
      catalog: fixture.catalog,
      ledger: fixture.ledger,
      today: fixture.today,
      daily: fixture.daily,
      draft: fixture.draft,
      mobileDraft: fixture.mobileDraft,
      phoneSummary: fixture.phoneSummary(),
      now: fixture.NOW,
    }),
  );
})();
