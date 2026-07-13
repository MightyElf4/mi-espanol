# Remaining Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build out the 5 stub modules: Listening Log, Reading Log, Speaking Log, Grammar, and Dashboard.

**Architecture:** Each module is a self-contained JS file in `js/modules/`. All modules follow the same pattern as `vocab.js`: a `getUserId()` call, Supabase queries, tab-based UI, and `router.register()` at the bottom. All CSS classes come from `css/main.css` and `css/modules/vocab.css` (already linked in index.html — no new CSS files needed).

**Tech Stack:** Vanilla JS, Supabase JS v2 (`sb` global), existing CSS design system.

---

## Context for all tasks

**Global available:** `sb` (Supabase client), `router` (hash router with `.register(path, fn)`)

**DB user pattern:**
```js
async function getUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
}
```

**CSS classes (all already in index.html):**
- Layout: `.page-header`, `.card`, `.field`, `.btn.btn-primary`, `.btn.btn-secondary`, `.btn.btn-danger`
- Tabs: `.module-tabs`, `.module-tab`, `.module-tab.active`
- Stats: `.stats-grid`, `.stat-card`, `.stat-number`, `.stat-label`
- Feedback: `.msg-error`, `.msg-success`, `.spinner`, `.empty-state`, `.hidden`, `.tag`

**Module router pattern:**
```js
router.register('/listening', renderListeningModule);
```

---

## Task 1: Listening Log Module

**Files:**
- Modify: `js/modules/listening.js` (replace stub, ~150 lines)

**DB schema — `listening_log` table:**
| column | type | notes |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | uuid | references auth.users |
| source | text | e.g. "Español con Juan ep.12" |
| date | date | defaults to CURRENT_DATE |
| comprehension_rating | integer | 1–5 |
| notes | text | nullable |
| linked_vocab_ids | uuid[] | nullable, ignore for now |
| created_at | timestamptz | auto |

**Tabs:** Registrar, Historial, Estadísticas

- [ ] **Step 1: Write renderListeningModule replacing the stub**

```js
// ── DB helpers ────────────────────────────────────────────────────────────────

async function getListeningUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
}

async function fetchListeningLog() {
  const userId = await getListeningUserId();
  const { data, error } = await sb
    .from('listening_log')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertListeningEntry(entry) {
  const userId = await getListeningUserId();
  const { error } = await sb.from('listening_log').insert({ ...entry, user_id: userId });
  if (error) throw error;
}

async function deleteListeningEntry(id) {
  const userId = await getListeningUserId();
  const { error } = await sb.from('listening_log').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ── Log form ──────────────────────────────────────────────────────────────────

function renderListeningForm(container, onDone) {
  const today = new Date().toISOString().split('T')[0];
  container.innerHTML = `
    <div class="page-header">
      <h2>Registrar</h2>
      <button class="btn btn-secondary" id="listen-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <form id="listen-form">
      <div class="field">
        <label>Fuente *</label>
        <input type="text" id="l-source" required placeholder="p.ej. Español con Juan ep.12">
      </div>
      <div class="field">
        <label>Fecha</label>
        <input type="date" id="l-date" value="${today}">
      </div>
      <div class="field">
        <label>Comprensión (1–5)</label>
        <select id="l-rating">
          <option value="1">1 — Casi nada</option>
          <option value="2">2 — Poco</option>
          <option value="3" selected>3 — La mitad</option>
          <option value="4">4 — Bastante</option>
          <option value="5">5 — Todo</option>
        </select>
      </div>
      <div class="field">
        <label>Notas</label>
        <textarea id="l-notes" rows="3" placeholder="Vocabulario nuevo, temas, etc."></textarea>
      </div>
      <div id="l-error" class="msg-error"></div>
      <button type="submit" class="btn btn-primary">Guardar</button>
    </form>
  `;
  document.getElementById('listen-back').addEventListener('click', onDone);
  document.getElementById('listen-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('l-error');
    errorEl.textContent = '';
    try {
      await insertListeningEntry({
        source: document.getElementById('l-source').value.trim(),
        date: document.getElementById('l-date').value,
        comprehension_rating: parseInt(document.getElementById('l-rating').value),
        notes: document.getElementById('l-notes').value.trim() || null,
      });
      onDone();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ── History list ──────────────────────────────────────────────────────────────

async function renderListeningHistory(container, onAdd) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchListeningLog();

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state"><h3>Sin entradas</h3><p>Registra lo que escuchas en español.</p></div>
      <button class="btn btn-primary" id="l-add-first" style="margin-top:16px">+ Registrar</button>
    `;
    document.getElementById('l-add-first').addEventListener('click', onAdd);
    return;
  }

  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  container.innerHTML = `
    <button class="btn btn-primary" id="l-add-btn" style="margin-bottom:16px">+ Registrar</button>
    <div id="l-list">
      ${entries.map(e => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:flex-start" data-id="${e.id}">
          <div>
            <div style="font-weight:600">${e.source}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${e.date} · ${stars(e.comprehension_rating)}</div>
            ${e.notes ? `<div style="font-size:13px;margin-top:6px;color:var(--text-muted)">${e.notes}</div>` : ''}
          </div>
          <button class="btn btn-danger l-delete" data-id="${e.id}" style="padding:6px 10px;font-size:12px">✕</button>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('l-add-btn').addEventListener('click', onAdd);
  document.getElementById('l-list').addEventListener('click', async e => {
    const btn = e.target.closest('.l-delete');
    if (!btn) return;
    if (!confirm('¿Eliminar esta entrada?')) return;
    await deleteListeningEntry(btn.dataset.id);
    btn.closest('.card').remove();
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderListeningStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchListeningLog();

  const total = entries.length;
  const avg = total > 0
    ? Math.round(entries.reduce((s, e) => s + (e.comprehension_rating || 0), 0) / total * 10) / 10
    : 0;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = entries.filter(e => new Date(e.date) >= weekAgo).length;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Total sesiones</div></div>
      <div class="stat-card"><div class="stat-number">${thisWeek}</div><div class="stat-label">Esta semana</div></div>
      <div class="stat-card"><div class="stat-number">${avg}/5</div><div class="stat-label">Comprensión media</div></div>
    </div>
  `;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function renderListeningModule(container) {
  const tabs = [
    { id: 'log', label: 'Registrar' },
    { id: 'history', label: 'Historial' },
    { id: 'stats', label: 'Estadísticas' },
  ];

  async function renderTab(tabId) {
    document.querySelectorAll('.module-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId)
    );
    const tc = document.getElementById('tab-content');
    if (tabId === 'log') {
      renderListeningForm(tc, () => renderTab('history'));
    } else if (tabId === 'history') {
      await renderListeningHistory(tc, () => renderTab('log'));
    } else if (tabId === 'stats') {
      await renderListeningStats(tc);
    }
  }

  container.innerHTML = `
    <div class="page-header"><h2>Escuchar</h2></div>
    <div class="module-tabs">
      ${tabs.map(t => `<button class="module-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelector('.module-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) renderTab(btn.dataset.tab);
  });

  await renderTab('log');
}

router.register('/listening', renderListeningModule);
```

- [ ] **Step 2: Commit**
```bash
git add js/modules/listening.js
git commit -m "feat: build listening log module"
```

---

## Task 2: Reading Log Module

**Files:**
- Modify: `js/modules/reading.js` (replace stub, ~150 lines)

**DB schema — `reading_log` table:** Same structure as listening_log (source, date, comprehension_rating 1-5, notes, linked_vocab_ids).

- [ ] **Step 1: Write renderReadingModule replacing the stub**

Identical structure to listening but:
- Function name prefix: `Reading` / `reading` / `r-`
- `router.register('/reading', renderReadingModule)`
- Table: `reading_log`
- Label changes: "Fuente" → "Fuente / Título", placeholder → "p.ej. BBC Mundo, El País", page header "Leer"
- Form field: add a `type` select (Artículo, Libro, Redes sociales, Subtítulos, Otro) stored in `notes` prefixed as `[Artículo] ...` — actually simpler: just show as source type label in historial. Or: keep it simple and just use source field, same as listening.

```js
// Full implementation mirrors listening.js exactly, replacing:
// - "listen" / "l-" → "reading" / "r-"
// - 'listening_log' → 'reading_log'
// - renderListeningModule → renderReadingModule
// - router.register('/listening', ...) → router.register('/reading', ...)
// - Page title "Escuchar" → "Leer"
// - Form placeholder "p.ej. Español con Juan ep.12" → "p.ej. BBC Mundo, artículo sobre economía"
// - Empty state: "Registra lo que lees en español."
```

- [ ] **Step 2: Commit**
```bash
git add js/modules/reading.js
git commit -m "feat: build reading log module"
```

---

## Task 3: Speaking Log Module

**Files:**
- Modify: `js/modules/speaking.js` (replace stub, ~160 lines)

**DB schema — `speaking_log` table:**
| column | type | notes |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | uuid | |
| date | date | |
| description | text | what you spoke about |
| difficulty_rating | integer | 1–5 |
| couldnt_say | text | nullable — words/phrases you wanted but couldn't express |
| transcript | text | nullable — optional notes/transcript |
| created_at | timestamptz | |

- [ ] **Step 1: Write renderSpeakingModule replacing the stub**

```js
// ── DB helpers ────────────────────────────────────────────────────────────────

async function getSpeakingUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
}

async function fetchSpeakingLog() {
  const userId = await getSpeakingUserId();
  const { data, error } = await sb
    .from('speaking_log')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertSpeakingEntry(entry) {
  const userId = await getSpeakingUserId();
  const { error } = await sb.from('speaking_log').insert({ ...entry, user_id: userId });
  if (error) throw error;
}

async function deleteSpeakingEntry(id) {
  const userId = await getSpeakingUserId();
  const { error } = await sb.from('speaking_log').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ── Log form ──────────────────────────────────────────────────────────────────

function renderSpeakingForm(container, onDone) {
  const today = new Date().toISOString().split('T')[0];
  container.innerHTML = `
    <div class="page-header">
      <h2>Registrar</h2>
      <button class="btn btn-secondary" id="sp-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <form id="sp-form">
      <div class="field">
        <label>¿De qué hablaste? *</label>
        <input type="text" id="sp-desc" required placeholder="p.ej. Conversación con vecinos sobre el proyecto">
      </div>
      <div class="field">
        <label>Fecha</label>
        <input type="date" id="sp-date" value="${today}">
      </div>
      <div class="field">
        <label>Dificultad (1–5)</label>
        <select id="sp-rating">
          <option value="1">1 — Muy fácil</option>
          <option value="2">2 — Fácil</option>
          <option value="3" selected>3 — Normal</option>
          <option value="4">4 — Difícil</option>
          <option value="5">5 — Muy difícil</option>
        </select>
      </div>
      <div class="field">
        <label>No pude decir...</label>
        <textarea id="sp-couldnt" rows="2" placeholder="Palabras o frases que quisiste decir pero no pudiste"></textarea>
      </div>
      <div class="field">
        <label>Notas adicionales</label>
        <textarea id="sp-notes" rows="2" placeholder="Temas tratados, errores frecuentes, etc."></textarea>
      </div>
      <div id="sp-error" class="msg-error"></div>
      <button type="submit" class="btn btn-primary">Guardar</button>
    </form>
  `;
  document.getElementById('sp-back').addEventListener('click', onDone);
  document.getElementById('sp-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('sp-error');
    errorEl.textContent = '';
    try {
      await insertSpeakingEntry({
        description: document.getElementById('sp-desc').value.trim(),
        date: document.getElementById('sp-date').value,
        difficulty_rating: parseInt(document.getElementById('sp-rating').value),
        couldnt_say: document.getElementById('sp-couldnt').value.trim() || null,
        transcript: document.getElementById('sp-notes').value.trim() || null,
      });
      onDone();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ── History list ──────────────────────────────────────────────────────────────

async function renderSpeakingHistory(container, onAdd) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchSpeakingLog();

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state"><h3>Sin entradas</h3><p>Registra tus conversaciones en español.</p></div>
      <button class="btn btn-primary" id="sp-add-first" style="margin-top:16px">+ Registrar</button>
    `;
    document.getElementById('sp-add-first').addEventListener('click', onAdd);
    return;
  }

  const diffLabel = n => ['','Muy fácil','Fácil','Normal','Difícil','Muy difícil'][n] || n;

  container.innerHTML = `
    <button class="btn btn-primary" id="sp-add-btn" style="margin-bottom:16px">+ Registrar</button>
    <div id="sp-list">
      ${entries.map(e => `
        <div class="card" data-id="${e.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:600">${e.description}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${e.date} · Dificultad: ${diffLabel(e.difficulty_rating)}</div>
              ${e.couldnt_say ? `<div style="font-size:13px;margin-top:6px"><span style="color:var(--text-muted)">No pude decir:</span> ${e.couldnt_say}</div>` : ''}
            </div>
            <button class="btn btn-danger sp-delete" data-id="${e.id}" style="padding:6px 10px;font-size:12px">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('sp-add-btn').addEventListener('click', onAdd);
  document.getElementById('sp-list').addEventListener('click', async e => {
    const btn = e.target.closest('.sp-delete');
    if (!btn) return;
    if (!confirm('¿Eliminar esta entrada?')) return;
    await deleteSpeakingEntry(btn.dataset.id);
    btn.closest('.card').remove();
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderSpeakingStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchSpeakingLog();

  const total = entries.length;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = entries.filter(e => new Date(e.date) >= weekAgo).length;
  const avgDiff = total > 0
    ? Math.round(entries.reduce((s, e) => s + (e.difficulty_rating || 0), 0) / total * 10) / 10
    : 0;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Total sesiones</div></div>
      <div class="stat-card"><div class="stat-number">${thisWeek}</div><div class="stat-label">Esta semana</div></div>
      <div class="stat-card"><div class="stat-number">${avgDiff}/5</div><div class="stat-label">Dificultad media</div></div>
    </div>
  `;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function renderSpeakingModule(container) {
  const tabs = [
    { id: 'log', label: 'Registrar' },
    { id: 'history', label: 'Historial' },
    { id: 'stats', label: 'Estadísticas' },
  ];

  async function renderTab(tabId) {
    document.querySelectorAll('.module-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId)
    );
    const tc = document.getElementById('tab-content');
    if (tabId === 'log') {
      renderSpeakingForm(tc, () => renderTab('history'));
    } else if (tabId === 'history') {
      await renderSpeakingHistory(tc, () => renderTab('log'));
    } else if (tabId === 'stats') {
      await renderSpeakingStats(tc);
    }
  }

  container.innerHTML = `
    <div class="page-header"><h2>Hablar</h2></div>
    <div class="module-tabs">
      ${tabs.map(t => `<button class="module-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelector('.module-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) renderTab(btn.dataset.tab);
  });

  await renderTab('log');
}

router.register('/speaking', renderSpeakingModule);
```

- [ ] **Step 2: Commit**
```bash
git add js/modules/speaking.js
git commit -m "feat: build speaking log module"
```

---

## Task 4: Grammar Module

**Files:**
- Modify: `js/modules/grammar.js` (replace stub, ~200 lines)

**DB schemas:**

`grammar_exercises`:
| column | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| topic | text | e.g. "subjuntivo", "ser vs estar" |
| prompt | text | the question/sentence with blank or instruction |
| correct_answer | text | the correct answer string |
| difficulty | text | 'beginner', 'intermediate', 'advanced' |

`grammar_attempts`:
| column | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| exercise_id | uuid | |
| your_answer | text | |
| correct | boolean | |
| timestamp | timestamptz | |

**UI:** Show one exercise at a time. User types answer. On submit, compare (case-insensitive, trimmed) to correct_answer, show feedback, log attempt, then offer Next button.

- [ ] **Step 1: Write renderGrammarModule replacing the stub**

```js
// ── DB helpers ────────────────────────────────────────────────────────────────

async function getGrammarUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
}

async function fetchGrammarExercises(difficulty) {
  const userId = await getGrammarUserId();
  let query = sb.from('grammar_exercises').select('*').eq('user_id', userId);
  if (difficulty) query = query.eq('difficulty', difficulty);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function logGrammarAttempt(exerciseId, yourAnswer, correct) {
  const userId = await getGrammarUserId();
  await sb.from('grammar_attempts').insert({
    user_id: userId,
    exercise_id: exerciseId,
    your_answer: yourAnswer,
    correct,
  });
}

async function fetchGrammarStats() {
  const userId = await getGrammarUserId();
  const { data, error } = await sb
    .from('grammar_attempts')
    .select('correct')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

// ── Practice session ──────────────────────────────────────────────────────────

async function renderGrammarPractice(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const exercises = await fetchGrammarExercises();

  if (exercises.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Sin ejercicios todavía</h3>
        <p>Claude añadirá ejercicios de gramática personalizados pronto.</p>
      </div>
    `;
    return;
  }

  let index = 0;
  let answered = false;

  function renderExercise() {
    if (index >= exercises.length) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:32px">
          <div style="font-size:32px;margin-bottom:12px">🎉</div>
          <div style="font-weight:600;font-size:18px">¡Terminaste!</div>
          <p style="color:var(--text-muted);margin:8px 0 20px">Completaste ${exercises.length} ejercicio${exercises.length !== 1 ? 's' : ''}.</p>
          <button class="btn btn-primary" onclick="renderGrammarModule(document.getElementById('view'))">Volver a empezar</button>
        </div>
      `;
      return;
    }

    const ex = exercises[index];
    answered = false;

    container.innerHTML = `
      <div class="review-progress">${index + 1} / ${exercises.length}</div>
      <div class="card" style="margin-bottom:16px">
        <div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:8px;text-transform:uppercase">${ex.topic}</div>
        <div style="font-size:18px;font-weight:600;line-height:1.4">${ex.prompt}</div>
      </div>
      <form id="grammar-form">
        <div class="field">
          <label>Tu respuesta</label>
          <input type="text" id="g-answer" placeholder="Escribe tu respuesta aquí" autocomplete="off" autocorrect="off" autocapitalize="off">
        </div>
        <div id="g-feedback"></div>
        <div id="g-actions">
          <button type="submit" class="btn btn-primary">Comprobar</button>
        </div>
      </form>
    `;

    document.getElementById('g-answer').focus();

    document.getElementById('grammar-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (answered) return;
      answered = true;

      const input = document.getElementById('g-answer').value.trim();
      const correct = input.toLowerCase() === ex.correct_answer.toLowerCase();
      await logGrammarAttempt(ex.id, input, correct);

      const feedbackEl = document.getElementById('g-feedback');
      feedbackEl.innerHTML = correct
        ? `<div class="msg-success" style="font-size:15px;margin-bottom:12px">✓ ¡Correcto!</div>`
        : `<div class="msg-error" style="font-size:15px;margin-bottom:4px">✗ Incorrecto</div>
           <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px">Respuesta correcta: <strong>${ex.correct_answer}</strong></div>`;

      document.getElementById('g-actions').innerHTML = `
        <button class="btn btn-primary" id="g-next">Siguiente →</button>
      `;
      document.getElementById('g-next').addEventListener('click', () => {
        index++;
        renderExercise();
      });
    });
  }

  renderExercise();
}

// ── Exercise list ─────────────────────────────────────────────────────────────

async function renderGrammarList(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const exercises = await fetchGrammarExercises();

  if (exercises.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Sin ejercicios</h3><p>Claude añadirá ejercicios pronto.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div id="g-list">
      ${exercises.map(ex => `
        <div class="card" style="margin-bottom:8px">
          <div style="font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;margin-bottom:4px">${ex.topic}</div>
          <div style="font-weight:500">${ex.prompt}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Respuesta: ${ex.correct_answer}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderGrammarStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const attempts = await fetchGrammarStats();

  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Intentos totales</div></div>
      <div class="stat-card"><div class="stat-number">${pct}%</div><div class="stat-label">Aciertos</div></div>
    </div>
  `;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function renderGrammarModule(container) {
  const tabs = [
    { id: 'practice', label: 'Practicar' },
    { id: 'list', label: 'Ejercicios' },
    { id: 'stats', label: 'Estadísticas' },
  ];

  async function renderTab(tabId) {
    document.querySelectorAll('.module-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId)
    );
    const tc = document.getElementById('tab-content');
    if (tabId === 'practice') {
      await renderGrammarPractice(tc);
    } else if (tabId === 'list') {
      await renderGrammarList(tc);
    } else if (tabId === 'stats') {
      await renderGrammarStats(tc);
    }
  }

  container.innerHTML = `
    <div class="page-header"><h2>Gramática</h2></div>
    <div class="module-tabs">
      ${tabs.map(t => `<button class="module-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelector('.module-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) renderTab(btn.dataset.tab);
  });

  await renderTab('practice');
}

router.register('/grammar', renderGrammarModule);
```

- [ ] **Step 2: Commit**
```bash
git add js/modules/grammar.js
git commit -m "feat: build grammar practice module"
```

---

## Task 5: Dashboard Module

**Files:**
- Modify: `js/modules/dashboard.js` (replace stub, ~150 lines)

**Data sources queried:**
- `vocab_cards`: count all, count due today (due_date <= today)
- `listening_log`: count entries this week
- `reading_log`: count entries this week
- `speaking_log`: count entries this week

**UI:** Single view, no tabs. Shows:
1. Greeting + today's date
2. Vocab stat: cards due today (big number, link to /vocab)
3. This week activity grid: listening, reading, speaking counts
4. Total vocab cards in deck

- [ ] **Step 1: Write renderDashboard replacing the stub**

```js
async function renderDashboard(container) {
  container.innerHTML = `<div class="spinner"></div>`;

  try {
    const { data: { user } } = await sb.auth.getUser();
    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const [
      { data: allCards },
      { data: dueCards },
      { data: listeningWeek },
      { data: readingWeek },
      { data: speakingWeek },
    ] = await Promise.all([
      sb.from('vocab_cards').select('id').eq('user_id', userId),
      sb.from('vocab_cards').select('id').eq('user_id', userId).lte('due_date', today),
      sb.from('listening_log').select('id').eq('user_id', userId).gte('date', weekAgoStr),
      sb.from('reading_log').select('id').eq('user_id', userId).gte('date', weekAgoStr),
      sb.from('speaking_log').select('id').eq('user_id', userId).gte('date', weekAgoStr),
    ]);

    const totalCards = allCards?.length || 0;
    const dueCount = dueCards?.length || 0;
    const listenCount = listeningWeek?.length || 0;
    const readCount = readingWeek?.length || 0;
    const speakCount = speakingWeek?.length || 0;

    const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const greeting = `${days[new Date().getDay()]}, ${today}`;

    container.innerHTML = `
      <div class="page-header"><h2>Inicio</h2></div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">${greeting}</div>

      <div class="card" style="margin-bottom:16px;cursor:pointer" id="vocab-cta">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Para repasar hoy</div>
        <div style="display:flex;align-items:baseline;gap:8px">
          <div style="font-size:42px;font-weight:700;color:${dueCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}">${dueCount}</div>
          <div style="font-size:14px;color:var(--text-muted)">tarjeta${dueCount !== 1 ? 's' : ''} de vocabulario</div>
        </div>
        ${dueCount > 0 ? `<div style="font-size:13px;color:var(--accent);margin-top:8px">Ir a repasar →</div>` : `<div style="font-size:13px;color:var(--text-muted);margin-top:8px">¡Todo al día!</div>`}
      </div>

      <div style="font-weight:600;font-size:14px;margin-bottom:12px">Esta semana</div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="stat-card"><div class="stat-number">${listenCount}</div><div class="stat-label">Escuchar</div></div>
        <div class="stat-card"><div class="stat-number">${readCount}</div><div class="stat-label">Leer</div></div>
        <div class="stat-card"><div class="stat-number">${speakCount}</div><div class="stat-label">Hablar</div></div>
      </div>

      <div style="font-weight:600;font-size:14px;margin-bottom:12px">Vocabulario</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${totalCards}</div><div class="stat-label">Total de tarjetas</div></div>
        <div class="stat-card"><div class="stat-number">B1→B2</div><div class="stat-label">Nivel actual</div></div>
      </div>
    `;

    document.getElementById('vocab-cta').addEventListener('click', () => {
      router.navigate('#/vocab');
    });

  } catch (err) {
    container.innerHTML = `<div class="msg-error">${err.message}</div>`;
  }
}

router.register('/dashboard', renderDashboard);
```

- [ ] **Step 2: Commit**
```bash
git add js/modules/dashboard.js
git commit -m "feat: build dashboard module"
```

---

## Final step: Push all changes

```bash
git push
```
