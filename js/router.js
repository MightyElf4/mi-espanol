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
      renderFn(view);
    } else {
      view.innerHTML = `<div class="empty-state"><h3>Página no encontrada</h3></div>`;
    }
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('href') === '#' + path);
    });
  },
};

window.addEventListener('hashchange', () => router.navigate(location.hash));
