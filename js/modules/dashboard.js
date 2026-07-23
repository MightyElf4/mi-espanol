async function renderDashboard(container) {
  let totalCards = 0, dueCount = 0, masteredCount = 0, deckStrength = 0;
  let streak = 0, weeklyDays = [], totalWeeklyReviewed = 0;
  const today = new Date().toISOString().split('T')[0];

  try {
    const sessionRes = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
    const session = sessionRes?.data?.session;
    if (session) {
      const userId = session.user.id;
      const [
        allCardsRes,
        dueCardsRes,
        masteredCardsRes,
        dailyStatsRes
      ] = await Promise.all([
        sb.from('vocab_cards').select('id, interval_days').eq('user_id', userId).catch(() => ({ data: [] })),
        sb.from('vocab_cards').select('id').eq('user_id', userId).lte('due_date', today).catch(() => ({ data: [] })),
        sb.from('vocab_cards').select('id').eq('user_id', userId).gte('interval_days', 21).catch(() => ({ data: [] })),
        sb.from('daily_stats').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30).catch(() => ({ data: [] }))
      ]);

      const allCards = allCardsRes?.data || [];
      totalCards = allCards.length;
      dueCount = dueCardsRes?.data?.length || 0;
      masteredCount = masteredCardsRes?.data?.length || 0;
      deckStrength = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

      // Process daily_stats for streak & weekly sparkline
      const statsByDate = {};
      (dailyStatsRes?.data || []).forEach(row => {
        const cnt = (row.stats_json && row.stats_json.vocab_reviews) || 0;
        statsByDate[row.date] = cnt;
      });

      // Calculate streak
      let checkDate = new Date();
      let checkStr = checkDate.toISOString().split('T')[0];
      if (!statsByDate[checkStr] || statsByDate[checkStr] === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = checkDate.toISOString().split('T')[0];
      }

      while (statsByDate[checkStr] && statsByDate[checkStr] > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
        checkStr = checkDate.toISOString().split('T')[0];
      }

      // Weekly activity (last 7 days)
      weeklyDays = [];
      totalWeeklyReviewed = 0;
      const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const count = statsByDate[ds] || 0;
        weeklyDays.push({
          dayLabel: dayLabels[d.getDay()],
          count: count,
          isToday: i === 0
        });
        totalWeeklyReviewed += count;
      }
    }
  } catch (err) {
    console.warn('Dashboard offline mode:', err);
  }

  // Dynamic countdown to June 30, 2028
  const targetDate = new Date('2028-06-30');
  const now = new Date();
  const diffTime = targetDate - now;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const maxWeeklyCount = Math.max(...weeklyDays.map(d => d.count), 1);

  container.innerHTML = `
    <div class="page-header" style="margin-bottom:12px">
      <div>
        <h2 style="font-size:20px;font-weight:800">¡Hola, Landry!</h2>
        <div style="font-size:12px;color:var(--text-muted)">Hojancha, Costa Rica</div>
      </div>
      <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:var(--warning);padding:6px 12px;border-radius:20px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:4px">
        🔥 ${streak} Día${streak !== 1 ? 's' : ''}
      </div>
    </div>

    <!-- C2 Progress Ladder -->
    <div class="ladder-card">
      <div class="ladder-title">
        <span>Escalera de Fluidez CEFR</span>
        <span style="color:var(--text-muted)">Meta: C2 (Junio 2028)</span>
      </div>

      <div class="ladder-steps">
        <div class="ladder-line">
          <div class="ladder-line-fill"></div>
        </div>

        <div class="step-node completed">
          <div class="node-circle">B1</div>
          <div class="node-label">Intermedio</div>
        </div>

        <div class="step-node active">
          <div class="node-circle">B2</div>
          <div class="node-label">Avanzado</div>
        </div>

        <div class="step-node">
          <div class="node-circle">C1</div>
          <div class="node-label">Dominio</div>
        </div>

        <div class="step-node">
          <div class="node-circle">C2</div>
          <div class="node-label">Fluidez</div>
        </div>
      </div>

      <div class="marker-box">
        <div>📍 <strong>Estás aquí:</strong> B1+ → Subiendo a B2</div>
        <div style="font-weight:700;color:var(--warning)">Faltan ${daysRemaining} días</div>
      </div>
    </div>

    <!-- SRS Due CTA Banner -->
    <div class="card" id="vocab-cta" style="background:linear-gradient(135deg, var(--accent), #0f766e);color:#fff;border:none;cursor:pointer;margin-bottom:16px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:36px;font-weight:800;line-height:1">${dueCount}</div>
          <div style="font-size:13px;opacity:0.9;margin-top:4px">Tarjetas listas para repasar hoy</div>
        </div>
        <button class="btn" style="background:#fff;color:var(--accent);font-size:13px;font-weight:700;padding:10px 16px;border:none;border-radius:10px">
          ${dueCount > 0 ? 'Repasar Ahora →' : 'Ver Mazo'}
        </button>
      </div>
    </div>

    <!-- Stat Cards Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">
          <span>Dominadas</span>
          <span>🎓</span>
        </div>
        <div class="stat-number">${masteredCount}</div>
        <div class="stat-label">Intervalo ≥ 21 días</div>
      </div>

      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">
          <span>Fuerza Mazo</span>
          <span>💪</span>
        </div>
        <div class="stat-number">${deckStrength}%</div>
        <div class="stat-label">Dominadas / Total</div>
      </div>
    </div>

    <!-- Weekly Activity Sparkline -->
    <div class="activity-card">
      <div class="activity-header">
        <div style="font-size:13px;font-weight:700">Actividad Semanal</div>
        <div style="font-size:12px;color:var(--text-muted)">${totalWeeklyReviewed} repasos</div>
      </div>
      <div class="bars-row">
        ${weeklyDays.map(d => {
          const heightPx = d.count > 0 ? Math.max(8, Math.round((d.count / maxWeeklyCount) * 50)) : 4;
          return `
            <div class="bar-col">
              <div class="bar-fill" style="height:${heightPx}px;${d.isToday ? 'background:#8b5cf6;' : ''}"></div>
              <span class="bar-day">${d.dayLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  const cta = document.getElementById('vocab-cta');
  if (cta) {
    cta.addEventListener('click', () => {
      router.navigate('#/vocab');
    });
  }
}

router.register('/dashboard', renderDashboard);
