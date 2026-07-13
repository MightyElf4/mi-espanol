# Mi Español — Design Spec
**Date:** 2026-07-13  
**Status:** Approved  
**Author:** Landry + Claude

---

## 1. Purpose

A personal Spanish learning web app for Landry C Underhill, Peace Corps volunteer in Hojancha, Costa Rica. Current level: intermediate-mid (B1). Goal: near-fluency (B2/C1) by end of service (June 2028).

Not a classroom tool — this is a personal field notebook and practice environment for someone living in immersion. Claude acts as co-pilot: adding content, analyzing performance, and evolving the app across sessions. The app grows with the learner.

---

## 2. Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript — no framework, no build step
- **Backend:** Supabase (Postgres + Auth)
- **Hosting:** Netlify (free tier)
- **Speech:** Web Speech API (browser-native, free, works in iOS Safari)
- **AI (future):** Claude API for grammar correction, exercise generation — not in v1

Same stack as Puente English. Landry can maintain and extend it solo.

---

## 3. Architecture

### PWA
The app is a Progressive Web App. A `manifest.json` and service worker enable "Add to Home Screen" on iPhone. The app shell (HTML, CSS, JS) is cached by the service worker so it loads instantly on poor connections.

### Single-Page App with Hash Router
A lightweight hash router (`#/vocab`, `#/grammar`, etc.) maps URLs to module views. Each module is a self-contained JS file. Adding a new module = add one file, register one route, add one nav item. Nothing else changes.

### Auth
Single user. Supabase email/password auth. No roles, no class management. Login persists across devices — iPhone and laptop share the same data automatically.

### Mobile-First UI
Bottom navigation bar with icons for each module. Large tap targets. One-handed layout. Designed to feel like a native app on iPhone.

---

## 4. Modules

### 4.1 Vocabulary (SRS)
Spaced repetition flashcard system. Core of the daily habit.

- Add cards manually or via bulk import (see §7)
- Each card: Spanish word/phrase, English meaning, example sentence, tags (array), difficulty (`beginner / intermediate / advanced`), SRS fields (due date, interval, ease factor, review count), notes
- Review session: show Spanish → think → tap to reveal → rate 1–4 → SM-2 algorithm schedules next review
- Retention rate and weak card analytics visible per tag/category
- Offline-capable: reviews queue locally and sync when connection returns (see §6)

### 4.2 Grammar
Targeted exercises for intermediate gaps: subjunctive, ser vs. estar, por vs. para, preterite vs. imperfect, etc.

- Exercises: prompt, correct answer, your answer, result, timestamp, topic tag, difficulty
- Topics can be flagged as "struggling" — the module weights those higher
- Exercises use real sentences; Claude generates new exercises on demand
- Exercise bank grows over time as Claude adds content

### 4.3 Listening Log
Track Spanish audio consumption and extract learning from it.

- Log: source name, episode/title, date, comprehension rating (1–5), notes, linked vocab card IDs
- "Save to vocab" button: highlight a word/phrase in notes → creates a vocab card instantly
- Comprehension rating trend visible over time on dashboard

### 4.4 Reading Log
Same pattern as Listening Log but for text: articles, books, signs, menus, anything.

- Log: source, date, comprehension rating, notes, linked vocab card IDs
- "Save to vocab" inline button

### 4.5 Speaking Log / Confidence Tracker
Log speaking interactions to build momentum and diagnose the confidence gap.

- Tap mic → speak → Web Speech API transcribes → saved as log entry
- Or type manually
- Fields: date, description of interaction, difficulty rating (1–5), what you couldn't say, transcript
- Daily speaking prompt: a small suggested interaction to try today (e.g., "Ask your neighbor how their weekend was") — Claude pre-generates a batch of 30 prompts stored in `user_settings.speaking_prompts[]`; the app surfaces one per day by index
- Interaction frequency trend on dashboard — this is a key progress metric

### 4.6 Dashboard / Home
Daily overview and progress toward fluency.

- Cards due for SRS review today
- Weekly activity chart across all modules
- **North star metrics:** total vocabulary mastered, estimated CEFR level (a heuristic Claude defines and updates — e.g., 1,500 mastered words + consistent grammar scores = B2), speaking interactions this week vs. personal target
- Insight panel: surfaces patterns Claude has identified (e.g., "You've reviewed 'subjunctive' 12 times — still low retention")
- Optional streak counter (visible but never blocking)

---

## 5. Data Model

Each module owns its own Supabase table. Shared tables are minimal.

```
vocab_cards
  id, user_id, spanish, english, example_sentence, tags[], difficulty,
  due_date, interval_days, ease_factor, review_count, notes, created_at

grammar_exercises  
  id, user_id, topic, prompt, correct_answer, difficulty, created_at
  
grammar_attempts
  id, user_id, exercise_id, your_answer, correct (bool), timestamp

listening_log
  id, user_id, source, date, comprehension_rating, notes,
  linked_vocab_ids[], created_at

reading_log
  id, user_id, source, date, comprehension_rating, notes,
  linked_vocab_ids[], created_at

speaking_log
  id, user_id, date, description, difficulty_rating, couldnt_say,
  transcript, created_at

daily_stats
  id, user_id, date, stats_json (pre-aggregated snapshot for dashboard; updated at end of each review session and on page load)

user_settings
  id, user_id, dark_mode, streak_visible, grammar_weak_topics[],
  vocab_goal, speaking_goal_per_week, current_level

claude_log
  id, action_type, description, affected_table, affected_ids[],
  timestamp, notes
  (no user_id — single-user app)
```

---

## 6. Offline Support

The vocab SRS review is the feature most likely to be used without reliable internet (daily habit, anywhere). Implementation:

- On app load, sync today's due cards to `localStorage`
- Reviews happen against the local copy
- Results queue in `localStorage` under a `pending_sync` key
- On next connection, pending results flush to Supabase automatically
- All other modules degrade gracefully: show cached data, queue writes

---

## 7. Content Management (Claude as Co-Pilot)

Claude connects to the Supabase database directly via the Supabase MCP tool in any future session. This enables:

**Adding content:**
- "Add these 15 words from today's podcast" → Claude writes them to `vocab_cards`
- "Generate 10 new subjunctive exercises at intermediate level" → Claude writes to `grammar_exercises`
- "Update today's speaking prompt" → Claude writes to `user_settings`

**Analyzing performance:**
- "How is my vocab retention this week?" → Claude queries `vocab_cards` + `grammar_attempts`, surfaces patterns
- "What grammar topics am I struggling with?" → Claude queries `grammar_attempts` grouped by topic

**Making changes:**
- "The dashboard feels cluttered — let's simplify it" → Claude edits the view file
- "Add a new module for tracking TV shows I watch" → Claude creates table + view + nav entry

**Every Claude action is logged** to `claude_log` with what was changed, when, and why.

---

## 8. Level Adaptation

All content (vocab cards, grammar exercises) is tagged with `difficulty: beginner | intermediate | advanced`.

- v1 launches with intermediate content
- As Landry advances, Claude shifts the weighting: fewer intermediate cards surfaced in reviews, more advanced content seeded
- No structural changes needed — just data and settings updates
- Claude tracks the transition and recommends when to shift based on retention rates

---

## 9. Speech-to-Text

Web Speech API — browser-native, free, no API key.

- Available in Safari on iOS
- Microphone button appears in: Speaking Log (primary), Vocab card notes, Listening/Reading log notes
- Tap → speak → transcription appears in the field
- Graceful fallback: if speech API unavailable, field becomes a plain text input

---

## 10. Future Considerations (Not v1)

- **Claude API integration:** Grammar correction on Speaking Log entries, AI conversation partner, exercise explanation
- **Costa Rican slang deck:** Pre-seeded vocab set for Tico expressions (mae, tuanis, pura vida, chunche, etc.)
- **Push notifications:** Daily vocab review reminder (iOS PWA notification support is limited but improving)
- **Export:** Download your vocab deck as CSV or Anki-compatible format

---

## 11. What Claude Needs Each Session

To do any analysis or content work, Claude needs:
1. Access to the Supabase project via MCP — project ID and credentials will be noted in `CLAUDE.md` at the project root once the Supabase project is created
2. The module structure (one file per module, named to match the route) so Claude knows where to add things
3. This spec as baseline context — reference it at the start of any working session
