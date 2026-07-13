// ── DB helpers ────────────────────────────────────────────────────────────────

async function getGrammarUserId() {
  const { data: { user } } = await sb.auth.getUser();
  return user.id;
}

async function fetchGrammarExercises() {
  const userId = await getGrammarUserId();
  const { data, error } = await sb
    .from('grammar_exercises')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
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

async function fetchGrammarAttempts() {
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
        <p>Claude añadirá ejercicios de gramática personalizados en la próxima sesión.</p>
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
          <div style="font-size:32px;margin-bottom:12px">✓</div>
          <div style="font-weight:600;font-size:18px">¡Terminaste!</div>
          <p style="color:var(--text-muted);margin:8px 0 20px">Completaste ${exercises.length} ejercicio${exercises.length !== 1 ? 's' : ''}.</p>
          <button class="btn btn-primary" id="g-restart">Volver a empezar</button>
        </div>
      `;
      document.getElementById('g-restart').addEventListener('click', () => {
        index = 0;
        renderExercise();
      });
      return;
    }

    const ex = exercises[index];
    answered = false;

    container.innerHTML = `
      <div class="review-progress">${index + 1} / ${exercises.length}</div>
      <div class="card" style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--accent);font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">${ex.topic}</div>
        <div style="font-size:18px;font-weight:600;line-height:1.4">${ex.prompt}</div>
      </div>
      <form id="grammar-form">
        <div class="field">
          <label>Tu respuesta</label>
          <input type="text" id="g-answer" placeholder="Escribe tu respuesta aquí" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
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

      document.getElementById('g-feedback').innerHTML = correct
        ? `<div class="msg-success" style="font-size:15px;padding:12px;margin-bottom:12px">¡Correcto!</div>`
        : `<div class="msg-error" style="font-size:15px;margin-bottom:4px">Incorrecto</div>
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
    <div>
      ${exercises.map(ex => `
        <div class="card" style="margin-bottom:8px">
          <div style="font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${ex.topic}</div>
          <div style="font-weight:500;line-height:1.4">${ex.prompt}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:6px">Respuesta: <strong>${ex.correct_answer}</strong></div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function renderGrammarStats(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const attempts = await fetchGrammarAttempts();
  const exercises = await fetchGrammarExercises();

  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${exercises.length}</div><div class="stat-label">Ejercicios</div></div>
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
