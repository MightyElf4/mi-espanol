async function renderDashboard(container) {
  container.innerHTML = `<div class="spinner"></div>`;

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sesión expirada — vuelve a entrar');
    const userId = session.user.id;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const [
      { data: allCards },
      { data: dueCards },
      { data: listeningWeek },
      { data: readingWeek },
      { data: speakingWeek },
    ] = await Promise.all([
      sb.from('vocab_cards').select('id').eq('user_id', userId),
      sb.from('vocab_cards').select('id').eq('user_id', userId).lte('due_date', today),
      sb.from('listening_log').select('id').eq('user_id', userId).gte('date', weekAgoStr),
      sb.from('reading_log').select('id').eq('user_id', userId).gte('date', weekAgoStr),
      sb.from('speaking_log').select('id').eq('user_id', userId).gte('date', weekAgoStr),
    ]);

    const totalCards = allCards?.length || 0;
    const dueCount = dueCards?.length || 0;
    const listenCount = listeningWeek?.length || 0;
    const readCount = readingWeek?.length || 0;
    const speakCount = speakingWeek?.length || 0;

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const greeting = `${days[new Date().getDay()]}, ${today}`;

    container.innerHTML = `
      <div class="page-header"><h2>Inicio</h2></div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">${greeting}</div>

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

    document.getElementById('vocab-cta').addEventListener('click', () => {
      router.navigate('#/vocab');
    });

  } catch (err) {
    container.innerHTML = `<div class="msg-error" style="padding:24px">${err.message}</div>`;
  }
}

router.register('/dashboard', renderDashboard);
