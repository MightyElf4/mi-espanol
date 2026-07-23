// ── Vocab DB helpers ──────────────────────────────────────────────────────────

async function getUserId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada — vuelve a entrar');
  return session.user.id;
}

async function fetchDueCards() {
  try {
    const userId = await getUserId();
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb
      .from('vocab_cards')
      .select('*')
      .eq('user_id', userId)
      .lte('due_date', today)
      .order('due_date', { ascending: true });
    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
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
    sync.queue({ cardId: id, intervalDays, easeFactor, dueDate, reviewCount });
  }
}

async function recordDailyReview() {
  try {
    const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
    if (!session) return;
    const userId = session.user.id;
    const today = new Date().toISOString().split('T')[0];

    const { data } = await sb.from('daily_stats')
      .select('id, stats_json')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
      .catch(() => ({ data: null }));

    if (data) {
      const currentStats = data.stats_json || {};
      const newCount = (currentStats.vocab_reviews || 0) + 1;
      await sb.from('daily_stats')
        .update({ stats_json: { ...currentStats, vocab_reviews: newCount } })
        .eq('id', data.id)
        .catch(e => console.warn('Non-blocking update error:', e));
    } else {
      await sb.from('daily_stats').insert({
        user_id: userId,
        date: today,
        stats_json: { vocab_reviews: 1 }
      }).catch(e => console.warn('Non-blocking insert error:', e));
    }
  } catch (err) {
    console.warn('Non-blocking daily_stats update ignored:', err);
  }
}

// ── Review session ────────────────────────────────────────────────────────────

function renderReviewSession(container, cards) {
  let index = 0;
  const sessionRatings = { again: 0, hard: 0, good: 0, easy: 0 };

  function renderCard() {
    if (index >= cards.length) {
      const total = cards.length;
      const remembered = sessionRatings.good + sessionRatings.easy;
      const accuracyPct = total > 0 ? Math.round((remembered / total) * 100) : 100;

      container.innerHTML = `
        <div class="review-card" style="padding:28px 16px;text-align:center">
          <div style="font-size:42px;margin-bottom:8px">🎉</div>
          <h2 style="font-size:22px;font-weight:800;margin-bottom:4px">¡Sesión Completada!</h2>
          <div style="font-size:36px;font-weight:800;color:var(--accent);margin:12px 0">${total} / ${total}</div>
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">${accuracyPct}% de precisión en esta sesión.</p>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:20px;text-align:center">
            <div style="background:rgba(239,68,68,0.1);padding:10px 4px;border-radius:8px">
              <div style="font-size:16px;font-weight:700;color:#ef4444">${sessionRatings.again}</div>
              <div style="font-size:10px;color:var(--text-muted)">Otra vez</div>
            </div>
            <div style="background:rgba(245,158,11,0.1);padding:10px 4px;border-radius:8px">
              <div style="font-size:16px;font-weight:700;color:#f59e0b">${sessionRatings.hard}</div>
              <div style="font-size:10px;color:var(--text-muted)">Difícil</div>
            </div>
            <div style="background:rgba(16,185,129,0.1);padding:10px 4px;border-radius:8px">
              <div style="font-size:16px;font-weight:700;color:#10b981">${sessionRatings.good}</div>
              <div style="font-size:10px;color:var(--text-muted)">Bien</div>
            </div>
            <div style="background:rgba(59,130,246,0.1);padding:10px 4px;border-radius:8px">
              <div style="font-size:16px;font-weight:700;color:#3b82f6">${sessionRatings.easy}</div>
              <div style="font-size:10px;color:var(--text-muted)">Fácil</div>
            </div>
          </div>

          <button class="btn btn-primary" onclick="renderVocabModule(document.getElementById('view'))">Continuar →</button>
        </div>
      `;
      return;
    }

    const card = cards[index];

    container.innerHTML = `
      <div class="review-progress" style="font-weight:700;font-size:13px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <span>Tarjeta ${index + 1} de ${cards.length}</span>
        <span style="font-size:11px;color:var(--accent);background:rgba(13,148,136,0.1);padding:2px 8px;border-radius:10px">SRS Flow</span>
      </div>
      <div class="review-card" id="review-card" style="cursor:pointer">
        ${card.image_url ? `<div class="card-img-container"><img src="${card.image_url}" alt="Visual context"></div>` : ''}
        <div class="review-word">${card.spanish}</div>
        ${card.example_sentence ? `<div class="review-example" style="margin-top:8px">${card.example_sentence}</div>` : ''}
        <div id="answer-area" style="width:100%"></div>
      </div>
      <button class="btn btn-primary" id="reveal-btn" style="margin-top:12px">Ver respuesta 👆</button>
      <div class="thumb-controls hidden" id="rating-btns">
        <button class="srs-thumb-btn again" data-rating="1">
          <span>Otra vez</span>
          <span style="font-size:10px;font-weight:400">&lt; 1 min</span>
        </button>
        <button class="srs-thumb-btn hard" data-rating="2">
          <span>Difícil</span>
          <span style="font-size:10px;font-weight:400">1 día</span>
        </button>
        <button class="srs-thumb-btn good" data-rating="3">
          <span>Bien</span>
          <span style="font-size:10px;font-weight:400">3 días</span>
        </button>
        <button class="srs-thumb-btn easy" data-rating="4">
          <span>Fácil</span>
          <span style="font-size:10px;font-weight:400">6 días</span>
        </button>
      </div>
    `;

    document.getElementById('reveal-btn').addEventListener('click', () => {
      document.getElementById('answer-area').innerHTML = `
        <div class="review-answer" style="border-top:1px dashed var(--border);padding-top:12px;margin-top:12px">${card.english}</div>
        ${card.notes ? `<div class="review-example" style="margin-top:4px">${card.notes}</div>` : ''}
      `;
      document.getElementById('reveal-btn').classList.add('hidden');
      document.getElementById('rating-btns').classList.remove('hidden');
    });

    document.getElementById('rating-btns').addEventListener('click', async e => {
      const btn = e.target.closest('[data-rating]');
      if (!btn) return;
      const rating = parseInt(btn.dataset.rating);

      if (rating === 1) sessionRatings.again++;
      else if (rating === 2) sessionRatings.hard++;
      else if (rating === 3) sessionRatings.good++;
      else if (rating === 4) sessionRatings.easy++;

      const next = calculateNextReview(rating, card.interval_days, card.ease_factor);
      await updateCardSRS(card.id, {
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        dueDate: next.dueDate,
        reviewCount: (card.review_count || 0) + 1,
      });

      // Non-blocking daily_stats update
      recordDailyReview();

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
  const retention = reviewed > 0 ? Math.round((mastered / reviewed) * 100) : 0;

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

// ── Main entry point ──────────────────────────────────────────────────────────

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

    try {
      if (tabId === 'review') {
        tabContent.innerHTML = `<div class="spinner"></div>`;
        const due = await fetchDueCards();
        if (due.length === 0) {
          tabContent.innerHTML = `
            <div class="empty-state" style="padding:24px 12px">
              <h3>¡Todo al día por hoy!</h3>
              <p style="margin-bottom:16px">No tienes tarjetas pendientes de repaso de repetición espaciada.</p>
            </div>

            <div style="font-weight:700;font-size:14px;margin:20px 0 10px">☕ Mazos Visuales por Tema</div>
            <div class="deck-grid">
              <div class="deck-card">
                <img src="images/deck_tico.jpg" class="deck-img" alt="Vida Tica">
                <div class="deck-body">
                  <div class="deck-title">Vida y Tradición Tica</div>
                  <div class="deck-desc">Expresiones cotidianas, café chorreado, costumbres de Guanacaste.</div>
                </div>
              </div>
              <div class="deck-card">
                <img src="images/deck_nature.jpg" class="deck-img" alt="Naturaleza">
                <div class="deck-body">
                  <div class="deck-title">Naturaleza y Campo</div>
                  <div class="deck-desc">Vocabulario de la fauna, flora, clima y entorno rural de Hojancha.</div>
                </div>
              </div>
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
    } catch (err) {
      showLoadError(tabContent, err, () => renderTab(tabId));
    }
  }

  container.innerHTML = `
    <div class="hero-banner">
      <img src="images/vocab_hero_v1.jpg" alt="Vocabulario SRS">
      <div class="hero-overlay">
        <div class="hero-title">Vocabulario SRS</div>
        <div class="hero-subtitle">Repetición Espaciada y Cuaderno Visual</div>
      </div>
    </div>
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
