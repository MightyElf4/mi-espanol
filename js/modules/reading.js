function renderReading(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Leer</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Registra lo que lees en español.</p>
    </div>
  `;
}
router.register('/reading', renderReading);
