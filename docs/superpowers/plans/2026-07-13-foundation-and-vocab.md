# Mi Español — Foundation + Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working PWA with auth, bottom navigation, all module stubs, and a fully functional Vocabulary SRS module using the SM-2 algorithm — deployable to Netlify and installable on iPhone.

**Architecture:** Single-page vanilla JS app with a hash router. Each module is a self-contained JS file loaded via script tags. Supabase handles auth and persistence. Offline vocab reviews are queued in localStorage and synced on reconnect.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase JS SDK v2 (CDN), Netlify, Web Speech API, Node.js (for unit tests only)

---

## File Map

```
mi-espanol/
├── index.html                    # App shell — auth screen + main screen with #view + #bottom-nav
├── manifest.json                 # PWA install metadata
├── sw.js                         # Service worker: caches shell, handles offline queue flush
├── netlify.toml                  # Redirect all routes to index.html
├── .env.example                  # Template for config vars
├── .gitignore
├── CLAUDE.md                     # Co-pilot instructions + Supabase project ID
├── css/
│   ├── main.css                  # Design tokens, reset, layout, shared components
│   └── modules/
│       └── vocab.css             # Vocab module styles
├── js/
│   ├── config.js                 # SUPABASE_URL + SUPABASE_ANON_KEY (public, safe to commit)
│   ├── supabase.js               # Supabase client singleton → window.sb
│   ├── auth.js                   # Login form, session management, gate to main screen
│   ├── router.js                 # Hash router: maps #/route → module render fn
│   ├── nav.js                    # Bottom nav bar: renders icons, highlights active route
│   ├── srs.js                    # SM-2 algorithm — pure functions, no DOM
│   ├── sync.js                   # Offline queue: localStorage pending_sync → Supabase flush
│   └── modules/
│       ├── vocab.js              # Vocab: list, add card, review session, analytics
│       ├── grammar.js            # Stub
│       ├── listening.js          # Stub
│       ├── reading.js            # Stub
│       ├── speaking.js           # Stub
│       └── dashboard.js          # Stub
├── tests/
│   ├── srs.test.js               # SM-2 unit tests (Node.js built-in test runner)
│   └── sync.test.js              # Offline sync unit tests
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## Task 1: Supabase Project Setup

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `CLAUDE.md`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com → New project → name it `mi-espanol`. Note the project URL and anon key from Settings → API.

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
create extension if not exists "uuid-ossp";

create table vocab_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  spanish text not null,
  english text not null,
  example_sentence text,
  tags text[] default '{}',
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  due_date date default current_date,
  interval_days integer default 0,
  ease_factor decimal default 2.5,
  review_count integer default 0,
  notes text,
  created_at timestamptz default now()
);

create table grammar_exercises (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  topic text not null,
  prompt text not null,
  correct_answer text not null,
  difficulty text default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz default now()
);

create table grammar_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  exercise_id uuid references grammar_exercises not null,
  your_answer text not null,
  correct boolean not null,
  timestamp timestamptz default now()
);

create table listening_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  source text not null,
  date date default current_date,
  comprehension_rating integer check (comprehension_rating between 1 and 5),
  notes text,
  linked_vocab_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create table reading_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  source text not null,
  date date default current_date,
  comprehension_rating integer check (comprehension_rating between 1 and 5),
  notes text,
  linked_vocab_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create table speaking_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  date date default current_date,
  description text,
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  couldnt_say text,
  transcript text,
  created_at timestamptz default now()
);

create table daily_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  date date default current_date,
  stats_json jsonb default '{}',
  unique (user_id, date)
);

create table user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null unique,
  dark_mode boolean default true,
  streak_visible boolean default true,
  grammar_weak_topics text[] default '{}',
  vocab_goal integer default 3000,
  speaking_goal_per_week integer default 10,
  current_level text default 'intermediate',
  speaking_prompts text[] default '{}',
  updated_at timestamptz default now()
);

create table claude_log (
  id uuid primary key default uuid_generate_v4(),
  action_type text not null,
  description text not null,
  affected_table text,
  affected_ids uuid[] default '{}',
  timestamp timestamptz default now(),
  notes text
);

-- Enable RLS
alter table vocab_cards enable row level security;
alter table grammar_exercises enable row level security;
alter table grammar_attempts enable row level security;
alter table listening_log enable row level security;
alter table reading_log enable row level security;
alter table speaking_log enable row level security;
alter table daily_stats enable row level security;
alter table user_settings enable row level security;

-- Policies: each user can only touch their own rows
create policy "own_vocab" on vocab_cards for all using (auth.uid() = user_id);
create policy "own_grammar_ex" on grammar_exercises for all using (auth.uid() = user_id);
create policy "own_grammar_att" on grammar_attempts for all using (auth.uid() = user_id);
create policy "own_listening" on listening_log for all using (auth.uid() = user_id);
create policy "own_reading" on reading_log for all using (auth.uid() = user_id);
create policy "own_speaking" on speaking_log for all using (auth.uid() = user_id);
create policy "own_stats" on daily_stats for all using (auth.uid() = user_id);
create policy "own_settings" on user_settings for all using (auth.uid() = user_id);
```

- [ ] **Step 3: Run the migration in Supabase**

In the Supabase dashboard → SQL Editor → paste the full SQL above → Run. Verify all tables appear in Table Editor.

- [ ] **Step 4: Create .gitignore**

```
.env
node_modules/
.DS_Store
```

- [ ] **Step 5: Create .env.example**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 6: Create CLAUDE.md**

```markdown
# Mi Español — Claude Co-Pilot Guide

## Supabase Access
- Project ID: [FILL IN after creating project]
- Project URL: [FILL IN]
- Anon key: [FILL IN — safe to store here, RLS protects data]
- Use the Supabase MCP tool to query and write data directly

## Project Structure
- Each module is one file: `js/modules/<name>.js`
- Adding a new module: create the JS file, add a route in `js/router.js`, add a nav item in `js/nav.js`
- Schema: `supabase/migrations/001_initial_schema.sql`
- Spec: `docs/superpowers/specs/2026-07-13-spanish-learning-design.md`

## Common Tasks
- Add vocab cards: INSERT into `vocab_cards` table
- Add grammar exercises: INSERT into `grammar_exercises` table
- Analyze vocab retention: query `vocab_cards` where `review_count > 0`, group by tag
- Log what you did: INSERT into `claude_log`

## Current Level
Landry: intermediate-mid (B1). Goal: B2/C1 by June 2028.
```

- [ ] **Step 7: Commit**

```bash
git add supabase/ CLAUDE.md .gitignore .env.example
git commit -m "feat: supabase schema and project config"
```

---

## Task 2: App Shell

**Files:**
- Create: `index.html`
- Create: `netlify.toml`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0f172a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Mi Español">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <title>Mi Español</title>
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="/css/modules/vocab.css">
</head>
<body>
  <div id="auth-screen">
    <!-- Rendered by auth.js -->
  </div>
  <div id="main-screen" class="hidden">
    <main id="view"></main>
    <nav id="bottom-nav"></nav>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/js/config.js"></script>
  <script src="/js/supabase.js"></script>
  <script src="/js/srs.js"></script>
  <script src="/js/sync.js"></script>
  <script src="/js/modules/dashboard.js"></script>
  <script src="/js/modules/vocab.js"></script>
  <script src="/js/modules/grammar.js"></script>
  <script src="/js/modules/listening.js"></script>
  <script src="/js/modules/reading.js"></script>
  <script src="/js/modules/speaking.js"></script>
  <script src="/js/nav.js"></script>
  <script src="/js/router.js"></script>
  <script src="/js/auth.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create netlify.toml**

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 3: Commit**

```bash
git add index.html netlify.toml
git commit -m "feat: app shell"
```

---

## Task 3: PWA Manifest + Service Worker

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/` directory (placeholder icons)

- [ ] **Step 1: Create manifest.json**

```json
{
  "name": "Mi Español",
  "short_name": "Mi Español",
  "description": "Personal Spanish learning app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create placeholder icons**

```bash
mkdir -p icons
# Create 192x192 placeholder (solid teal square)
convert -size 192x192 xc:#0d9488 icons/icon-192.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/192/0d9488/ffffff?text=ES" -o icons/icon-192.png
# Create 512x512 placeholder
convert -size 512x512 xc:#0d9488 icons/icon-512.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/512/0d9488/ffffff?text=ES" -o icons/icon-512.png
```

If neither ImageMagick nor curl are available, create any 192×192 and 512×512 PNG files named `icon-192.png` and `icon-512.png` in the `icons/` folder. They can be replaced with real icons later.

- [ ] **Step 3: Create sw.js**

```javascript
const CACHE_NAME = 'mi-espanol-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/modules/vocab.css',
  '/js/config.js',
  '/js/supabase.js',
  '/js/srs.js',
  '/js/sync.js',
  '/js/nav.js',
  '/js/router.js',
  '/js/auth.js',
  '/js/modules/vocab.js',
  '/js/modules/grammar.js',
  '/js/modules/listening.js',
  '/js/modules/reading.js',
  '/js/modules/speaking.js',
  '/js/modules/dashboard.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network first for Supabase API calls
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // Cache first for shell files
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
```

- [ ] **Step 4: Register service worker in index.html**

Add before `</body>` in `index.html`:

```html
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  </script>
```

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js icons/ index.html
git commit -m "feat: PWA manifest and service worker"
```

---

## Task 4: CSS Design System

**Files:**
- Create: `css/main.css`
- Create: `css/modules/vocab.css`

- [ ] **Step 1: Create css/main.css**

```css
/* Design tokens */
:root {
  --bg: #ffffff;
  --bg-surface: #f8fafc;
  --bg-surface-2: #f1f5f9;
  --text: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --accent: #0d9488;
  --accent-hover: #0f766e;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --nav-height: 64px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --radius: 12px;
  --radius-sm: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f172a;
    --bg-surface: #1e293b;
    --bg-surface-2: #334155;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
    --border: #334155;
  }
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; -webkit-text-size-adjust: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100dvh;
  overflow-x: hidden;
}
button { cursor: pointer; border: none; background: none; font: inherit; }
input, textarea { font: inherit; }

/* App layout */
#auth-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
#main-screen {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
#view {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px calc(var(--nav-height) + var(--safe-bottom) + 16px);
}
.hidden { display: none !important; }

/* Bottom nav */
#bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 10px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}
.nav-item.active { color: var(--accent); }
.nav-item svg { width: 22px; height: 22px; }

/* Auth form */
.auth-card {
  width: 100%;
  max-width: 360px;
  background: var(--bg-surface);
  border-radius: var(--radius);
  padding: 32px 24px;
  border: 1px solid var(--border);
}
.auth-card h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.auth-card p { color: var(--text-muted); font-size: 14px; margin-bottom: 24px; }

/* Shared form components */
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
.field input, .field textarea, .field select {
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 16px; /* Prevents iOS zoom */
}
.field input:focus, .field textarea:focus {
  outline: none;
  border-color: var(--accent);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 600;
  transition: opacity 0.15s;
}
.btn:active { opacity: 0.8; }
.btn-primary { background: var(--accent); color: #fff; width: 100%; }
.btn-secondary {
  background: var(--bg-surface-2);
  color: var(--text);
  border: 1px solid var(--border);
}
.btn-danger { background: var(--danger); color: #fff; }

/* Cards */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
}

/* Page header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-header h2 { font-size: 20px; font-weight: 700; }

/* Error/status messages */
.msg-error { color: var(--danger); font-size: 14px; margin-top: 8px; }
.msg-success { color: var(--success); font-size: 14px; margin-top: 8px; }

/* Tag pills */
.tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-surface-2);
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Difficulty badge */
.badge-beginner { background: #dcfce7; color: #166534; }
.badge-intermediate { background: #fef9c3; color: #713f12; }
.badge-advanced { background: #fce7f3; color: #831843; }
@media (prefers-color-scheme: dark) {
  .badge-beginner { background: #14532d; color: #86efac; }
  .badge-intermediate { background: #422006; color: #fde68a; }
  .badge-advanced { background: #500724; color: #f9a8d4; }
}

/* Loading spinner */
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 40px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
}
.empty-state h3 { font-size: 16px; margin-bottom: 8px; }
.empty-state p { font-size: 14px; }
```

- [ ] **Step 2: Create css/modules/vocab.css**

```css
/* Review session */
.review-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px 24px;
  text-align: center;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.review-word {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}
.review-example {
  font-size: 14px;
  color: var(--text-muted);
  font-style: italic;
}
.review-answer {
  font-size: 20px;
  color: var(--accent);
  margin: 16px 0 4px;
}
.review-progress {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

/* Rating buttons */
.rating-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 16px;
}
.rating-btn {
  padding: 12px 4px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  border: 2px solid transparent;
}
.rating-btn[data-rating="1"] { background: #fee2e2; color: #991b1b; }
.rating-btn[data-rating="2"] { background: #fef3c7; color: #92400e; }
.rating-btn[data-rating="3"] { background: #d1fae5; color: #065f46; }
.rating-btn[data-rating="4"] { background: #dbeafe; color: #1e40af; }
@media (prefers-color-scheme: dark) {
  .rating-btn[data-rating="1"] { background: #450a0a; color: #fca5a5; }
  .rating-btn[data-rating="2"] { background: #451a03; color: #fcd34d; }
  .rating-btn[data-rating="3"] { background: #052e16; color: #86efac; }
  .rating-btn[data-rating="4"] { background: #1e3a5f; color: #93c5fd; }
}

/* Vocab list */
.vocab-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}
.vocab-item-text .spanish { font-weight: 600; }
.vocab-item-text .english { font-size: 13px; color: var(--text-muted); }
.vocab-item-meta { text-align: right; font-size: 12px; color: var(--text-muted); }

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}
.stat-number { font-size: 28px; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

/* Tab bar within vocab module */
.module-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-surface-2);
  border-radius: var(--radius-sm);
  padding: 4px;
  margin-bottom: 20px;
}
.module-tab {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  text-align: center;
  transition: all 0.15s;
}
.module-tab.active {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

- [ ] **Step 3: Commit**

```bash
git add css/
git commit -m "feat: CSS design system and vocab styles"
```

---

## Task 5: Supabase Client + Config

**Files:**
- Create: `js/config.js`
- Create: `js/supabase.js`

- [ ] **Step 1: Create js/config.js**

Fill in your actual values from the Supabase dashboard (Settings → API):

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

- [ ] **Step 2: Create js/supabase.js**

```javascript
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 3: Commit**

```bash
git add js/config.js js/supabase.js
git commit -m "feat: supabase client"
```

---

## Task 6: Auth

**Files:**
- Create: `js/auth.js`

- [ ] **Step 1: Create js/auth.js**

```javascript
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showMainScreen();
  } else {
    renderLoginForm();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showMainScreen();
    } else {
      showAuthScreen();
    }
  });
}

function renderLoginForm() {
  document.getElementById('auth-screen').innerHTML = `
    <div class="auth-card">
      <h1>Mi Español</h1>
      <p>Tu cuaderno de español</p>
      <form id="login-form">
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" required autocomplete="email">
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input type="password" id="password" required autocomplete="current-password">
        </div>
        <div id="auth-error" class="msg-error"></div>
        <button type="submit" class="btn btn-primary" style="margin-top:8px">Entrar</button>
      </form>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = '';

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) errorEl.textContent = error.message;
  });
}

function showMainScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  renderNav();
  router.navigate(location.hash || '#/vocab');
}

function showAuthScreen() {
  document.getElementById('main-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  renderLoginForm();
}

initAuth();
```

- [ ] **Step 2: Verify login works**

Open the app in a browser. You should see the login form. Create your account in Supabase dashboard (Authentication → Users → Add user) using your email. Test that login succeeds and shows the main screen (which will be blank — nav and router come next).

- [ ] **Step 3: Commit**

```bash
git add js/auth.js
git commit -m "feat: auth with supabase email login"
```

---

## Task 7: Hash Router + Navigation

**Files:**
- Create: `js/router.js`
- Create: `js/nav.js`

- [ ] **Step 1: Create js/router.js**

```javascript
const router = {
  routes: {},

  register(path, renderFn) {
    this.routes[path] = renderFn;
  },

  navigate(hash) {
    const path = hash.replace('#', '') || '/vocab';
    history.replaceState(null, '', '#' + path);
    const renderFn = this.routes[path];
    const view = document.getElementById('view');
    if (renderFn) {
      view.innerHTML = '';
      renderFn(view);
    } else {
      view.innerHTML = `<div class="empty-state"><h3>Página no encontrada</h3></div>`;
    }
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('href') === '#' + path);
    });
  },
};

window.addEventListener('hashchange', () => router.navigate(location.hash));
```

- [ ] **Step 2: Create js/nav.js**

```javascript
const NAV_ITEMS = [
  {
    href: '#/dashboard',
    label: 'Inicio',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
  },
  {
    href: '#/vocab',
    label: 'Vocab',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
  },
  {
    href: '#/grammar',
    label: 'Gramática',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>`
  },
  {
    href: '#/listening',
    label: 'Escuchar',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`
  },
  {
    href: '#/reading',
    label: 'Leer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`
  },
  {
    href: '#/speaking',
    label: 'Hablar',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
  },
];

function renderNav() {
  const nav = document.getElementById('bottom-nav');
  nav.innerHTML = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="nav-item">
      ${item.icon}
      <span>${item.label}</span>
    </a>
  `).join('');

  nav.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      router.navigate(el.getAttribute('href'));
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add js/router.js js/nav.js
git commit -m "feat: hash router and bottom navigation"
```

---

## Task 8: Module Stubs

**Files:**
- Create: `js/modules/grammar.js`
- Create: `js/modules/listening.js`
- Create: `js/modules/reading.js`
- Create: `js/modules/speaking.js`
- Create: `js/modules/dashboard.js`

- [ ] **Step 1: Create all stubs**

Create `js/modules/grammar.js`:
```javascript
function renderGrammar(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Gramática</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Ejercicios de gramática: subjuntivo, ser vs. estar, y más.</p>
    </div>
  `;
}
router.register('/grammar', renderGrammar);
```

Create `js/modules/listening.js`:
```javascript
function renderListening(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Escuchar</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Registra los podcasts y audios que escuchas en español.</p>
    </div>
  `;
}
router.register('/listening', renderListening);
```

Create `js/modules/reading.js`:
```javascript
function renderReading(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Leer</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Registra lo que lees en español.</p>
    </div>
  `;
}
router.register('/reading', renderReading);
```

Create `js/modules/speaking.js`:
```javascript
function renderSpeaking(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Hablar</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Registra tus conversaciones y practica tu confianza.</p>
    </div>
  `;
}
router.register('/speaking', renderSpeaking);
```

Create `js/modules/dashboard.js`:
```javascript
function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Inicio</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Tu progreso hacia la fluidez.</p>
    </div>
  `;
}
router.register('/dashboard', renderDashboard);
```

- [ ] **Step 2: Verify navigation**

Open the app, log in, and tap each nav item. You should see the stub pages render correctly. The nav items should highlight as active when selected.

- [ ] **Step 3: Commit**

```bash
git add js/modules/grammar.js js/modules/listening.js js/modules/reading.js js/modules/speaking.js js/modules/dashboard.js
git commit -m "feat: module stubs for all nav items"
```

---

## Task 9: SM-2 Algorithm (TDD)

**Files:**
- Create: `js/srs.js`
- Create: `tests/srs.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/srs.test.js` (imports from `js/srs.js` — which doesn't exist yet, so tests will fail):

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateNextReview } = require('../js/srs.js');

test('rating 1 (blackout) resets interval to 1', () => {
  const result = calculateNextReview(1, 10, 2.5);
  assert.equal(result.intervalDays, 1);
});

test('rating 2 (hard) resets interval to 1', () => {
  const result = calculateNextReview(2, 10, 2.5);
  assert.equal(result.intervalDays, 1);
});

test('first correct review sets interval to 1', () => {
  const result = calculateNextReview(3, 0, 2.5);
  assert.equal(result.intervalDays, 1);
});

test('second correct review sets interval to 6', () => {
  const result = calculateNextReview(3, 1, 2.5);
  assert.equal(result.intervalDays, 6);
});

test('subsequent correct review multiplies by ease factor', () => {
  const result = calculateNextReview(3, 6, 2.5);
  assert.equal(result.intervalDays, 15); // round(6 * 2.5)
});

test('rating 4 (easy) increases ease factor', () => {
  const result = calculateNextReview(4, 6, 2.5);
  assert.ok(result.easeFactor > 2.5);
});

test('rating 1 decreases ease factor but not below 1.3', () => {
  const result = calculateNextReview(1, 6, 1.3);
  assert.ok(result.easeFactor >= 1.3);
});

test('dueDate is a valid ISO date string', () => {
  const result = calculateNextReview(3, 6, 2.5);
  assert.match(result.dueDate, /^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/srs.test.js
```

Expected: FAIL — `Cannot find module '../js/srs.js'`

- [ ] **Step 3: Create js/srs.js with the implementation**

```javascript
function calculateNextReview(rating, intervalDays, easeFactor) {
  const quality = { 1: 0, 2: 2, 3: 4, 4: 5 }[rating];
  let newInterval;
  if (quality < 3) {
    newInterval = 1;
  } else if (intervalDays === 0) {
    newInterval = 1;
  } else if (intervalDays === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(intervalDays * easeFactor);
  }
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  const due = new Date();
  due.setDate(due.getDate() + newInterval);
  return {
    intervalDays: newInterval,
    easeFactor: parseFloat(newEaseFactor.toFixed(4)),
    dueDate: due.toISOString().split('T')[0],
  };
}

if (typeof module !== 'undefined') module.exports = { calculateNextReview };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test tests/srs.test.js
```

Expected: `✓ rating 1 (blackout) resets interval to 1` × 8 tests

- [ ] **Step 5: Commit**

```bash
git add js/srs.js tests/srs.test.js
git commit -m "feat: SM-2 spaced repetition algorithm with tests"
```

---

## Task 10: Offline Sync (TDD)

**Files:**
- Create: `js/sync.js`
- Create: `tests/sync.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/sync.test.js` (imports from `js/sync.js` — which doesn't exist yet):

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');

// sync.js uses localStorage — mock it before requiring the module
const store = {};
global.localStorage = {
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: k => { delete store[k]; },
};

const { sync } = require('../js/sync.js');

test('queue adds a review to localStorage', () => {
  sync.clear();
  sync.queue({ cardId: 'abc', rating: 3, intervalDays: 6, easeFactor: 2.5, dueDate: '2026-07-20' });
  const pending = sync.getPending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].cardId, 'abc');
});

test('queue appends without overwriting', () => {
  sync.clear();
  sync.queue({ cardId: 'abc', rating: 3, intervalDays: 1, easeFactor: 2.5, dueDate: '2026-07-14' });
  sync.queue({ cardId: 'def', rating: 4, intervalDays: 6, easeFactor: 2.6, dueDate: '2026-07-20' });
  assert.equal(sync.getPending().length, 2);
});

test('clear empties the queue', () => {
  sync.queue({ cardId: 'xyz', rating: 2, intervalDays: 1, easeFactor: 2.5, dueDate: '2026-07-14' });
  sync.clear();
  assert.equal(sync.getPending().length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/sync.test.js
```

Expected: FAIL — `Cannot find module '../js/sync.js'`

- [ ] **Step 3: Create js/sync.js**

```javascript
const SYNC_KEY = 'pending_sync';

const sync = {
  queue(review) {
    const pending = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
    pending.push({ ...review, queued_at: new Date().toISOString() });
    localStorage.setItem(SYNC_KEY, JSON.stringify(pending));
  },

  getPending() {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
  },

  clear() {
    localStorage.removeItem(SYNC_KEY);
  },

  async flush() {
    const pending = this.getPending();
    if (pending.length === 0) return;

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    for (const review of pending) {
      const { error } = await sb
        .from('vocab_cards')
        .update({
          interval_days: review.intervalDays,
          ease_factor: review.easeFactor,
          due_date: review.dueDate,
          review_count: review.reviewCount,
        })
        .eq('id', review.cardId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Sync failed for card', review.cardId, error);
        return; // Stop on error, try again next time
      }
    }
    this.clear();
  },
};

// Flush pending reviews whenever we come back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sync.flush());
}

if (typeof module !== 'undefined') module.exports = { sync };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test tests/sync.test.js
```

Expected: 3 passing tests

- [ ] **Step 5: Commit**

```bash
git add js/sync.js tests/sync.test.js
git commit -m "feat: offline sync queue for vocab reviews"
```

---

## Task 11: Vocabulary Module

**Files:**
- Create: `js/modules/vocab.js` (full implementation, replaces stub if one was made)

The vocab module has three internal tabs: Review, Cards, and Stats.

- [ ] **Step 1: Create js/modules/vocab.js**

```javascript
// ── Vocab DB helpers ──────────────────────────────────────────────────────────

async function getUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
}

async function fetchDueCards() {
  const userId = await getUserId();
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await sb
    .from('vocab_cards')
    .select('*')
    .eq('user_id', userId)
    .lte('due_date', today)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchAllCards() {
  const userId = await getUserId();
  const { data, error } = await sb
    .from('vocab_cards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertCard(card) {
  const userId = await getUserId();
  const { error } = await sb.from('vocab_cards').insert({ ...card, user_id: userId });
  if (error) throw error;
}

async function deleteCard(id) {
  const userId = await getUserId();
  const { error } = await sb.from('vocab_cards').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

async function updateCardSRS(id, { intervalDays, easeFactor, dueDate, reviewCount }) {
  const userId = await getUserId();
  const { error } = await sb
    .from('vocab_cards')
    .update({ interval_days: intervalDays, ease_factor: easeFactor, due_date: dueDate, review_count: reviewCount })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    // Offline: queue for later
    sync.queue({ cardId: id, intervalDays, easeFactor, dueDate, reviewCount });
  }
}

// ── Review session ────────────────────────────────────────────────────────────

function renderReviewSession(container, cards) {
  let index = 0;
  let revealed = false;

  function renderCard() {
    if (index >= cards.length) {
      container.innerHTML = `
        <div class="review-card">
          <div class="review-word">¡Listo! 🎉</div>
          <p style="color:var(--text-muted);margin-top:8px">Repasaste ${cards.length} tarjeta${cards.length !== 1 ? 's' : ''} hoy.</p>
        </div>
        <button class="btn btn-secondary" onclick="renderVocabModule(document.getElementById('view'))">Volver</button>
      `;
      return;
    }

    const card = cards[index];
    revealed = false;

    container.innerHTML = `
      <div class="review-progress">${index + 1} / ${cards.length}</div>
      <div class="review-card" id="review-card">
        <div class="review-word">${card.spanish}</div>
        ${card.example_sentence ? `<div class="review-example">${card.example_sentence}</div>` : ''}
        <div id="answer-area"></div>
      </div>
      <button class="btn btn-primary" id="reveal-btn">Ver respuesta</button>
      <div class="rating-buttons hidden" id="rating-btns">
        <button class="rating-btn" data-rating="1">1<br><span style="font-weight:400;font-size:11px">Nada</span></button>
        <button class="rating-btn" data-rating="2">2<br><span style="font-weight:400;font-size:11px">Difícil</span></button>
        <button class="rating-btn" data-rating="3">3<br><span style="font-weight:400;font-size:11px">Bien</span></button>
        <button class="rating-btn" data-rating="4">4<br><span style="font-weight:400;font-size:11px">Fácil</span></button>
      </div>
    `;

    document.getElementById('reveal-btn').addEventListener('click', () => {
      revealed = true;
      document.getElementById('answer-area').innerHTML = `
        <div class="review-answer">${card.english}</div>
        ${card.notes ? `<div class="review-example">${card.notes}</div>` : ''}
      `;
      document.getElementById('reveal-btn').classList.add('hidden');
      document.getElementById('rating-btns').classList.remove('hidden');
    });

    document.getElementById('rating-btns').addEventListener('click', async e => {
      const btn = e.target.closest('[data-rating]');
      if (!btn) return;
      const rating = parseInt(btn.dataset.rating);
      const next = calculateNextReview(rating, card.interval_days, card.ease_factor);
      await updateCardSRS(card.id, {
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        dueDate: next.dueDate,
        reviewCount: (card.review_count || 0) + 1,
      });
      index++;
      renderCard();
    });
  }

  renderCard();
}

// ── Add card form ─────────────────────────────────────────────────────────────

function renderAddCard(container, onBack) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Añadir tarjeta</h2>
      <button class="btn btn-secondary" id="back-btn" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <form id="add-card-form">
      <div class="field">
        <label>Español *</label>
        <input type="text" id="f-spanish" required placeholder="p.ej. tuanis">
      </div>
      <div class="field">
        <label>Inglés *</label>
        <input type="text" id="f-english" required placeholder="p.ej. cool, great">
      </div>
      <div class="field">
        <label>Oración de ejemplo</label>
        <input type="text" id="f-example" placeholder="p.ej. ¡Qué tuanis eso!">
      </div>
      <div class="field">
        <label>Etiquetas (separadas por coma)</label>
        <input type="text" id="f-tags" placeholder="p.ej. tico, informal">
      </div>
      <div class="field">
        <label>Dificultad</label>
        <select id="f-difficulty">
          <option value="beginner">Principiante</option>
          <option value="intermediate" selected>Intermedio</option>
          <option value="advanced">Avanzado</option>
        </select>
      </div>
      <div class="field">
        <label>Notas</label>
        <textarea id="f-notes" rows="2" placeholder="Contexto, usos, etc."></textarea>
      </div>
      <div id="add-error" class="msg-error"></div>
      <button type="submit" class="btn btn-primary">Guardar</button>
    </form>
  `;

  document.getElementById('back-btn').addEventListener('click', onBack);

  document.getElementById('add-card-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('add-error');
    errorEl.textContent = '';
    const rawTags = document.getElementById('f-tags').value;
    const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];
    try {
      await insertCard({
        spanish: document.getElementById('f-spanish').value.trim(),
        english: document.getElementById('f-english').value.trim(),
        example_sentence: document.getElementById('f-example').value.trim() || null,
        tags,
        difficulty: document.getElementById('f-difficulty').value,
        notes: document.getElementById('f-notes').value.trim() || null,
      });
      onBack();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ── Card list ─────────────────────────────────────────────────────────────────

async function renderCardList(container, onAddCard) {
  container.innerHTML = `<div class="spinner"></div>`;
  const cards = await fetchAllCards();

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No hay tarjetas todavía</h3>
        <p>Añade tu primera palabra en español.</p>
      </div>
      <button class="btn btn-primary" id="add-first-btn" style="margin-top:16px">+ Añadir tarjeta</button>
    `;
    document.getElementById('add-first-btn').addEventListener('click', onAddCard);
    return;
  }

  container.innerHTML = `
    <button class="btn btn-primary" id="add-btn" style="margin-bottom:16px">+ Añadir tarjeta</button>
    <div id="card-list">
      ${cards.map(card => `
        <div class="vocab-item" data-id="${card.id}">
          <div class="vocab-item-text">
            <div class="spanish">${card.spanish}</div>
            <div class="english">${card.english}</div>
          </div>
          <div class="vocab-item-meta">
            <span class="tag badge-${card.difficulty}">${card.difficulty}</span>
            <div style="margin-top:4px">Due: ${card.due_date}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('add-btn').addEventListener('click', onAddCard);

  document.getElementById('card-list').addEventListener('click', async e => {
    const item = e.target.closest('.vocab-item');
    if (!item) return;
    if (confirm(`¿Eliminar "${item.querySelector('.spanish').textContent}"?`)) {
      await deleteCard(item.dataset.id);
      item.remove();
    }
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderVocabStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const cards = await fetchAllCards();
  const today = new Date().toISOString().split('T')[0];

  const total = cards.length;
  const mastered = cards.filter(c => c.interval_days >= 21).length;
  const due = cards.filter(c => c.due_date <= today).length;
  const reviewed = cards.filter(c => c.review_count > 0).length;

  // Retention: of cards reviewed more than once, what % were rated 3+ last time
  // (We track last review via due_date proximity — approximate)
  const retention = reviewed > 0
    ? Math.round((mastered / reviewed) * 100)
    : 0;

  // Group by tag
  const tagMap = {};
  cards.forEach(card => {
    (card.tags || []).forEach(tag => {
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total de tarjetas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${mastered}</div>
        <div class="stat-label">Dominadas (21+ días)</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${due}</div>
        <div class="stat-label">Para repasar hoy</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${retention}%</div>
        <div class="stat-label">Retención estimada</div>
      </div>
    </div>
    ${topTags.length > 0 ? `
      <div class="card">
        <div style="font-weight:600;margin-bottom:12px">Por etiqueta</div>
        ${topTags.map(([tag, count]) => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px">
            <span class="tag">${tag}</span>
            <span style="color:var(--text-muted)">${count} tarjetas</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ── Main vocab module entry point ─────────────────────────────────────────────

async function renderVocabModule(container) {
  let activeTab = 'review';
  const tabs = [
    { id: 'review', label: 'Repasar' },
    { id: 'cards', label: 'Tarjetas' },
    { id: 'stats', label: 'Estadísticas' },
  ];

  async function renderTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.module-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabId);
    });

    const tabContent = document.getElementById('tab-content');

    if (tabId === 'review') {
      tabContent.innerHTML = `<div class="spinner"></div>`;
      const due = await fetchDueCards();
      if (due.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state">
            <h3>¡Todo al día!</h3>
            <p>No hay tarjetas para repasar hoy. Vuelve mañana.</p>
          </div>
        `;
      } else {
        tabContent.innerHTML = '';
        renderReviewSession(tabContent, due);
      }
    } else if (tabId === 'cards') {
      await renderCardList(tabContent, () => {
        tabContent.innerHTML = '';
        renderAddCard(tabContent, () => renderTab('cards'));
      });
    } else if (tabId === 'stats') {
      await renderVocabStats(tabContent);
    }
  }

  container.innerHTML = `
    <div class="page-header"><h2>Vocabulario</h2></div>
    <div class="module-tabs">
      ${tabs.map(t => `
        <button class="module-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">
          ${t.label}
        </button>
      `).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelector('.module-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) renderTab(btn.dataset.tab);
  });

  await renderTab('review');
}

router.register('/vocab', renderVocabModule);
```

- [ ] **Step 2: Test the full vocab flow manually**

Open the app. Go to Vocab → Repasar (should show "Todo al día" since no cards yet) → Tarjetas → "Añadir tarjeta". Add 3-4 test cards. Check they appear in the list. Navigate to Repasar — they should now show for review (due_date defaults to today). Complete a review session, rating each card. Check Estadísticas shows the correct counts.

- [ ] **Step 3: Commit**

```bash
git add js/modules/vocab.js
git commit -m "feat: vocabulary module with SM-2 review, card management, and stats"
```

---

## Task 12: Deploy to Netlify

**Files:**
- No new files

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/mi-espanol.git
git push -u origin main
```

- [ ] **Step 2: Deploy on Netlify**

Go to https://netlify.com → Add new site → Import from Git → Select your repo. No build command, publish directory is `/` (root). Click Deploy.

- [ ] **Step 3: Set environment variables**

In Netlify → Site settings → Environment variables, add:
- `SUPABASE_URL` = your project URL
- `SUPABASE_ANON_KEY` = your anon key

Then update `js/config.js` to use the values directly (Netlify doesn't inject env vars into vanilla JS — keep them in `config.js` directly, which is safe since the anon key is public).

- [ ] **Step 4: Update Supabase Auth allowed URLs**

In Supabase → Authentication → URL Configuration → add your Netlify URL to Redirect URLs (e.g., `https://your-app.netlify.app`).

- [ ] **Step 5: Install to iPhone**

Open the Netlify URL in Safari on your iPhone → Share → Add to Home Screen. Verify it opens full-screen with no browser chrome and all six nav items work.

- [ ] **Step 6: Smoke test on iPhone**

Log in, add a vocab card, complete a review. Confirm the SM-2 fields update correctly in Supabase (check Table Editor → vocab_cards).

- [ ] **Step 7: Commit CLAUDE.md with Supabase project details**

Fill in the project URL and anon key in `CLAUDE.md` so future Claude sessions can access the database directly:

```bash
git add CLAUDE.md
git commit -m "docs: add supabase project details to CLAUDE.md"
```

---

## What's Next

**Plan 2 — Log Modules:** Full implementations of Listening Log, Reading Log, and Speaking Log (including Web Speech API microphone integration and "save to vocab" cross-module linking).

**Plan 3 — Grammar + Dashboard:** Grammar exercise module with topic-based weighting, and the Dashboard with north star metrics, activity charts, and the daily speaking prompt system.
