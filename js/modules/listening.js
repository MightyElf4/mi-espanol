// ── DB helpers ────────────────────────────────────────────────────────────────

async function getListeningUserId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada — vuelve a entrar');
  return session.user.id;
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
          <button class="btn btn-danger l-delete" data-id="${e.id}" style="padding:6px 10px;font-size:12px;flex-shrink:0;margin-left:12px">✕</button>
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

// ── Discover (recommended resources) ──────────────────────────────────────────

async function fetchListeningResources() {
  const userId = await getListeningUserId();
  const { data, error } = await sb
    .from('content_library')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'listening')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

function renderResourceCards(container, resources) {
  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  const levelLabel = { beginner: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado' };
  const sorted = resources.slice().sort((a, b) => (levelOrder[a.difficulty] ?? 1) - (levelOrder[b.difficulty] ?? 1));

  container.innerHTML = `
    <div>
      ${sorted.map(r => `
        <div class="card" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <a href="${r.url}" target="_blank" rel="noopener" style="font-weight:600;color:var(--accent);text-decoration:none">${r.title} ↗</a>
            <span style="font-size:11px;color:var(--text-muted);flex-shrink:0">${levelLabel[r.difficulty] || r.difficulty}</span>
          </div>
          ${r.source ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${r.source}</div>` : ''}
          ${r.description ? `<div style="font-size:13px;margin-top:6px;line-height:1.4">${r.description}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function renderListeningDiscover(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const resources = await fetchListeningResources();
  if (resources.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Sin recomendaciones</h3><p>Claude añadirá recursos pronto.</p></div>`;
    return;
  }
  renderResourceCards(container, resources);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderListeningStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const entries = await fetchListeningLog();

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

async function renderListeningModule(container) {
  const tabs = [
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
    try {
      if (tabId === 'log') {
        renderListeningForm(tc, () => renderTab('history'));
      } else if (tabId === 'history') {
        await renderListeningHistory(tc, () => renderTab('log'));
      } else if (tabId === 'discover') {
        await renderListeningDiscover(tc);
      } else if (tabId === 'stats') {
        await renderListeningStats(tc);
      }
    } catch (err) {
      showLoadError(tc, err, () => renderTab(tabId));
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
