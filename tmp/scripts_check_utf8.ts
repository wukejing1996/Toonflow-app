// UTF-8/Mojibake quick check: scan for common bad markers.
import fs from 'fs';
import path from 'path';

// Use ASCII-only escapes to avoid self-flagging
const patterns: RegExp[] = [
  /\uFFFD/u,           // replacement character
  /[\u00C2\u00C3]/u,  // U+00C2, U+00C3 (common mojibake hints)
];

const exts = new Set(['.ts','.tsx','.js','.jsx','.json','.md','.yml','.yaml','.html','.css']);
const ignoreDirs = new Set(['node_modules','.git','dist','out','data']);
const ignoreRelFiles = new Set(['scripts/check-utf8.ts']);

const bad = new Set<string>();
function walk(dir: string) {
  for (const name of fs.readdirSync(dir)) {
    if (ignoreDirs.has(name)) continue;
    const p = path.join(dir, name);
    const s = fs.statSync(p);
    if (s.isDirectory()) { walk(p); continue; }
    const rel = path.relative(process.cwd(), p).replace(/\\/g,'/');
    if (ignoreRelFiles.has(rel)) continue;
    const ext = path.extname(name).toLowerCase();
    if (!exts.has(ext)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    if (patterns.some((re) => re.test(txt))) bad.add(rel);
  }
}
walk(process.cwd());

if (bad.size) {
  console.error('\nFound potential mojibake files (please fix):');
  for (const f of bad) console.error(' -', f);
  process.exitCode = 2;
} else {
  console.log('UTF-8 check passed.');
}
