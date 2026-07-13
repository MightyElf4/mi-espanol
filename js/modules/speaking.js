function renderSpeaking(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Hablar</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Registra tus conversaciones y practica tu confianza.</p>
    </div>
  `;
}
router.register('/speaking', renderSpeaking);
