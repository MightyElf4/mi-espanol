# Grammar Lessons + Tap-a-Word Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lesson-style grammar explanations (22 topics) and an in-app tap-a-word reader with dictionary lookup + one-tap vocab export, per `docs/superpowers/specs/2026-07-19-grammar-lessons-and-reader-design.md`.

**Architecture:** Two module extensions (grammar.js gets a Lecciones tab, reading.js gets a Leer tab) + one pure-function util file (`js/reader-utils.js`, unit-tested). Data: migration 003 adds `grammar_lessons`, `reading_texts`, `dict_lemmas`, `dict_forms`. Dictionary rows (~30k lemmas, ~300k forms) are built locally from kaikki.org Wiktionary data into JSON chunks committed to the repo, then bulk-loaded by a temporary Supabase Edge Function (service role) fetching those chunks from raw.githubusercontent.com — MCP `execute_sql` can't carry that volume.

**Tech Stack:** Vanilla JS (no build step), Supabase JS v2, node:test, Supabase MCP (`apply_migration`, `execute_sql`, `deploy_edge_function`), GitHub Pages deploy via push to main.

**Constraints carried from repo history:**
- Every deploy MUST bump `CACHE_NAME` in sw.js (cache-first SW). This deploy: `mi-espanol-v6`.
- New script files must be added to index.html (after router.js, before module files) AND to `SHELL_FILES` in sw.js.
- `difficulty` check constraint: `beginner|intermediate|advanced` only.
- No `Co-Authored-By` in commits.
- July 2026 incident: table grants are load-bearing under RLS. After migration, verify new tables have grants for `authenticated` (default privileges were restored 2026-07-18, but verify).

---

### Task 1: Migration 003 — four tables + RLS

**Files:**
- Create: `supabase/migrations/003_grammar_lessons_and_reader.sql`

- [ ] **Step 1: Write the migration file** with exactly:

```sql
create table grammar_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  topic text not null unique,
  title text not null,
  explanation_es text not null,
  explanation_en text not null,
  examples jsonb not null default '[]',
  common_errors jsonb not null default '[]',
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz default now()
);

create table reading_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  body text not null,
  source text not null default 'pasted' check (source in ('seeded', 'pasted')),
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Shared reference data: no user_id, read-only for app users
create table dict_lemmas (
  id bigint generated always as identity primary key,
  lemma text not null,
  pos text not null,
  gloss text not null
);
create index dict_lemmas_lemma_idx on dict_lemmas (lemma);

create table dict_forms (
  form text not null,
  lemma text not null,
  primary key (form, lemma)
);

alter table grammar_lessons enable row level security;
alter table reading_texts enable row level security;
alter table dict_lemmas enable row level security;
alter table dict_forms enable row level security;

create policy "own_lessons" on grammar_lessons for all using (auth.uid() = user_id);
create policy "own_texts" on reading_texts for all using (auth.uid() = user_id);
create policy "dict_lemmas_read" on dict_lemmas for select to authenticated using (true);
create policy "dict_forms_read" on dict_forms for select to authenticated using (true);
```

Note `examples` jsonb shape: `[{ "spanish": "...", "english": "...", "note": "..." }]` with the key form wrapped in `**…**`. `common_errors` shape: `[{ "wrong": "...", "right": "...", "why": "..." }]`.

- [ ] **Step 2: Apply via MCP** `apply_migration` (name `grammar_lessons_and_reader`), same SQL.
- [ ] **Step 3: Verify tables + grants:**

```sql
select table_name, privilege_type, grantee from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('grammar_lessons','reading_texts','dict_lemmas','dict_forms')
and grantee in ('authenticated','anon') order by table_name, grantee;
```

Expected: SELECT/INSERT/UPDATE/DELETE present for `authenticated` on all four. If missing → default privileges regressed; re-grant explicitly before continuing.

- [ ] **Step 4: Commit** `git commit -m "Add migration 003: grammar lessons, reading texts, dictionary tables"`

---

### Task 2: reader-utils.js — tokenizer + normalization (TDD)

**Files:**
- Create: `js/reader-utils.js`
- Test: `tests/reader-utils.test.js`

Pure functions, exported node-style like js/srs.js (check its `module.exports` guard and copy the pattern).

- [ ] **Step 1: Write failing tests** (node:test + assert/strict, `require('../js/reader-utils.js')`):

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWord, tokenize, sentenceAt, escapeHtml } = require('../js/reader-utils.js');

test('normalizeWord lowercases and strips edge punctuation, keeps accents/ñ/ü', () => {
  assert.equal(normalizeWord('¿Tuviera,'), 'tuviera');
  assert.equal(normalizeWord('"Ñoño!"'), 'ñoño');
  assert.equal(normalizeWord('pingüino.'), 'pingüino');
  assert.equal(normalizeWord('123'), '');
});

test('tokenize splits words and non-words preserving everything', () => {
  const tokens = tokenize('Hola, ¿qué tal?');
  assert.deepEqual(tokens.map(t => t.s).join(''), 'Hola, ¿qué tal?');
  assert.deepEqual(tokens.filter(t => t.w).map(t => t.s), ['Hola', 'qué', 'tal']);
});

test('tokenize records char offsets', () => {
  const tokens = tokenize('Yo canto.');
  const canto = tokens.find(t => t.s === 'canto');
  assert.equal(canto.i, 3);
});

test('sentenceAt returns the sentence containing the offset', () => {
  const text = 'Fui al mercado. Compré arroz y frijoles. Volví a casa.';
  assert.equal(sentenceAt(text, text.indexOf('arroz')), 'Compré arroz y frijoles.');
});

test('escapeHtml escapes angle brackets, quotes, ampersands', () => {
  assert.equal(escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});
```

- [ ] **Step 2: Run `node --test tests/reader-utils.test.js`** — expect FAIL (module not found).
- [ ] **Step 3: Implement:**

```js
const READER_WORD = /[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+/g;

function normalizeWord(raw) {
  return (raw || '').toLowerCase().replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/g, '')
    .match(/^[a-záéíóúüñ]+$/) ? (raw || '').toLowerCase().replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/g, '') : '';
}
```

(Implementation shown is the spec of behavior — final code should compute the stripped value once; must return `''` when nothing letter-like remains, and must NOT strip letters interior to the word.)

`tokenize(text)` → array of `{ s, w, i }` (`s` string, `w` boolean is-word, `i` char offset), alternating via READER_WORD matches with the gaps between them. `sentenceAt(text, offset)` → split on `/(?<=[.!?…])\s+/` tracking cumulative offsets, return trimmed sentence containing offset (whole text if no terminators). `escapeHtml(s)` → replace `& < > " '` with entities. Export via the same `module.exports` guard srs.js uses so the browser global scope also gets the functions.

- [ ] **Step 4: Run all tests** `node --test tests/` — all pass (12 existing + new).
- [ ] **Step 5: Commit** `"Add reader-utils: tokenizer, word normalization, sentence extraction"`

---

### Task 3: Grammar — Lecciones tab

**Files:**
- Modify: `js/modules/grammar.js`
- Modify: `css/modules/vocab.css` (shared module CSS lives here)

- [ ] **Step 1: DB helper + per-topic accuracy.** Add `fetchGrammarLessons()` (mirror `fetchGrammarExercises`, table `grammar_lessons`, order by `difficulty` then `topic`). Change `fetchGrammarAttempts()` select from `'correct'` to `'correct, exercise_id'` — stats code unaffected; lessons list joins attempts→exercises client-side for per-topic accuracy (fetch exercises `id, topic` map).

- [ ] **Step 2: Lessons list view** `renderGrammarLessons(container, openLesson)`. Group rows: beginner/intermediate under "B1 — Base", advanced under "B2–C1 — Avanzado" (matches how the 22 topics split). Each row card: title, topic, accuracy chip (`—` if no attempts; else `n% · m intentos`). Click → `openLesson(lesson)`.

- [ ] **Step 3: Lesson detail view** `renderGrammarLessonDetail(container, lesson, { onBack, onPractice })`:
  - "← Volver" button (pattern from renderReadingForm header).
  - `explanation_es` rendered as paragraphs (split on `\n\n`, escapeHtml is NOT needed — content is Claude-seeded, but bold markers `**x**` convert to `<strong>`; write tiny `mdBold()` local helper).
  - "Ver en inglés" toggle button revealing `explanation_en` block.
  - Examples list: spanish (bold markers → strong, accent color), english muted, note if present.
  - "Errores comunes" box: wrong (struck/red) → right (green) + why.
  - Footer button **"Practicar este tema →"** → `onPractice(lesson.topic)`.

- [ ] **Step 4: Wire into the module.** Add `{ id: 'lessons', label: 'Lecciones' }` to tabs (first position: lessons, practice, list, stats). Module-level `let grammarJumpTopic = null;`. `onPractice(topic)` sets `grammarJumpTopic = topic` and calls `renderTab('practice')`; in `renderGrammarPractice`, initialize `currentTopic = grammarJumpTopic ?? ''` and reset `grammarJumpTopic = null`.

- [ ] **Step 5: "Ver la regla" on wrong answers.** In the incorrect-feedback branch, append link `<a href="#" id="g-see-rule">Ver la regla — ${ex.topic}</a>`; click → open that topic's lesson detail (fetch lessons, find by topic, render detail with onBack returning to practice). If no lesson row exists for the topic, hide the link (guard).

- [ ] **Step 6: CSS** in `css/modules/vocab.css`: `.lesson-row`, `.accuracy-chip`, `.lesson-en-block` (hidden by default), `.error-box` styles using existing tokens (`var(--accent)`, `var(--text-muted)`, card styles already global).

- [ ] **Step 7: Boot check.** `python3 -m http.server` from repo root, open in browser (chrome-devtools MCP), verify: zero console errors, login screen renders. (Full tab check happens post-seed, Task 4.)

- [ ] **Step 8: Commit** `"Add Lecciones tab: lesson list, detail view, practice jump, ver-la-regla link"`

---

### Task 4: Seed 22 grammar lessons + verification pass

**Files:** none (DB content via MCP `execute_sql`)

The 22 `topic` values must match `grammar_exercises.topic` byte-for-byte (verified live 2026-07-19): Cláusulas con si — contrafactuales / hipotéticas / reales, Condicional simple, Estilo indirecto, Futuro simple, Imperativo, Pluscuamperfecto, Por vs. para, Preposiciones, Pretérito perfecto, Pretérito vs. imperfecto, Pronombres de objeto, Pronombres relativos, Ser vs. estar, Subjuntivo — disparadores, Subjuntivo imperfecto, Subjuntivo perfecto y pluscuamperfecto, Subjuntivo presente, Verbos reflexivos, Verbos tipo gustar, Voz pasiva y "se".

- [ ] **Step 1: Draft + insert in batches of 4–5** (INSERT with jsonb literals). Per lesson: explanation_es (150–300 words, B1-readable Spanish), explanation_en (equivalent, not literal translation), 4–6 examples (CR/teaching-flavored where natural), 2–4 common errors (anglophone-typical). Difficulty mirrors the topic's exercise difficulty (beginner: Ser vs. estar, Verbos reflexivos, Verbos tipo gustar → the mixed ones take their majority difficulty; advanced: the 8 B2–C1 topics).
- [ ] **Step 2: Count check** — `select count(*), count(distinct topic) from grammar_lessons;` expect 22/22, and anti-join against `grammar_exercises` topics returns 0 rows both directions.
- [ ] **Step 3: Verification subagent** (per Landry's bulk-content standard): dispatch one reviewer agent with all 22 lessons dumped as JSON; instructions: check every grammar claim, every example sentence's correctness and its match to the stated rule, register of Spanish explanations (B1-readable), ES/EN equivalence. Fix everything it flags with UPDATEs; re-check fixed rows.
- [ ] **Step 4: Browser check** — Lecciones tab now renders 22 rows (needs Landry's session; if unavailable, verify via SQL + code review and defer visual check to post-deploy).

---

### Task 5: Reader — Leer tab (library, paste form, reader view, lookup sheet, vocab export)

**Files:**
- Modify: `js/modules/reading.js`
- Modify: `css/modules/vocab.css`
- Modify: `index.html` (add `<script src="js/reader-utils.js"></script>` after router.js, before modules)

- [ ] **Step 1: DB helpers** in reading.js: `fetchReadingTexts()` (own rows, newest first), `insertReadingText({title, body})` (source `'pasted'`), `deleteReadingText(id)`, and:

```js
async function lookupWord(raw) {
  const form = normalizeWord(raw);
  if (!form) return { form: raw, entries: [] };
  const { data: formRows, error } = await sb.from('dict_forms').select('lemma').eq('form', form).limit(5);
  if (error) throw error;
  const lemmas = [...new Set([form, ...(formRows || []).map(r => r.lemma)])];
  const { data: entries, error: e2 } = await sb.from('dict_lemmas').select('lemma,pos,gloss').in('lemma', lemmas).limit(10);
  if (e2) throw e2;
  return { form, entries: entries || [] };
}
```

Plus `addVocabFromReading({ lemma, gloss, sentence })` → insert into `vocab_cards`: `spanish: lemma, english: gloss, example_sentence: sentence, tags: ['reading'], difficulty: 'intermediate', due_date: today`. Before coding, check `vocab_cards` column defaults via `information_schema.columns` — rely on DB defaults for SRS fields (interval_days, ease_factor, review_count); include them explicitly only if defaults are absent.

- [ ] **Step 2: Library view** `renderReadingLibrary(container, { onOpen, onPaste })` — "+ Pegar texto" button, then cards: title, difficulty + source chips, `~n palabras`, delete button (confirm) for pasted texts only. Empty state if none.

- [ ] **Step 3: Paste form** `renderReadingPasteForm(container, onDone)` — title input + body textarea (rows 10), save → insertReadingText → onDone. Mirror renderReadingForm's error handling.

- [ ] **Step 4: Reader view** `renderReadingTextView(container, text, onBack)`:
  - Header: back button + title.
  - Body: split `text.body` on `\n\n` into `<p class="reader-p">`; per paragraph render `tokenize(par)` — word tokens as `<span class="tw" data-i="${i}">${escapeHtml(s)}</span>`, non-word tokens as `escapeHtml(s)`. **User-pasted text goes through escapeHtml, always.**
  - One delegated click handler on the body container for `.tw`: highlight tapped span (`.tw-active`), call `lookupWord(span.textContent)`, render bottom sheet.
  - Bottom sheet (fixed-position div appended to container, `.reader-sheet`): tapped form; per entry: lemma + pos chip + gloss; **"+ Añadir a vocabulario"** button per entry → `addVocabFromReading({ lemma, gloss, sentence: sentenceAt(paragraphText, tokenOffset) })`, button flips to "✓ Añadida" disabled; on lookup miss: "No está en el diccionario" + link `https://www.spanishdict.com/translate/${encodeURIComponent(form)}` (target _blank) — no dead ends. Sheet closes on ✕ or tapping outside. Lookup errors → inline message in sheet, not a broken screen.

- [ ] **Step 5: Wire tab.** Tabs become: `leer` (label **Leer**), `log` (**Registrar**), `history` (**Historial**), `discover` (**Descubrir**), `stats` (**Estadísticas**); default tab → `leer`. Internal sub-state (library ↔ paste ↔ reader) managed by the render functions calling each other, same as log/history do today. Rename page-header h2 stays "Leer" (module title unchanged).

- [ ] **Step 6: CSS**: `.reader-p` (font-size 17px, line-height 1.8 — reading comfort), `.tw` (cursor pointer), `.tw-active` (accent underline/background), `.reader-sheet` (fixed, bottom 0, safe-area padding, slide-up, above bottom nav z-index), chips reuse existing styles.

- [ ] **Step 7: Tests still green** (`node --test tests/`), boot check clean console.
- [ ] **Step 8: Commit** `"Add Leer tab: reading library, paste form, tap-a-word reader with vocab export"`

---

### Task 6: Seed ~20 readings

- [ ] **Step 1: Write and insert 20 texts** via `execute_sql` batches (source `'seeded'`): 8 intermediate-easy B1, 8 B1+/B2, 4 advanced; 150–350 words each; everyday narrative + Costa Rica/teaching settings; original prose (no factual-claim-heavy content); tags like `{costa-rica, cotidiano, trabajo}`.
- [ ] **Step 2: Verify** counts + one full render in-app or via SQL length/paragraph sanity (every body has ≥2 paragraphs, no markdown artifacts).
- [ ] **Step 3:** Include readings in the Task 4 verification subagent pass if run after this task; otherwise dispatch the same reviewer once over lessons + readings together (one dispatch total is fine — batch them).

---

### Task 7: Dictionary build pipeline

**Files:**
- Create: `scripts/build-dict.mjs` (node, zero deps)
- Create: `data/dict/lemmas-*.json`, `data/dict/forms-*.json` (generated, committed)

- [ ] **Step 1: Download sources** to `/tmp` (NOT the repo):
  - kaikki.org Spanish extract: `https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl.gz` (if the .gz is unavailable, the plain .jsonl; check size with a HEAD request first — if > ~600MB download, stream-process with curl piped to zcat/node instead of saving).
  - Frequency list: `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt` (word + count per line).
- [ ] **Step 2: build-dict.mjs** — stream jsonl line-by-line (readline over zlib gunzip stream):
  - Build `topSet` = first 30,000 words of es_50k.
  - Keep entry if `entry.word.toLowerCase()` ∈ topSet and `entry.pos` ∈ {noun, verb, adj, adv, prep, conj, pron, det, intj, num}.
  - Gloss: first 2 senses' first gloss each, joined `; `, skip senses tagged form-of/misspelling; skip entry if no usable gloss. Cap gloss at 160 chars.
  - One output row per (lemma, pos): `{lemma, pos, gloss}` (dedupe, first wins).
  - Forms: for kept entries, each `entry.forms[].form` matching `/^[a-záéíóúüñ]+$/i` and ≠ lemma → `{form: lowercased, lemma}`; global dedupe on (form,lemma); skip forms whose tags include `romanization`.
  - Write chunks: lemmas 10k rows/file, forms 20k rows/file, plus `data/dict/manifest.json` `{ lemmaFiles: [...], formFiles: [...], counts: {...} }`.
  - Print final counts.
- [ ] **Step 3: Run it**, sanity-check: `tuviera` present in forms → `tener`; `tener`, `escuela`, `pura` in lemmas; total lemmas 15k–40k, forms 100k–500k (outside range → investigate before proceeding).
- [ ] **Step 4: Commit** script + data + manifest (check repo size delta stays under ~15MB; if larger, cut topSet to 20k and rerun) — `"Add dictionary build pipeline + generated dictionary data"`. **Push to main** (raw.githubusercontent.com must serve the chunks for Task 8; the app itself is unaffected — sw cache not yet bumped, new files unreferenced).

---

### Task 8: Bulk-load dictionary via temporary Edge Function

- [ ] **Step 1: Deploy** (MCP `deploy_edge_function`, name `load-dict`, verify_jwt true):

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { chunk_url, table } = await req.json();
  if (!['dict_lemmas', 'dict_forms'].includes(table)) return new Response('bad table', { status: 400 });
  if (!/^https:\/\/raw\.githubusercontent\.com\/mightyelf4\/mi-espanol\/[\w./-]+\.json$/.test(chunk_url))
    return new Response('bad url', { status: 400 });
  const res = await fetch(chunk_url);
  if (!res.ok) return new Response('fetch failed: ' + res.status, { status: 502 });
  const rows = await res.json();
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  for (let i = 0; i < rows.length; i += 2000) {
    const slice = rows.slice(i, i + 2000);
    const { error } = table === 'dict_forms'
      ? await db.from(table).upsert(slice, { onConflict: 'form,lemma', ignoreDuplicates: true })
      : await db.from(table).insert(slice);
    if (error) return new Response(JSON.stringify({ at: i, error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ inserted: rows.length }));
});
```

- [ ] **Step 2: Invoke per chunk** with Bash curl loop (anon key from js/config.js as Bearer — verify_jwt accepts it), lemmas first then forms, checking each response is 200/inserted; on a 500, fix and re-run that chunk (lemmas table: truncate + full redo since inserts aren't idempotent; forms are upsert-safe).
- [ ] **Step 3: Verify in SQL:** counts match manifest; spot lookups — `select lemma from dict_forms where form = 'tuviera'` → tener; `select gloss from dict_lemmas where lemma = 'tener' and pos = 'verb'` non-empty; `explain analyze` a form lookup uses the PK index.
- [ ] **Step 4: RLS check:** as anon (REST curl with anon key, no user JWT) `dict_lemmas?select=*&limit=1` returns `[]` or 401 — not data; authenticated read verified in-app later.
- [ ] **Step 5: Delete the edge function** (MCP has no delete tool — if unavailable, redeploy `load-dict` with a body that returns 410 unconditionally). Log the load in `claude_log` via SQL (matches co-pilot logging pattern).

---

### Task 9: Ship — SW bump, full verification, deploy

**Files:**
- Modify: `sw.js` (CACHE_NAME → `mi-espanol-v6`; add `js/reader-utils.js` to SHELL_FILES)
- Modify: `index.html` (confirm reader-utils.js script tag from Task 5)

- [ ] **Step 1:** sw.js changes above.
- [ ] **Step 2: Full test run** `node --test tests/` — all pass.
- [ ] **Step 3: Local boot check** (http.server + browser MCP): zero console errors, login screen, sw registers.
- [ ] **Step 4: Commit + push to main** `"Ship grammar lessons + tap-a-word reader (sw v6)"`.
- [ ] **Step 5: Live verification** (~60s after push): `curl -s https://mightyelf4.github.io/mi-espanol/sw.js | head -1` shows v6; curl index.html contains reader-utils.js; curl js/modules/reading.js contains `renderReadingTextView`.
- [ ] **Step 6:** Ask Landry to open the app (fresh load), tap Gramática → Lecciones and Leer → a seeded text, tap a word, add it to vocab. That's the end-to-end proof.

---

## Self-review notes

- Spec coverage: lessons (Tasks 1,3,4), reader+paste (5), seeded texts (6), dictionary+fallback link+vocab button (5,7,8), plumbing/sw/tests (2,9). Open question from spec (bulk load path) resolved: edge function.
- Known risk: kaikki download size/URL drift — Task 7 Step 1 has the stream fallback; worst case cut topSet to 20k.
- Known risk: no Landry login available for full E2E before deploy — mitigated by unit tests, SQL-level verification, console-clean boot, and Step 6 handoff.
