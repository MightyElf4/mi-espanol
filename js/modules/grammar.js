// ── DB helpers ────────────────────────────────────────────────────────────────

async function getGrammarUserId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada — vuelve a entrar');
  return session.user.id;
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
    .select('correct, exercise_id')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

async function fetchGrammarLessons() {
  const userId = await getGrammarUserId();
  const { data, error } = await sb
    .from('grammar_lessons')
    .select('*')
    .eq('user_id', userId)
    .order('topic', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Lessons ───────────────────────────────────────────────────────────────────

// **marcado** → <strong>marcado</strong> (lesson content is Claude-seeded, not user input)
function grammarMdBold(s) {
  return (s || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

async function computeTopicAccuracy() {
  const [attempts, exercises] = await Promise.all([fetchGrammarAttempts(), fetchGrammarExercises()]);
  const topicById = {};
  exercises.forEach(ex => { topicById[ex.id] = ex.topic; });
  const acc = {};
  attempts.forEach(a => {
    const topic = topicById[a.exercise_id];
    if (!topic) return;
    acc[topic] = acc[topic] || { total: 0, correct: 0 };
    acc[topic].total++;
    if (a.correct) acc[topic].correct++;
  });
  return acc;
}

async function renderGrammarLessons(container, openLesson) {
  container.innerHTML = `<div class="spinner"></div>`;
  const [lessons, accuracy] = await Promise.all([fetchGrammarLessons(), computeTopicAccuracy()]);

  if (lessons.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Sin lecciones todavía</h3><p>Claude añadirá lecciones de gramática en la próxima sesión.</p></div>`;
    return;
  }

  const base = lessons.filter(l => l.difficulty !== 'advanced');
  const advanced = lessons.filter(l => l.difficulty === 'advanced');

  const chip = topic => {
    const a = accuracy[topic];
    if (!a) return `<span class="accuracy-chip">sin intentos</span>`;
    const pct = Math.round((a.correct / a.total) * 100);
    return `<span class="accuracy-chip">${pct}% · ${a.total} intento${a.total !== 1 ? 's' : ''}</span>`;
  };

  const group = (label, rows) => rows.length === 0 ? '' : `
    <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 8px">${label}</div>
    ${rows.map(l => `
      <div class="card lesson-row" data-id="${l.id}">
        <div>
          <div style="font-weight:600">${l.title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${l.topic}</div>
        </div>
        ${chip(l.topic)}
      </div>
    `).join('')}
  `;

  container.innerHTML = `
    ${group('B1 — Base', base)}
    ${group('B2–C1 — Avanzado', advanced)}
  `;

  container.addEventListener('click', e => {
    const row = e.target.closest('.lesson-row');
    if (!row) return;
    const lesson = lessons.find(l => l.id === row.dataset.id);
    if (lesson) openLesson(lesson);
  });
}

function renderGrammarLessonDetail(container, lesson, { onBack, onPractice }) {
  const paragraphs = html => html.split(/\n\n+/).map(p => `<p style="line-height:1.7;margin:0 0 12px">${grammarMdBold(p)}</p>`).join('');

  const examples = (lesson.examples || []).map(ex => `
    <div class="card" style="margin-bottom:8px">
      <div style="font-weight:600;line-height:1.5">${grammarMdBold(ex.spanish)}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${ex.english}</div>
      ${ex.note ? `<div style="font-size:12px;color:var(--accent);margin-top:6px">${ex.note}</div>` : ''}
    </div>
  `).join('');

  const errors = (lesson.common_errors || []).length === 0 ? '' : `
    <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 8px">Errores comunes</div>
    ${(lesson.common_errors || []).map(er => `
      <div class="card error-box" style="margin-bottom:8px">
        <div style="font-size:14px"><span style="color:var(--danger);text-decoration:line-through">${er.wrong}</span> → <strong style="color:var(--accent)">${er.right}</strong></div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${er.why}</div>
      </div>
    `).join('')}
  `;

  container.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <h2 style="font-size:20px">${lesson.title}</h2>
      <button class="btn btn-secondary" id="l-back" style="padding:8px 14px;font-size:13px">← Volver</button>
    </div>
    <div style="font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">${lesson.topic}</div>
    <div class="card" style="margin-bottom:12px">
      ${paragraphs(lesson.explanation_es)}
      <button class="btn btn-secondary" id="l-toggle-en" style="padding:8px 14px;font-size:13px">Ver en inglés</button>
      <div id="l-en-block" class="lesson-en-block" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        ${paragraphs(lesson.explanation_en)}
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 8px">Ejemplos</div>
    ${examples}
    ${errors}
    <button class="btn btn-primary" id="l-practice" style="width:100%;margin-top:16px">Practicar este tema →</button>
  `;

  document.getElementById('l-back').addEventListener('click', onBack);
  document.getElementById('l-toggle-en').addEventListener('click', () => {
    const block = document.getElementById('l-en-block');
    const hidden = block.style.display === 'none';
    block.style.display = hidden ? 'block' : 'none';
    document.getElementById('l-toggle-en').textContent = hidden ? 'Ocultar inglés' : 'Ver en inglés';
  });
  document.getElementById('l-practice').addEventListener('click', () => onPractice(lesson.topic));
}

// ── Practice session ──────────────────────────────────────────────────────────

// Set before jumping to the practice tab to pre-select a topic
let grammarJumpTopic = null;

// correct_answer may hold several valid forms separated by "|" (e.g. "hubiera comido|habría comido")
function grammarAnswerIsCorrect(input, correctAnswer) {
  const given = input.trim().toLowerCase();
  return correctAnswer.split('|').some(a => a.trim().toLowerCase() === given);
}

function grammarDisplayAnswer(correctAnswer) {
  return correctAnswer.split('|').map(a => a.trim()).join(' / ');
}

function grammarShuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const GRAMMAR_ROUND_SIZE = 20;

async function renderGrammarPractice(container) {
  container.innerHTML = `<div class="spinner"></div>`;
  const [exercises, lessons] = await Promise.all([fetchGrammarExercises(), fetchGrammarLessons()]);
  const lessonByTopic = {};
  lessons.forEach(l => { lessonByTopic[l.topic] = l; });

  if (exercises.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Sin ejercicios todavía</h3>
        <p>Claude añadirá ejercicios de gramática personalizados en la próxima sesión.</p>
      </div>
    `;
    return;
  }

  const topics = [...new Set(exercises.map(ex => ex.topic))].sort();
  let currentTopic = grammarJumpTopic || '';
  grammarJumpTopic = null;
  let round = [];
  let index = 0;
  let answered = false;

  function startRound() {
    const pool = currentTopic ? exercises.filter(ex => ex.topic === currentTopic) : exercises;
    round = grammarShuffle(pool).slice(0, GRAMMAR_ROUND_SIZE);
    index = 0;
    renderExercise();
  }

  function topicFilterHtml() {
    return `
      <div class="field" style="margin-bottom:16px">
        <select id="g-topic-filter">
          <option value="">Todos los temas (${exercises.length})</option>
          ${topics.map(t => `<option value="${t}" ${t === currentTopic ? 'selected' : ''}>${t} (${exercises.filter(ex => ex.topic === t).length})</option>`).join('')}
        </select>
      </div>
    `;
  }

  function bindTopicFilter() {
    document.getElementById('g-topic-filter').addEventListener('change', e => {
      currentTopic = e.target.value;
      startRound();
    });
  }

  function renderExercise() {
    if (index >= round.length) {
      container.innerHTML = `
        ${topicFilterHtml()}
        <div class="card" style="text-align:center;padding:32px">
          <div style="font-size:32px;margin-bottom:12px">✓</div>
          <div style="font-weight:600;font-size:18px">¡Terminaste!</div>
          <p style="color:var(--text-muted);margin:8px 0 20px">Completaste ${round.length} ejercicio${round.length !== 1 ? 's' : ''}.</p>
          <button class="btn btn-primary" id="g-restart">Otra ronda</button>
        </div>
      `;
      bindTopicFilter();
      document.getElementById('g-restart').addEventListener('click', startRound);
      return;
    }

    const ex = round[index];
    answered = false;

    container.innerHTML = `
      ${topicFilterHtml()}
      <div class="review-progress">${index + 1} / ${round.length}</div>
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

    bindTopicFilter();
    document.getElementById('g-answer').focus();

    document.getElementById('grammar-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (answered) return;
      answered = true;

      const input = document.getElementById('g-answer').value.trim();
      const correct = grammarAnswerIsCorrect(input, ex.correct_answer);
      await logGrammarAttempt(ex.id, input, correct);

      const lesson = lessonByTopic[ex.topic];
      document.getElementById('g-feedback').innerHTML = correct
        ? `<div class="msg-success" style="font-size:15px;padding:12px;margin-bottom:12px">¡Correcto!</div>`
        : `<div class="msg-error" style="font-size:15px;margin-bottom:4px">Incorrecto</div>
           <div style="font-size:14px;color:var(--text-muted);margin-bottom:12px">Respuesta correcta: <strong>${grammarDisplayAnswer(ex.correct_answer)}</strong>
           ${lesson ? `<div style="margin-top:8px"><a href="#" id="g-see-rule" style="color:var(--accent);font-weight:600">Ver la regla — ${ex.topic}</a></div>` : ''}</div>`;

      document.getElementById('g-actions').innerHTML = `
        <button class="btn btn-primary" id="g-next">Siguiente →</button>
      `;
      document.getElementById('g-next').addEventListener('click', () => {
        index++;
        renderExercise();
      });

      const seeRule = document.getElementById('g-see-rule');
      if (seeRule) {
        seeRule.addEventListener('click', evt => {
          evt.preventDefault();
          renderGrammarLessonDetail(container, lesson, {
            onBack: () => { index++; renderExercise(); },
            onPractice: () => { index++; renderExercise(); },
          });
        });
      }
    });
  }

  startRound();
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
          <div style="font-size:13px;color:var(--text-muted);margin-top:6px">Respuesta: <strong>${grammarDisplayAnswer(ex.correct_answer)}</strong></div>
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
    { id: 'lessons', label: 'Lecciones' },
    { id: 'practice', label: 'Practicar' },
    { id: 'list', label: 'Ejercicios' },
    { id: 'stats', label: 'Estadísticas' },
  ];

  async function renderTab(tabId) {
    document.querySelectorAll('.module-tab').forEach(el =>
      el.classList.toggle('active', el.dataset.tab === tabId)
    );
    const tc = document.getElementById('tab-content');

    function openLesson(lesson) {
      renderGrammarLessonDetail(tc, lesson, {
        onBack: () => renderTab('lessons'),
        onPractice: topic => { grammarJumpTopic = topic; renderTab('practice'); },
      });
    }

    try {
      if (tabId === 'lessons') {
        await renderGrammarLessons(tc, openLesson);
      } else if (tabId === 'practice') {
        await renderGrammarPractice(tc);
      } else if (tabId === 'list') {
        await renderGrammarList(tc);
      } else if (tabId === 'stats') {
        await renderGrammarStats(tc);
      }
    } catch (err) {
      showLoadError(tc, err, () => renderTab(tabId));
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
