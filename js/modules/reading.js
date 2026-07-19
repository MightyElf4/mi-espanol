// ── DB helpers ────────────────────────────────────────────────────────────────

async function getReadingUserId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada — vuelve a entrar');
  return session.user.id;
}

async function fetchReadingLog() {
  const userId = await getReadingUserId();
  const { data, error } = await sb
    .from('reading_log')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertReadingEntry(entry) {
  const userId = await getReadingUserId();
  const { error } = await sb.from('reading_log').insert({ ...entry, user_id: userId });
  if (error) throw error;
}

async function deleteReadingEntry(id) {
  const userId = await getReadingUserId();
  const { error } = await sb.from('reading_log').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ── Log form ──────────────────────────────────────────────────────────────────

function renderReadingForm(container, onDone) {
  const today = new Date().toISOString().split('T')[0];
  container.innerHTML = `
    <div class="page-header">
      <h2>Registrar</h2>
      <button class="btn btn-secondary" id="read-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <form id="read-form">
      <div class="field">
        <label>Fuente / Título *</label>
        <input type="text" id="r-source" required placeholder="p.ej. BBC Mundo, artículo sobre economía">
      </div>
      <div class="field">
        <label>Fecha</label>
        <input type="date" id="r-date" value="${today}">
      </div>
      <div class="field">
        <label>Comprensión (1–5)</label>
        <select id="r-rating">
          <option value="1">1 — Casi nada</option>
          <option value="2">2 — Poco</option>
          <option value="3" selected>3 — La mitad</option>
          <option value="4">4 — Bastante</option>
          <option value="5">5 — Todo</option>
        </select>
      </div>
      <div class="field">
        <label>Notas</label>
        <textarea id="r-notes" rows="3" placeholder="Vocabulario nuevo, temas, dificultades..."></textarea>
      </div>
      <div id="r-error" class="msg-error"></div>
      <button type="submit" class="btn btn-primary">Guardar</button>
    </form>
  `;
  document.getElementById('read-back').addEventListener('click', onDone);
  document.getElementById('read-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('r-error');
    errorEl.textContent = '';
    try {
      await insertReadingEntry({
        source: document.getElementById('r-source').value.trim(),
        date: document.getElementById('r-date').value,
        comprehension_rating: parseInt(document.getElementById('r-rating').value),
        notes: document.getElementById('r-notes').value.trim() || null,
      });
      onDone();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ── History list ──────────────────────────────────────────────────────────────

async function renderReadingHistory(container, onAdd) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchReadingLog();

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state"><h3>Sin entradas</h3><p>Registra lo que lees en español.</p></div>
      <button class="btn btn-primary" id="r-add-first" style="margin-top:16px">+ Registrar</button>
    `;
    document.getElementById('r-add-first').addEventListener('click', onAdd);
    return;
  }

  const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

  container.innerHTML = `
    <button class="btn btn-primary" id="r-add-btn" style="margin-bottom:16px">+ Registrar</button>
    <div id="r-list">
      ${entries.map(e => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:flex-start" data-id="${e.id}">
          <div>
            <div style="font-weight:600">${e.source}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${e.date} · ${stars(e.comprehension_rating)}</div>
            ${e.notes ? `<div style="font-size:13px;margin-top:6px;color:var(--text-muted)">${e.notes}</div>` : ''}
          </div>
          <button class="btn btn-danger r-delete" data-id="${e.id}" style="padding:6px 10px;font-size:12px;flex-shrink:0;margin-left:12px">✕</button>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('r-add-btn').addEventListener('click', onAdd);
  document.getElementById('r-list').addEventListener('click', async e => {
    const btn = e.target.closest('.r-delete');
    if (!btn) return;
    if (!confirm('¿Eliminar esta entrada?')) return;
    await deleteReadingEntry(btn.dataset.id);
    btn.closest('.card').remove();
  });
}

// ── Discover (recommended resources) ──────────────────────────────────────────

async function fetchReadingResources() {
  const userId = await getReadingUserId();
  const { data, error } = await sb
    .from('content_library')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'reading')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function renderReadingDiscover(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const resources = await fetchReadingResources();
  if (resources.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Sin recomendaciones</h3><p>Claude añadirá recursos pronto.</p></div>`;
    return;
  }
  renderResourceCards(container, resources);
}

// ── Tap-a-word reader ─────────────────────────────────────────────────────────

async function fetchReadingTexts() {
  const userId = await getReadingUserId();
  const { data, error } = await sb
    .from('reading_texts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertReadingText(entry) {
  const userId = await getReadingUserId();
  const { error } = await sb.from('reading_texts').insert({ ...entry, source: 'pasted', user_id: userId });
  if (error) throw error;
}

async function deleteReadingText(id) {
  const userId = await getReadingUserId();
  const { error } = await sb.from('reading_texts').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

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

async function addVocabFromReading({ lemma, gloss, sentence }) {
  const userId = await getReadingUserId();
  const { error } = await sb.from('vocab_cards').insert({
    user_id: userId,
    spanish: lemma,
    english: gloss,
    example_sentence: sentence || null,
    tags: ['reading'],
  });
  if (error) throw error;
}

async function renderReadingLibrary(container, { onOpen, onPaste }) {
  container.innerHTML = `<div class="spinner"></div>`;
  const texts = await fetchReadingTexts();

  if (texts.length === 0) {
    container.innerHTML = `
      <div class="empty-state"><h3>Sin textos</h3><p>Pega un texto o espera los textos de Claude.</p></div>
      <button class="btn btn-primary" id="rt-paste-first" style="margin-top:16px">+ Pegar texto</button>
    `;
    document.getElementById('rt-paste-first').addEventListener('click', onPaste);
    return;
  }

  const words = body => `~${body.split(/\s+/).length} palabras`;

  container.innerHTML = `
    <button class="btn btn-primary" id="rt-paste-btn" style="margin-bottom:16px">+ Pegar texto</button>
    <div id="rt-list">
      ${texts.map(t => `
        <div class="card reader-text-row" data-id="${t.id}">
          <div style="min-width:0">
            <div style="font-weight:600">${escapeHtml(t.title)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
              ${t.difficulty} · ${t.source === 'seeded' ? 'Claude' : 'pegado'} · ${words(t.body)}
            </div>
          </div>
          ${t.source === 'pasted' ? `<button class="btn btn-danger rt-delete" data-id="${t.id}" style="padding:6px 10px;font-size:12px;flex-shrink:0;margin-left:12px">✕</button>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('rt-paste-btn').addEventListener('click', onPaste);
  document.getElementById('rt-list').addEventListener('click', async e => {
    const del = e.target.closest('.rt-delete');
    if (del) {
      if (!confirm('¿Eliminar este texto?')) return;
      await deleteReadingText(del.dataset.id);
      del.closest('.card').remove();
      return;
    }
    const row = e.target.closest('.reader-text-row');
    if (!row) return;
    const text = texts.find(t => t.id === row.dataset.id);
    if (text) onOpen(text);
  });
}

function renderReadingPasteForm(container, onDone) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Pegar texto</h2>
      <button class="btn btn-secondary" id="rt-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <form id="rt-form">
      <div class="field">
        <label>Título *</label>
        <input type="text" id="rt-title" required placeholder="p.ej. Artículo de La Nación">
      </div>
      <div class="field">
        <label>Texto *</label>
        <textarea id="rt-body" rows="10" required placeholder="Pega aquí el texto en español..."></textarea>
      </div>
      <div id="rt-error" class="msg-error"></div>
      <button type="submit" class="btn btn-primary">Guardar</button>
    </form>
  `;
  document.getElementById('rt-back').addEventListener('click', onDone);
  document.getElementById('rt-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('rt-error');
    errorEl.textContent = '';
    try {
      await insertReadingText({
        title: document.getElementById('rt-title').value.trim(),
        body: document.getElementById('rt-body').value.trim(),
      });
      onDone();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

function renderReadingTextView(container, text, onBack) {
  const paragraphs = text.body.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

  const paragraphHtml = (par, pIdx) =>
    `<p class="reader-p" data-p="${pIdx}">` +
    tokenize(par).map(tok =>
      tok.w ? `<span class="tw" data-i="${tok.i}">${escapeHtml(tok.s)}</span>` : escapeHtml(tok.s)
    ).join('') +
    `</p>`;

  container.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <h2 style="font-size:20px">${escapeHtml(text.title)}</h2>
      <button class="btn btn-secondary" id="rt-view-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <div id="reader-body">${paragraphs.map(paragraphHtml).join('')}</div>
    <div id="reader-sheet" class="reader-sheet" style="display:none"></div>
  `;

  document.getElementById('rt-view-back').addEventListener('click', onBack);

  const sheet = document.getElementById('reader-sheet');
  let activeSpan = null;

  function closeSheet() {
    sheet.style.display = 'none';
    sheet.innerHTML = '';
    if (activeSpan) { activeSpan.classList.remove('tw-active'); activeSpan = null; }
  }

  function renderSheet(result, sentence) {
    const dictUrl = `https://www.spanishdict.com/translate/${encodeURIComponent(result.form)}`;
    const entriesHtml = result.entries.length > 0
      ? result.entries.map((en, idx) => `
          <div class="reader-entry">
            <div>
              <span style="font-weight:700">${escapeHtml(en.lemma)}</span>
              <span class="pos-chip">${escapeHtml(en.pos)}</span>
              <div style="font-size:14px;color:var(--text-muted);margin-top:2px">${escapeHtml(en.gloss)}</div>
            </div>
            <button class="btn btn-secondary rs-add" data-idx="${idx}" style="padding:6px 10px;font-size:12px;flex-shrink:0">+ Vocabulario</button>
          </div>
        `).join('')
      : `<div style="color:var(--text-muted);font-size:14px;padding:8px 0">No está en el diccionario.
         <a href="${dictUrl}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">Buscar en SpanishDict →</a></div>`;

    sheet.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:700;font-size:17px">${escapeHtml(result.form)}</div>
        <button id="rs-close" class="btn btn-secondary" style="padding:4px 10px;font-size:13px">✕</button>
      </div>
      ${entriesHtml}
      <div id="rs-msg" style="font-size:13px;margin-top:6px"></div>
    `;
    sheet.style.display = 'block';

    document.getElementById('rs-close').addEventListener('click', closeSheet);
    sheet.querySelectorAll('.rs-add').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entry = result.entries[parseInt(btn.dataset.idx)];
        btn.disabled = true;
        try {
          await addVocabFromReading({ lemma: entry.lemma, gloss: entry.gloss, sentence });
          btn.textContent = '✓ Añadida';
        } catch (err) {
          btn.disabled = false;
          document.getElementById('rs-msg').innerHTML = `<span style="color:var(--danger)">${escapeHtml(err.message)}</span>`;
        }
      });
    });
  }

  document.getElementById('reader-body').addEventListener('click', async e => {
    const span = e.target.closest('.tw');
    if (!span) return;
    if (activeSpan) activeSpan.classList.remove('tw-active');
    activeSpan = span;
    span.classList.add('tw-active');

    const pIdx = parseInt(span.closest('.reader-p').dataset.p);
    const sentence = sentenceAt(paragraphs[pIdx], parseInt(span.dataset.i));

    sheet.innerHTML = `<div class="spinner" style="margin:8px auto"></div>`;
    sheet.style.display = 'block';
    try {
      renderSheet(await lookupWord(span.textContent), sentence);
    } catch (err) {
      sheet.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="color:var(--danger);font-size:14px">${escapeHtml(err.message)}</span>
          <button id="rs-close" class="btn btn-secondary" style="padding:4px 10px;font-size:13px">✕</button>
        </div>`;
      document.getElementById('rs-close').addEventListener('click', closeSheet);
    }
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderReadingStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchReadingLog();

  const total = entries.length;
  const avg = total > 0
    ? (Math.round(entries.reduce((s, e) => s + (e.comprehension_rating || 0), 0) / total * 10) / 10).toFixed(1)
    : '—';
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

async function renderReadingModule(container) {
  const tabs = [
    { id: 'leer', label: 'Leer' },
    { id: 'log', label: 'Registrar' },
    { id: 'history', label: 'Historial' },
    { id: 'discover', label: 'Descubrir' },
    { id: 'stats', label: 'Estadísticas' },
  ];

  async function renderTab(tabId) {
    document.querySelectorAll('.module-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId)
    );
    const tc = document.getElementById('tab-content');

    async function showLibrary() {
      try {
        await renderReadingLibrary(tc, {
          onOpen: text => renderReadingTextView(tc, text, showLibrary),
          onPaste: () => renderReadingPasteForm(tc, showLibrary),
        });
      } catch (err) {
        showLoadError(tc, err, showLibrary);
      }
    }

    try {
      if (tabId === 'leer') {
        await showLibrary();
      } else if (tabId === 'log') {
        renderReadingForm(tc, () => renderTab('history'));
      } else if (tabId === 'history') {
        await renderReadingHistory(tc, () => renderTab('log'));
      } else if (tabId === 'discover') {
        await renderReadingDiscover(tc);
      } else if (tabId === 'stats') {
        await renderReadingStats(tc);
      }
    } catch (err) {
      showLoadError(tc, err, () => renderTab(tabId));
    }
  }

  container.innerHTML = `
    <div class="page-header"><h2>Leer</h2></div>
    <div class="module-tabs">
      ${tabs.map(t => `<button class="module-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelector('.module-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) renderTab(btn.dataset.tab);
  });

  await renderTab('leer');
}

router.register('/reading', renderReadingModule);
