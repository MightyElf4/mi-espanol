async function renderDashboard(container) {
  let totalCards = 0, dueCount = 0, listenCount = 0, readCount = 0, speakCount = 0;
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  try {
    const sessionRes = await sb.auth.getSession().catch(() => ({ data: { session: null } }));
    const session = sessionRes?.data?.session;
    if (session) {
      const userId = session.user.id;
      const [
        allCardsRes,
        dueCardsRes,
        listeningRes,
        readingRes,
        speakingRes,
      ] = await Promise.all([
        sb.from('vocab_cards').select('id').eq('user_id', userId).catch(() => ({ data: [] })),
        sb.from('vocab_cards').select('id').eq('user_id', userId).lte('due_date', today).catch(() => ({ data: [] })),
        sb.from('listening_log').select('id').eq('user_id', userId).gte('date', weekAgoStr).catch(() => ({ data: [] })),
        sb.from('reading_log').select('id').eq('user_id', userId).gte('date', weekAgoStr).catch(() => ({ data: [] })),
        sb.from('speaking_log').select('id').eq('user_id', userId).gte('date', weekAgoStr).catch(() => ({ data: [] })),
      ]);
      totalCards = allCardsRes?.data?.length || 0;
      dueCount = dueCardsRes?.data?.length || 0;
      listenCount = listeningRes?.data?.length || 0;
      readCount = readingRes?.data?.length || 0;
      speakCount = speakingRes?.data?.length || 0;
    }
  } catch (err) {
    console.warn('Dashboard offline mode:', err);
  }

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const greeting = `${days[new Date().getDay()]}, ${today}`;

  container.innerHTML = `
    <div class="hero-banner">
      <img src="images/dashboard_hero_v2.jpg?v=2" alt="Guanacaste Costa Rica">
      <div class="hero-overlay">
        <div class="hero-title">Mi Español</div>
        <div class="hero-subtitle">Hojancha, Costa Rica · Nivel B1 → B2/C1</div>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;font-weight:600">${greeting}</div>

    <div class="card" id="vocab-cta" style="cursor:pointer;margin-bottom:16px">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Para repasar hoy</div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <div style="font-size:42px;font-weight:700;color:${dueCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}">${dueCount}</div>
        <div style="font-size:14px;color:var(--text-muted)">tarjeta${dueCount !== 1 ? 's' : ''} de vocabulario</div>
      </div>
      <div style="font-size:13px;margin-top:8px;color:${dueCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}">
        ${dueCount > 0 ? 'Ir a repasar →' : '¡Todo al día!'}
      </div>
    </div>

    <div style="font-weight:600;font-size:14px;margin-bottom:12px">Esta semana</div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card"><div class="stat-number">${listenCount}</div><div class="stat-label">Escuchar</div></div>
      <div class="stat-card"><div class="stat-number">${readCount}</div><div class="stat-label">Leer</div></div>
      <div class="stat-card"><div class="stat-number">${speakCount}</div><div class="stat-label">Hablar</div></div>
    </div>

    <div style="font-weight:600;font-size:14px;margin-bottom:12px">Vocabulario</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${totalCards}</div><div class="stat-label">Total tarjetas</div></div>
      <div class="stat-card"><div class="stat-number">B1→B2</div><div class="stat-label">Nivel actual</div></div>
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
