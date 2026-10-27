import { cp, mkdir, readdir, rm, lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "index.html",
  "privacy.html",
  "404.html",
  "demo/index.html",
  "programma-dlya-magazina-instrumentov/index.html",
  "app.js",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "yandex_3ab61845d04cfe19.html",
  "b7f1bcd1cf3b163793889feb50602152.txt",
];
const FOLDERS = ["scripts", "assets", "img", "third-party"];

// Publish only the public site. Never upload .git, .env, tools, docs or tests.
export async function publicFiles(root = ROOT) {
  const files = [...FILES];
  async function walk(folder) {
    for (const entry of await readdir(join(root, folder), {
      withFileTypes: true,
    })) {
      const path = `${folder}/${entry.name}`;
      if (
        entry.name.startsWith(".") ||
        entry.isSymbolicLink() ||
        path.endsWith(".map")
      )
        throw new Error(`Unexpected public asset: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  for (const folder of FOLDERS) await walk(folder);
  for (const path of files) {
    const info = await lstat(join(root, path));
    if (!info.isFile() || info.size > 25 * 1024 * 1024)
      throw new Error(`Asset exceeds hosting limits: ${path}`);
  }
  return files.sort();
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = await publicFiles();
  const target = join(ROOT, "edge/public");
  await rm(target, { recursive: true, force: true });
  for (const path of files) {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await cp(join(ROOT, path), join(target, path));
  }
  console.log(
    `Edge package: ${files.length} public files. No deployment performed.`,
  );
}
