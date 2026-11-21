import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = new URL('../', import.meta.url);
const check = process.argv.includes('--check');
const result = await build({
  entryPoints: [fileURLToPath(new URL('tools/glisse/navigation.ts', root))],
  bundle: true, write: false, minify: true, format: 'esm', platform: 'browser',
  target: ['safari16.4','chrome110','firefox115'], legalComments: 'none',
});
if (result.warnings.length) throw Error(JSON.stringify(result.warnings));
const code = '/*! Glisse (MIT), Kelvin Zhang. License: ../third-party/Glisse.LICENSE */\n' + result.outputFiles[0].text;
const hash = createHash('sha256').update(code).digest('hex').slice(0,12);
const file = `glisse-nav.${hash}.js`;
const loader = `// Apply the optional Glisse optics after first paint; native CSS is immediate.\nexport function init() {\n  const start = () => { void import('../assets/${file}').then(m => m.init()).catch(() => {}); };\n  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 700 });\n  else setTimeout(start, 150);\n}\n`;
const files = [['assets/'+file,code],['scripts/liquid-glass.js',loader]];
for (const [path,text] of files) {
  if (check) { if (await readFile(new URL(path,root),'utf8') !== text) throw Error('Stale glass bundle: '+path); }
  else await writeFile(new URL(path,root),text);
}
// Keep immutable published bundles for cached loaders.
console.log(`Glisse navigation: ${file} (${Buffer.byteLength(code)} bytes)`);
