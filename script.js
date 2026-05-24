const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;

async function request(url, options = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const res = await fetch(API + url, { ...options, headers: { ...headers, ...options.headers } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Неизвестная ошибка сервера' }));
      throw new Error(err.error || `Ошибка ${res.status}`);
    }
    return res.json();
  } catch (e) {
    if (e.message === 'Failed to fetch') {
      throw new Error('Сервер недоступен. Проверьте подключение или перезагрузите страницу.');
    }
    throw e;
  }
}

// Инициализация, showPage, updateUIForAuth, единый обработчик навигации – точно как в последнем полном ответе.
// Вход:
document.getElementById('loginBtn').addEventListener('click', async () => {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  try {
    const data = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('nbss_token', token);
    updateUIForAuth();
    showPage('home');
  } catch (e) {
    alert(e.message);
  }
});

// ... (весь остальной код: лента, комментарии, перевод, профили, сообщения, админка, поиск, статистика)
