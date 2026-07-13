function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Inicio</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Tu progreso hacia la fluidez.</p>
    </div>
  `;
}
router.register('/dashboard', renderDashboard);
