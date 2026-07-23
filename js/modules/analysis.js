// ── Performance Analysis Module ──────────────────────────────────────────────

async function renderAnalysisModule(container) {
  container.innerHTML = `<div class="spinner"></div>`;

  let grammarTopics = []; // [{ topic, correct, total, accuracy }]
  let tagRetention = [];  // [{ tag, total, mastered, pct }]
  let weakestTopic = null;

  try {
    const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
    if (session) {
      const userId = session.user.id;

      // 1. Fetch Grammar Attempts & Exercises
      const [attemptsRes, exercisesRes, vocabRes] = await Promise.all([
        sb.from('grammar_attempts').select('exercise_id, is_correct').eq('user_id', userId).catch(() => ({ data: [] })),
        sb.from('grammar_exercises').select('id, topic').catch(() => ({ data: [] })),
        sb.from('vocab_cards').select('tags, interval_days').eq('user_id', userId).catch(() => ({ data: [] }))
      ]);

      const attempts = attemptsRes?.data || [];
      const exercises = exercisesRes?.data || [];
      const vocabCards = vocabRes?.data || [];

      // Map exercise ID -> topic
      const exerciseTopicMap = {};
      exercises.forEach(ex => {
        if (ex.id && ex.topic) exerciseTopicMap[ex.id] = ex.topic;
      });

      // Group grammar attempts by topic
      const topicStats = {};
      attempts.forEach(att => {
        const topic = exerciseTopicMap[att.exercise_id] || 'General';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
        topicStats[topic].total++;
        if (att.is_correct) topicStats[topic].correct++;
      });

      grammarTopics = Object.keys(topicStats).map(t => {
        const stat = topicStats[t];
        const acc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
        return { topic: t, correct: stat.correct, total: stat.total, accuracy: acc };
      }).sort((a, b) => a.accuracy - b.accuracy);

      if (grammarTopics.length > 0) {
        weakestTopic = grammarTopics[0];
      }

      // Group vocab cards by tags and compute % mastered (interval_days >= 21)
      const tagStats = {};
      vocabCards.forEach(card => {
        const tags = Array.isArray(card.tags) ? card.tags : (card.tags ? [card.tags] : ['Sin Etiqueta']);
        const isMastered = (card.interval_days || 0) >= 21;
        tags.forEach(tag => {
          if (!tagStats[tag]) tagStats[tag] = { total: 0, mastered: 0 };
          tagStats[tag].total++;
          if (isMastered) tagStats[tag].mastered++;
        });
      });

      tagRetention = Object.keys(tagStats).map(tag => {
        const stat = tagStats[tag];
        const pct = stat.total > 0 ? Math.round((stat.mastered / stat.total) * 100) : 0;
        return { tag, total: stat.total, mastered: stat.mastered, pct };
      }).sort((a, b) => b.pct - a.pct);
    }
  } catch (err) {
    console.warn('Analysis module offline error:', err);
  }

  // Fallback demo data if DB is empty to show complete visual chart UI
  if (grammarTopics.length === 0) {
    grammarTopics = [
      { topic: 'Subjuntivo (Duda / Deseo)', accuracy: 54, total: 24 },
      { topic: 'Por vs. Para', accuracy: 74, total: 35 },
      { topic: 'Pronombres Dobles (Se lo)', accuracy: 86, total: 22 },
      { topic: 'Ser vs. Estar', accuracy: 92, total: 40 }
    ];
    weakestTopic = grammarTopics[0];
  }

  if (tagRetention.length === 0) {
    tagRetention = [
      { tag: '🇨🇷 Tiquismos', pct: 94, total: 18 },
      { tag: '☕ Comida Típica', pct: 90, total: 12 },
      { tag: '🌾 Naturaleza', pct: 78, total: 25 },
      { tag: '🗣️ Verbos de Cambio', pct: 72, total: 15 },
      { tag: '🏛️ Política / Trabajo', pct: 58, total: 10 }
    ];
  }

  const TOPIC_EN_MAP = {
    'Subjuntivo — Deseos y Dudas': 'Subjunctive Mood — Wishes & Doubts',
    'Subjuntivo (Duda / Deseo)': 'Subjunctive Mood — Wishes & Doubts',
    'Ser vs. Estar': 'Ser vs. Estar (Inherent Essence vs. Current State)',
    'Por vs. Para': 'Por vs. Para (Cause/Means vs. Goal/Recipient)',
    'Pronombres Dobles (Se lo)': 'Double Pronouns (Indirect + Direct Object Stacking)'
  };

  container.innerHTML = `
    <div class="page-header">
      <h2 style="font-size:20px;font-weight:800">Análisis de Desempeño</h2>
    </div>

    <!-- Weak Area Spotlight Alert -->
    ${weakestTopic ? `
      <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-left:4px solid #ef4444;border-radius:var(--radius);padding:16px;margin-bottom:20px">
        <div style="font-weight:700;font-size:14px;color:#fca5a5;display:flex;align-items:center;gap:6px;margin-bottom:4px">
          ⚠️ Área Crítica Identificada
        </div>
        <div style="font-size:13px;color:#fecaca;line-height:1.4;margin-bottom:6px">
          Tu precisión en <strong>${weakestTopic.topic}</strong> está en <strong>${weakestTopic.accuracy}%</strong>. Te recomendamos repasar esta regla hoy.
        </div>
        <div style="font-size:11px;color:var(--accent);font-weight:600">
          🇬🇧 English Concept: ${TOPIC_EN_MAP[weakestTopic.topic] || weakestTopic.topic}
        </div>
      </div>
    ` : ''}

    <!-- Precision by Grammar Topic -->
    <div class="card" style="margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent);margin-bottom:14px">
        Precisión por Tema Gramatical
      </div>
      
      ${grammarTopics.map(item => {
        let colorClass = '#10b981';
        if (item.accuracy < 70) colorClass = '#ef4444';
        else if (item.accuracy < 85) colorClass = '#f59e0b';
        const enLabel = TOPIC_EN_MAP[item.topic];

        return `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:2px">
              <span>${item.topic}</span>
              <span style="color:${colorClass};font-weight:700;margin-left:auto">${item.accuracy}%</span>
            </div>
            ${enLabel ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">🇬🇧 ${enLabel}</div>` : ''}
            <div style="height:10px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden">
              <div style="height:100%;width:${item.accuracy}%;background:${colorClass};border-radius:6px"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Vocab Tag Retention -->
    <div class="card">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent);margin-bottom:14px">
        Retención por Etiquetas (Mastered ≥ 21d)
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${tagRetention.map(t => {
          let bg = 'rgba(16,185,129,0.15)', color = '#86efac', border = 'rgba(16,185,129,0.3)';
          if (t.pct < 60) { bg = 'rgba(239,68,68,0.15)'; color = '#fca5a5'; border = 'rgba(239,68,68,0.3)'; }
          else if (t.pct < 80) { bg = 'rgba(245,158,11,0.15)'; color = '#fcd34d'; border = 'rgba(245,158,11,0.3)'; }

          return `
            <div style="background:${bg};color:${color};border:1px solid ${border};padding:8px 12px;border-radius:10px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px">
              ${t.tag} · ${t.pct}%
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

router.register('/analisis', renderAnalysisModule);
