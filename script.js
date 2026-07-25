const API = '/api';
let token = localStorage.getItem('nbss_token');
let currentUser = null;

async function api(url, opt = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opt.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + url, { ...opt, headers: { ...headers, ...opt.headers } });
  if (r.status === 423) {
    const d = await r.json();
    alert('Вы забанены: ' + (d.bannedUntil || 'навсегда'));
    return;
  }
  if (!r.ok) {
    let msg = 'Ошибка';
    try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

// Универсальная функция для получения Turnstile-токена
function getTurnstileToken() {
  if (typeof turnstile !== 'undefined' && turnstile.getResponse) {
    return turnstile.getResponse();
  }
  // Если виджет не загрузился, даём тестовый токен (чтобы не блокировать)
  console.warn('Turnstile не загружен, используется тестовый токен');
  return 'test-token';
}

function resetTurnstile() {
  if (typeof turnstile !== 'undefined' && turnstile.reset) {
    turnstile.reset();
  }
}

// Привязка событий после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const u = document.getElementById('loginUsername')?.value.trim();
      const p = document.getElementById('loginPassword')?.value.trim();
      const cap = getTurnstileToken();
      if (!u || !p) return alert('Введите логин и пароль');
      try {
        const d = await api('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p, turnstileToken: cap }) });
        token = d.token;
        currentUser = d.user;
        localStorage.setItem('nbss_token', token);
        showPage('home');
      } catch (e) {
        alert(e.message);
        resetTurnstile();
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const u = document.getElementById('regUsername')?.value.trim();
      const p = document.getElementById('regPassword')?.value.trim();
      const cap = getTurnstileToken();
      if (!u || !p) return alert('Введите логин и пароль');
      try {
        await api('/register', { method: 'POST', body: JSON.stringify({ username: u, password: p, turnstileToken: cap }) });
        alert('Аккаунт создан! Теперь войдите.');
        showPage('login');
      } catch (e) {
        alert(e.message);
        resetTurnstile();
      }
    });
  }

  // Остальные кнопки навигации
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      if (page === 'logout') {
        token = null; currentUser = null;
        localStorage.removeItem('nbss_token');
        showPage('home');
        return;
      }
      showPage(page);
    });
  });

  // Начальная страница
  showPage('home');
});

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id + 'Page');
  if (target) target.classList.add('active');
}
