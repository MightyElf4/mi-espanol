// ── DB helpers ────────────────────────────────────────────────────────────────

async function getReadingUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
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
      renderReadingForm(tc, () => renderTab('history'));
    } else if (tabId === 'history') {
      await renderReadingHistory(tc, () => renderTab('log'));
    } else if (tabId === 'stats') {
      await renderReadingStats(tc);
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

  await renderTab('log');
}

router.register('/reading', renderReadingModule);
