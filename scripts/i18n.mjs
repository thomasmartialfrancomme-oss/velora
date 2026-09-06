#!/usr/bin/env node
/**
 * The dictionary ledger.
 *
 *   node scripts/i18n.mjs extract            → src/lib/i18n/keys.json, the strings in use
 *   node scripts/i18n.mjs coverage           → how much of that list each language carries
 *   node scripts/i18n.mjs missing fr         → the exact lines still missing from one language
 *
 * Keys are the English source text, so nothing here can ever *break* a page: a
 * missing entry means that string renders in English. The script exists so the
 * gap is visible and countable instead of silent, and so a translator is handed
 * a list rather than a codebase.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DICT_DIR = join(SRC, 'lib/i18n/dictionaries');
const KEYS = join(SRC, 'lib/i18n/keys.json');

/** Props whose value is a label: they reach a component that translates them. */
const LABEL_PROPS = [
  'label', 'title', 'description', 'lede', 'eyebrow', 'hint', 'placeholder',
  'header', 'empty', 'detail', 'meta', 'body', 'subject', 'note', 'caption',
  'confirmLabel', 'cancelLabel', 'submitLabel', 'aria-label',
];

function walk(dir, out = []) {
  const isSep = (full, name) => new RegExp(`(^|[\\\\/])${name}([\\\\/])`).test(full);
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'i18n') continue;
      walk(full, out);
    } else if (!/\.(tsx|jsx|ts)$/.test(full) || isSep(full, 'api')) {
      continue;
    } else if (full.endsWith('.ts') && (!isSep(full, 'lib') || isSep(full, 'i18n'))) {
      // les .ts hors de src/lib sont du typage ou de la config, pas de la copie
      continue;
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Literal arguments of `T("…")` / `T('…')`. */
const CALL = /\bT\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*[,)]/g;
/** `label="…"` on an element: the receiving component translates it at render. */
function propLiterals(source) {
  const found = [];
  for (const prop of LABEL_PROPS) {
    const re = new RegExp(`\\b${prop}="([^"]+)"`, 'g');
    let m;
    while ((m = re.exec(source))) found.push(m[1]);
  }
  return found;
}

/** `{ label: '…' }` — column headers, stat labels, nav entries and filter options. */
const DATA_PROP = /\b(?:label|title|header|hint|meta|body|note|detail|placeholder|description|name|positioning|step)\s*:\s*(['"])((?:\\.|(?!\1).)*)\1/g;

function unquote(value, quote) {
  return quote === '"'
    ? value.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    : value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function extract() {
  const keys = new Set();
  const perFile = new Map();
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8');
    const here = new Set();
    for (const [, quote, body] of source.matchAll(CALL)) here.add(unquote(body, quote));
    for (const value of propLiterals(source)) here.add(value);
    for (const [, quote, body] of source.matchAll(DATA_PROP)) here.add(unquote(body, quote));
    if (file.endsWith('.ts')) {
      for (const [, quote, body] of source.matchAll(/\b[a-z][a-z0-9_]*\s*:\s*(['"])((?:\\.|((?!\1).))*)\1/g)) here.add(unquote(body, quote));
    }
    const clean = [...here].filter(isLabel).map(normalise);
    if (clean.length) perFile.set(relative(ROOT, file), clean);
    for (const key of clean) keys.add(key);
  }
  return { keys: [...keys].sort(), perFile };
}

function normalise(value) {
  return value.replace(/\s+/g, ' ').trim();
}

/** Drop paths, class names, single identifiers and hrefs: they are not prose. */
function isLabel(value) {
  const v = normalise(value);
  if (v.length < 2 || v.length > 420) return false;
  if (/[{}<>`|\\]|\$\{/.test(v)) return false;
  if (/^[a-z0-9 ._/'-]+$/.test(v) && !/[.!?]$/.test(v)) return false;
  if (/^(\/|\.\.?\/|#|http|mailto:|next\/|@\/|lucide|#[0-9a-f]{3,8})/i.test(v)) return false;
  if (/^[A-Za-z-]+$/.test(v) && v.length <= 6 && !/[A-Z]/.test(v)) return false;
  // un code, une immatriculation, un nom de fichier : ce n'est pas un libellé
  if (/^[A-Z0-9._/-]+$/.test(v) && !v.includes(' ')) return false;
  if (/^\d/.test(v) && !/[a-zA-ZÀ-ÿ]{4}/.test(v)) return false;
  return /[A-Za-zÀ-ÿ]/.test(v);
}

/** Les dictionnaires sont des objets littéraux : on évalue la donnée, pas du code. */
function readDictionary(locale) {
  const file = join(DICT_DIR, `${locale}.ts`);
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const body = source.slice(start, end + 1);
  try {
    const value = new Function(`return (${body});`)();
    return typeof value === 'object' && value ? value : {};
  } catch (error) {
    console.error(`  ! ${locale}.ts illisible : ${error.message}`);
    return {};
  }
}

function locales() {
  return readdirSync(DICT_DIR)
    .filter((name) => /^[a-z]{2}(-[A-Z]{2})?\.ts$/.test(name))
    .map((name) => name.replace(/\.ts$/, ''))
    .filter((locale) => locale !== 'index');
}

function coverage(keys) {
  const rows = [];
  const missing = {};
  for (const locale of locales()) {
    const dict = readDictionary(locale) ?? {};
    const have = keys.filter((key) => typeof dict[key] === 'string' && dict[key].trim() && dict[key] !== key);
    missing[locale] = keys.filter((key) => !have.includes(key));
    rows.push({ locale, total: keys.length, have: have.length, missing: missing[locale].length });
  }
  return { rows, missing };
}

const command = process.argv[2] ?? 'extract';
const argument = process.argv[3];

if (command === 'extract') {
  const { keys, perFile } = extract();
  writeFileSync(KEYS, JSON.stringify(keys, null, 2) + '\n');
  console.log(`${keys.length} libellé(s) en usage dans ${perFile.size} fichier(s).`);
  const top = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  for (const [file, list] of top) console.log(`  ${String(list.length).padStart(4)}  ${file}`);
  console.log(`\nécrit : ${relative(ROOT, KEYS)}`);
} else if (command === 'coverage') {
  const { keys } = extract();
  const { rows, missing } = coverage(keys);
  console.log(`${keys.length} libellé(s) à couvrir.\n`);
  for (const row of rows) {
    const pct = row.total ? Math.round((row.have / row.total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 4)).padEnd(25, '·');
    console.log(`  ${row.locale}  ${bar} ${String(pct).padStart(3)} %  (${row.have}/${row.total})`);
  }
  const empty = rows.filter((row) => row.have === 0).map((row) => row.locale);
  if (empty.length) console.log(`\n  langues sans aucune entrée : ${empty.join(', ')} — elles affichent l’anglais.`);
  const worst = rows.slice().sort((a, b) => a.have / a.total - b.have / b.total)[0];
  if (worst && worst.missing) {
    console.log(`\n  ${worst.missing} libellé(s) manquent en ${worst.locale}.`);
    console.log(`  node scripts/i18n.mjs missing ${worst.locale}`);
  }
  void missing;
} else if (command === 'missing') {
  const locale = argument ?? 'fr';
  const { keys } = extract();
  const dict = readDictionary(locale) ?? {};
  const missing = keys.filter((key) => !(typeof dict[key] === 'string' && dict[key].trim() && dict[key] !== key));
  console.log(`// ${locale}.ts — ${missing.length} entrée(s) à écrire\n`);
  for (const key of missing) console.log(`  ${JSON.stringify(key)}: ${JSON.stringify('TODO ' + key)},`);
} else {
  console.log('usage: node scripts/i18n.mjs [extract|coverage|missing <locale>]');
  process.exit(command === '--help' || command === '-h' ? 0 : 1);
}
