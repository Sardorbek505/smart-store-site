import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const root = new URL("../", import.meta.url);
const pages = [
  "index.html",
  "privacy.html",
  "404.html",
  "demo/index.html",
  "programma-dlya-magazina-instrumentov/index.html",
];

async function fixture(ending, action) {
  const dir = await mkdtemp(join(tmpdir(), "smart-store-csp-"));
  try {
    for (const name of ["tools/sync-csp.mjs", ...pages]) {
      const file = join(dir, name);
      await mkdir(dirname(file), { recursive: true });
      const source = await readFile(new URL(name, root), "utf8");
      await writeFile(
        file,
        source.replace(/\r\n?/g, "\n").replace(/\n/g, ending),
      );
    }
    await action(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("CSP verification accepts browser-equivalent LF, CRLF and CR HTML without rewriting files", async () => {
  for (const ending of ["\n", "\r\n", "\r"])
    await fixture(ending, async (dir) => {
      const before = await Promise.all(
        pages.map((name) => readFile(join(dir, name))),
      );
      execFileSync(process.execPath, ["tools/sync-csp.mjs", "--check"], {
        cwd: dir,
      });
      for (let index = 0; index < pages.length; index++)
        assert.deepEqual(
          await readFile(join(dir, pages[index])),
          before[index],
        );
    });
});

test("normalizing line endings does not accept an altered inline script", async () => {
  await fixture("\r\n", async (dir) => {
    const file = join(dir, "index.html");
    const source = await readFile(file, "utf8");
    await writeFile(
      file,
      source.replace(
        "</head>",
        "<script>window.changed=true;</script>\r\n</head>",
      ),
    );
    const result = spawnSync(
      process.execPath,
      ["tools/sync-csp.mjs", "--check"],
      { cwd: dir, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Stale CSP in index\.html/);
    execFileSync(process.execPath, ["tools/sync-csp.mjs"], { cwd: dir });
    execFileSync(process.execPath, ["tools/sync-csp.mjs", "--check"], {
      cwd: dir,
    });
    const built = await readFile(file, "utf8");
    execFileSync(process.execPath, ["tools/sync-csp.mjs"], { cwd: dir });
    assert.equal(await readFile(file, "utf8"), built);
    assert.ok(!built.includes("\r"));
  });
});
