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

  const diffLabel = n => ['', 'Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil'][n] || n;

  container.innerHTML = `
    <button class="btn btn-primary" id="sp-add-btn" style="margin-bottom:16px">+ Registrar</button>
    <div id="sp-list">
      ${entries.map(e => `
        <div class="card" data-id="${e.id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:600">${e.description}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${e.date} · ${diffLabel(e.difficulty_rating)}</div>
              ${e.couldnt_say ? `<div style="font-size:13px;margin-top:6px"><span style="color:var(--text-muted)">No pude decir:</span> ${e.couldnt_say}</div>` : ''}
            </div>
            <button class="btn btn-danger sp-delete" data-id="${e.id}" style="padding:6px 10px;font-size:12px;flex-shrink:0;margin-left:12px">✕</button>
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
    ? (Math.round(entries.reduce((s, e) => s + (e.difficulty_rating || 0), 0) / total * 10) / 10).toFixed(1)
    : '—';

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
