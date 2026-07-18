// ── Vocab DB helpers ──────────────────────────────────────────────────────────

async function getUserId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada — vuelve a entrar');
  return session.user.id;
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
    sync.queue({ cardId: id, intervalDays, easeFactor, dueDate, reviewCount });
  }
}

// ── Review session ────────────────────────────────────────────────────────────

function renderReviewSession(container, cards) {
  let index = 0;

  function renderCard() {
    if (index >= cards.length) {
      container.innerHTML = `
        <div class="review-card">
          <div class="review-word">¡Listo!</div>
          <p style="color:var(--text-muted);margin-top:8px">Repasaste ${cards.length} tarjeta${cards.length !== 1 ? 's' : ''} hoy.</p>
        </div>
        <button class="btn btn-secondary" onclick="renderVocabModule(document.getElementById('view'))">Volver</button>
      `;
      return;
    }

    const card = cards[index];

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
    } catch (err) {
      showLoadError(tabContent, err, () => renderTab(tabId));
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
