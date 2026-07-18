function showLoadError(container, err, retryFn) {
  container.innerHTML = `
    <div class="empty-state">
      <h3>No se pudo cargar</h3>
      <p>${(err && err.message) || 'Revisa tu conexión e intenta de nuevo.'}</p>
    </div>
    <button class="btn btn-primary" id="retry-btn" style="margin-top:16px">Reintentar</button>
  `;
  document.getElementById('retry-btn').addEventListener('click', retryFn);
}

const router = {
  routes: {},

  register(path, renderFn) {
    this.routes[path] = renderFn;
  },

  navigate(hash) {
    const path = hash.replace('#', '') || '/vocab';
    history.replaceState(null, '', '#' + path);
    const renderFn = this.routes[path];
    const view = document.getElementById('view');
    if (renderFn) {
      view.innerHTML = '';
      Promise.resolve(renderFn(view)).catch(err =>
        showLoadError(view, err, () => this.navigate(hash))
      );
    } else {
      view.innerHTML = `<div class="empty-state"><h3>Página no encontrada</h3></div>`;
    }
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('href') === '#' + path);
    });
  },
};

window.addEventListener('hashchange', () => router.navigate(location.hash));
