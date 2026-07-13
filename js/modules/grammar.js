function renderGrammar(container) {
  container.innerHTML = `
    <div class="page-header"><h2>Gramática</h2></div>
    <div class="empty-state">
      <h3>Próximamente</h3>
      <p>Ejercicios de gramática: subjuntivo, ser vs. estar, y más.</p>
    </div>
  `;
}
router.register('/grammar', renderGrammar);
