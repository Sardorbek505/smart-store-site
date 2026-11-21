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
const loader = `// Load optical maps only when the navigation first becomes visible.\nexport function init() {\n  const header = document.querySelector('.landing-page .top');\n  if (!header) return;\n  const open = () => {\n    if (header.inert || !document.body.classList.contains('has-scrolled')) return;\n    observer.disconnect();\n    void import('../assets/${file}').then(m => m.init()).catch(() => {});\n  };\n  const observer = new MutationObserver(open);\n  observer.observe(header, { attributes: true, attributeFilter: ['inert'] });\n  open();\n}\n`;
const files = [['assets/'+file,code],['scripts/liquid-glass.js',loader]];
for (const [path,text] of files) {
  if (check) { if (await readFile(new URL(path,root),'utf8') !== text) throw Error('Stale glass bundle: '+path); }
  else await writeFile(new URL(path,root),text);
}
// Keep immutable published bundles for cached loaders.
console.log(`Glisse navigation: ${file} (${Buffer.byteLength(code)} bytes)`);
