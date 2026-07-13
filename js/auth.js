async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showMainScreen();
  } else {
    renderLoginForm();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showMainScreen();
    } else {
      showAuthScreen();
    }
  });
}

function renderLoginForm() {
  document.getElementById('auth-screen').innerHTML = `
    <div class="auth-card">
      <h1>Mi Español</h1>
      <p>Tu cuaderno de español</p>
      <form id="login-form">
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" required autocomplete="email">
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input type="password" id="password" required autocomplete="current-password">
        </div>
        <div id="auth-error" class="msg-error"></div>
        <button type="submit" class="btn btn-primary" style="margin-top:8px">Entrar</button>
      </form>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = '';

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) errorEl.textContent = error.message;
  });
}

function showMainScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  renderNav();
  router.navigate(location.hash || '#/vocab');
}

function showAuthScreen() {
  document.getElementById('main-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  renderLoginForm();
}

initAuth();
