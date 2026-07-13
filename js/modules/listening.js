function renderListening(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Escuchar</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Registra los podcasts y audios que escuchas en español.</p>
    </div>
  `;
}
router.register('/listening', renderListening);
