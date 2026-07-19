# Grammar Lessons + Tap-a-Word Reader — Design

*2026-07-19. Approved by Landry after brainstorming session.*

## Goal

Two features moving the B1 → C2 goal:

1. **Gramática lessons** — rule explanations for the existing 22 exercise topics, lesson-style (read → practice → miss → re-read).
2. **Lector** — in-app reader where any word can be tapped for a dictionary gloss, with one-tap export to the SRS vocab deck. Texts come from a seeded library and a paste-your-own form.

## Feature 1 — Gramática lessons

### Data

New table `grammar_lessons` (migration 003, RLS matching existing tables):

| Column | Notes |
|---|---|
| `topic` | exact same topic strings as `grammar_exercises.topic` (22 values) — this is the join key |
| `title` | display title, Spanish |
| `explanation_es` | the rule, written in Spanish |
| `explanation_en` | English version, revealed on tap |
| `examples` | jsonb array: `{ spanish, english, note }` — key form highlighted with `**bold**` markers |
| `common_errors` | jsonb array: `{ wrong, right, why }` |
| `difficulty` | `beginner` / `intermediate` / `advanced` (check constraint values) |

One row per topic, all 22 seeded via MCP. Content council-verified per the July 14 content-build standard.

### UI

- Grammar module gets a **Lecciones** tab (existing tab pattern in grammar.js).
- Topic list grouped B1 core → B2–C1, each row showing accuracy from `grammar_attempts` (highlights weak topics).
- Lesson view: Spanish explanation, **Ver en inglés** toggle, examples with highlighted forms, common-errors box, **Practicar este tema →** button that launches the existing topic-filtered 20-exercise round.
- In practice mode, a wrong answer shows a **Ver la regla** link to that topic's lesson.

## Feature 2 — Lector (tap-a-word reader)

### Data

Three new tables (same migration):

| Table | Purpose |
|---|---|
| `reading_texts` | `title`, `body`, `source` (`seeded` \| `pasted`), `difficulty`, `tags[]`. ~20 seeded B1–B2 readings (Costa Rica / teaching flavored) + user-pasted rows. |
| `dict_lemmas` | `lemma`, `pos`, `gloss` (English). Top ~30–50k lemmas from free Wiktionary-derived data (kaikki.org). |
| `dict_forms` | `form` → `lemma` (inflection map, so *tuviera* resolves to *tener*). Several hundred thousand small rows. |

Dictionary tables are shared reference data: readable by `authenticated`, no user_id column.

### UI

- Reading module gets a **Leer** tab: text list + **Pegar texto** button (title + body form).
- Reader view tokenizes the body at render time — every word wrapped in a tappable span; nothing precomputed or stored.
- Tap → bottom sheet: tapped form, lemma, gloss, plus:
  - **Añadir a vocabulario** — inserts a vocab card: `spanish` = lemma, `english` = gloss, `example_sentence` = the sentence the word was tapped in, `tags` = `['reading']`, due today.
  - Dictionary miss → **buscar en SpanishDict →** external link (no tap dead-ends).
- Lookup normalization: lowercase, strip surrounding punctuation; accents preserved (Spanish accents are contrastive).

## Shared plumbing

- Both modules follow the existing pattern: `getSession()`-based user id helper, tab UI, `showLoadError`, `router.register()`.
- New CSS in the module stylesheets; design system tokens from main.css.
- Migration `003_grammar_lessons_and_reader.sql` creates all four tables + RLS.
- Service worker cache → **v6** on deploy (mandatory — cache-first SW).
- Unit tests: tokenizer, lookup normalization.

## Build order

1. Grammar lessons (migration slice + Lecciones tab + 22 seeded lessons).
2. Reader (reader UI + paste form + seeded texts).
3. Dictionary (data pipeline + lookup + vocab export button).

Each step leaves the app deployed and functional.

## Open implementation question

Bulk-loading several hundred thousand `dict_forms` rows through MCP `execute_sql` is impractical (statement size). The plan phase must pick the loading path: local `psql`/Supabase CLI if credentials are available, or fall back to a scoped-down dictionary loaded in batches. If neither is workable at full scale, the fallback is a smaller lemma set — the design stands, only row count changes.
