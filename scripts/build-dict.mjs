// Builds data/dict/*.json from the kaikki.org Spanish Wiktionary extract,
// scoped to the most frequent lemmas. Zero dependencies.
//
// Usage:
//   node scripts/build-dict.mjs /tmp/kaikki-es.jsonl.gz /tmp/es_50k.txt
//
// Inputs:
//   kaikki:   https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl.gz
//   freq:     https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt
//
// Output (committed to the repo so the load-dict edge function can fetch chunks
// from raw.githubusercontent.com):
//   data/dict/lemmas-NNN.json   [{lemma, pos, gloss}]     10k rows per file
//   data/dict/forms-NNN.json    [{form, lemma}]           20k rows per file
//   data/dict/manifest.json     file lists + counts

import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const [kaikkiPath, freqPath] = process.argv.slice(2);
if (!kaikkiPath || !freqPath) {
  console.error('usage: node scripts/build-dict.mjs <kaikki.jsonl.gz> <es_50k.txt>');
  process.exit(1);
}

const TOP_N = 30000;
const KEEP_POS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'intj', 'num', 'article', 'contraction', 'particle']);
const WORD_RE = /^[a-záéíóúüñ]+$/i;
const GLOSS_CAP = 160;

const topSet = new Set(
  readFileSync(freqPath, 'utf8')
    .split('\n')
    .slice(0, TOP_N)
    .map(line => line.split(' ')[0])
    .filter(Boolean)
);
console.log(`frequency set: ${topSet.size} words`);

const lemmaRows = [];          // {lemma, pos, gloss}
const lemmaSeen = new Set();   // "lemma|pos"
const keptLemmas = new Set();  // lemma
const formPairs = new Set();   // "form|lemma"
const pendingFormOf = [];      // [form, targetLemma] resolved after pass

function senseUsable(sense) {
  if (!sense.glosses || sense.glosses.length === 0) return false;
  const tags = sense.tags || [];
  if (tags.includes('form-of') || tags.includes('alt-of') || tags.includes('misspelling')) return false;
  if (sense.form_of || sense.alt_of) return false;
  return true;
}

function extractGloss(entry) {
  const parts = [];
  for (const sense of entry.senses || []) {
    if (!senseUsable(sense)) continue;
    const g = sense.glosses[0];
    if (!parts.includes(g)) parts.push(g);
    if (parts.length === 2) break;
  }
  if (parts.length === 0) return null;
  // dedupe at segment level: sense glosses often repeat each other's segments
  const segments = [];
  for (const part of parts) {
    for (const seg of part.split('; ')) {
      if (seg && !segments.includes(seg)) segments.push(seg);
    }
  }
  let gloss = segments.join('; ');
  if (gloss.length > GLOSS_CAP) gloss = gloss.slice(0, GLOSS_CAP - 1) + '…';
  return gloss;
}

const rl = createInterface({ input: createReadStream(kaikkiPath).pipe(createGunzip()), crlfDelay: Infinity });
let lines = 0;

for await (const line of rl) {
  lines++;
  if (!line) continue;
  const e = JSON.parse(line);
  if (e.lang_code !== 'es' || !KEEP_POS.has(e.pos)) continue;
  const word = (e.word || '').toLowerCase();
  if (!WORD_RE.test(word)) continue;

  // form-of entries: remember form → target lemma, resolve later
  for (const sense of e.senses || []) {
    const target = sense.form_of?.[0]?.word?.toLowerCase();
    if (target && WORD_RE.test(target) && target !== word) pendingFormOf.push([word, target]);
  }

  if (!topSet.has(word)) continue;

  const gloss = extractGloss(e);
  if (gloss) {
    const key = `${word}|${e.pos}`;
    if (!lemmaSeen.has(key)) {
      lemmaSeen.add(key);
      keptLemmas.add(word);
      lemmaRows.push({ lemma: word, pos: e.pos, gloss });
    }
  }

  for (const f of e.forms || []) {
    const form = (f.form || '').toLowerCase();
    const tags = f.tags || [];
    if (!WORD_RE.test(form) || form === word) continue;
    if (tags.includes('romanization') || tags.includes('table-tags') || tags.includes('inflection-template')) continue;
    formPairs.add(`${form}|${word}`);
  }
}
console.log(`scanned ${lines} entries`);

// keep only forms whose target lemma made the cut
for (const [form, target] of pendingFormOf) {
  if (keptLemmas.has(target)) formPairs.add(`${form}|${target}`);
}
let formRows = [];
for (const pair of formPairs) {
  const [form, lemma] = pair.split('|');
  if (keptLemmas.has(lemma)) formRows.push({ form, lemma });
}

console.log(`lemmas: ${lemmaRows.length}  forms: ${formRows.length}`);

mkdirSync('data/dict', { recursive: true });
const chunk = (rows, size, prefix) => {
  const files = [];
  for (let i = 0; i < rows.length; i += size) {
    const name = `${prefix}-${String(files.length).padStart(3, '0')}.json`;
    writeFileSync(`data/dict/${name}`, JSON.stringify(rows.slice(i, i + size)));
    files.push(name);
  }
  return files;
};

const lemmaFiles = chunk(lemmaRows, 10000, 'lemmas');
const formFiles = chunk(formRows, 20000, 'forms');
writeFileSync('data/dict/manifest.json', JSON.stringify({
  built: new Date().toISOString(),
  counts: { lemmas: lemmaRows.length, forms: formRows.length },
  lemmaFiles,
  formFiles,
}, null, 2));

console.log(`wrote ${lemmaFiles.length} lemma files, ${formFiles.length} form files`);
