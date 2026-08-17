/* Translation consistency check.
 *
 *   node tools/check-i18n.mjs
 *
 * Catches the three ways a dictionary-based UI silently breaks:
 *   1. a data-i18n key in the markup that no dictionary defines  -> raw key on screen
 *   2. a key present in English but missing in another language  -> English leaks through
 *   3. a {placeholder} that does not survive translation         -> "{n} reports" literal
 *
 * Also reports keys defined but never used, so the dictionary does not rot.
 * Exits non-zero on a real problem, so it can gate a deploy.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SKIP_DIRS = new Set(['vendor', 'node_modules', 'assets', 'tools', '.git']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* ---- Load the dictionary by evaluating dict.js in a stub window ---------- */
const dictSource = readFileSync(join(ROOT, 'i18n', 'dict.js'), 'utf8');
const fakeWindow = {};
new Function('window', dictSource)(fakeWindow);
const dicts = fakeWindow.STEPBY_DICT;
const languages = Object.keys(dicts);
const base = 'en';

/* ---- Collect keys referenced by the source ------------------------------ */
const used = new Map(); // key -> [files]
const files = walk(ROOT).filter((f) => /\.(html|js)$/.test(f) && !f.endsWith('dict.js'));

const PATTERNS = [
  /data-i18n\s*=\s*["']([\w.]+)["']/g,
  /data-i18n-attr\s*=\s*["']([^"']+)["']/g,
  /\bt\(\s*['"]([\w.]+)['"]/g,
  /tagLabel|['"](tag\.[\w]+)['"]/g
];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  for (const [, key] of text.matchAll(PATTERNS[0])) add(key, rel);
  for (const [, spec] of text.matchAll(PATTERNS[1])) {
    for (const pair of spec.split(',')) {
      const key = pair.split(':')[1];
      if (key) add(key.trim(), rel);
    }
  }
  for (const [, key] of text.matchAll(PATTERNS[2])) add(key, rel);
}

function add(key, file) {
  /* t('tag.' + code) is a computed key, not a literal one — the prefix ends
     with a dot and there is nothing to look up. */
  if (!key || key.endsWith('.')) return;
  if (!used.has(key)) used.set(key, []);
  used.get(key).push(file);
}

/* ---- Checks -------------------------------------------------------------- */
const errors = [];
const warnings = [];

for (const [key, where] of used) {
  if (!(key in dicts[base])) {
    errors.push(`missing key "${key}" (used in ${[...new Set(where)].join(', ')})`);
  }
}

for (const lang of languages) {
  if (lang === base) continue;
  for (const key of Object.keys(dicts[base])) {
    if (!(key in dicts[lang])) errors.push(`[${lang}] not translated: "${key}"`);
  }
  for (const key of Object.keys(dicts[lang])) {
    if (!(key in dicts[base])) warnings.push(`[${lang}] extra key not in ${base}: "${key}"`);
  }
}

const placeholder = /\{(\w+)\}/g;
for (const key of Object.keys(dicts[base])) {
  const expected = new Set([...dicts[base][key].matchAll(placeholder)].map((m) => m[1]));
  for (const lang of languages) {
    if (lang === base || !(key in dicts[lang])) continue;
    const actual = new Set([...dicts[lang][key].matchAll(placeholder)].map((m) => m[1]));
    for (const name of expected) {
      if (!actual.has(name)) errors.push(`[${lang}] "${key}" lost placeholder {${name}}`);
    }
    for (const name of actual) {
      if (!expected.has(name)) errors.push(`[${lang}] "${key}" has unexpected placeholder {${name}}`);
    }
  }
}

/* Unused-key detection needs a wider net than the patterns above: keys are
   also referenced indirectly (a NAV table entry, a ternary inside t(), an
   ApiError messageKey). A plain search for the quoted literal catches those.
   tag.* keys are resolved from backend data and are never quoted in source. */
const haystack = files.map((f) => readFileSync(f, 'utf8')).join('\n');
for (const key of Object.keys(dicts[base])) {
  if (key.startsWith('tag.')) continue;
  if (used.has(key)) continue;
  if (haystack.includes(`'${key}'`) || haystack.includes(`"${key}"`)) continue;
  warnings.push(`unused key: "${key}"`);
}

/* ---- Report -------------------------------------------------------------- */
const total = Object.keys(dicts[base]).length;
console.log(`checked ${total} keys x ${languages.length} languages across ${files.length} files`);
warnings.forEach((w) => console.log(`  warn  ${w}`));
errors.forEach((e) => console.log(`  ERROR ${e}`));

if (errors.length) {
  console.log(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log(`\nok${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
