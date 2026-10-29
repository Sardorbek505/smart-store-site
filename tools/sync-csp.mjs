// GitHub Pages cannot add response headers. Meta CSP protects each HTML document
// with hashes for its exact inline scripts; frame-ancestors needs the hosting layer.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const pages = JSON.parse(
  await readFile(new URL("tools/pages.json", root), "utf8"),
);
for (const { file: name } of pages) {
  const staticHelp = name.startsWith("pomoshch/");
  const path = new URL(name, root);
  // HTML parsing converts CRLF and bare CR to LF before scripts are hashed.
  // Windows checkouts must use the same script text as the browser.
  const source = (await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
  const hashes = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=/i.test(attrs))
    .map(
      ([, , content]) =>
        `'sha256-${createHash("sha256").update(content).digest("base64")}'`,
    );
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    `script-src ${staticHelp ? "" : "'self' "}${hashes.join(" ")}`.trim(),
    staticHelp ? "style-src 'self'" : "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    staticHelp
      ? "connect-src 'none'"
      : "connect-src 'self' https://api.github.com https://connect.metov.store https://zavod.metov.store",
    staticHelp ? "form-action 'none'" : "form-action 'self'",
  ].join("; ");
  const block = `<!-- security:start -->\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <!-- security:end -->`;
  const marker = /<!-- security:start -->[\s\S]*?<!-- security:end -->/;
  const updated = marker.test(source)
    ? source.replace(marker, block)
    : source.replace(/(<meta charset="utf-8"\s*\/>)/, `$1\n    ${block}`);
  if (check && updated !== source)
    throw new Error(`Stale CSP in ${name}; run npm run build:csp`);
  if (!check) await writeFile(path, updated);
  console.log(`${name}: self-hosted scripts, ${hashes.length} inline hash(es)`);
}
