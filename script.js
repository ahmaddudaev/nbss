// ==================== НБСС — КЛИЕНТСКИЙ СКРИПТ (СЕРВЕРНАЯ ВЕРСИЯ) ====================
const API = 'https://nbss-production.up.railway.app/api';

let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;   // будет заполнен после входа или проверки токена

// ---------- вспомогательная функция запросов ----------
async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сети' }));
    throw new Error(err.error || 'Ошибка');
  }
  return res.json();
}

// ---------- инициализация (проверка токена) ----------
(async function init() {
  if (token) {
    try {
      // попробуем получить статистику, чтобы проверить токен
      await request('/stats');
      // если не выбросило ошибку – токен рабочий, пользователь авторизован
      // дополнительно можно получить данные о себе, но в нашем API нет отдельного /me,
      // поэтому просто считаем, что авторизация ок.
    } catch (e) {
      // токен невалиден
      token = null;
      localStorage.removeItem('nbss_token');
    }
  }
  updateUIForAuth();
  showPage('home');
})();

// ---------- навигация по страницам ----------
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page');
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');

  // подгружаем данные при переходе
  if (pageId === 'home') loadPosts();
  if (pageId === 'profile') loadProfile();
  if (pageId === 'events') loadEvents();
  if (pageId === 'admin') { loadAdminStats(); loadAdminUsers(); }
  updateStats();
}

// ---------- обновление интерфейса в зависимости от авторизации ----------
function updateUIForAuth() {
  const loggedIn = !!token;
  document.getElementById('authBanner').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('postComposer').style.display = loggedIn ? 'block' : 'none';
  document.getElementById('navProfile').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('logoutLink').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('loginLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('registerLink').style.display = loggedIn ? 'none' : 'flex';
  // кнопка админки видна только админам (проверим позже)
}

// ---------- кнопки навигации (события) ----------
document.querySelectorAll('.nav-item[data-page]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    if (page === 'profile' && !token) return alert('Сначала войдите');
    if (page === 'admin' && !currentUser?.admin) {
      // currentUser может быть ещё не загружен, попробуем получить из токена, но проще запросить /admin/users
      // временно просто предупредим
      return alert('Нет прав администратора');
    }
    showPage(page);
  });
});

document.getElementById('loginFromBanner')?.addEventListener('click', () => showPage('login'));
document.getElementById('registerFromBanner')?.addEventListener('click', () => showPage('register'));

// ---------- ВХОД ----------
document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  try {
    const data = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    token = data.token;
    currentUser = data.user;   // содержит username, verified, admin, premium
    localStorage.setItem('nbss_token', token);
    updateUIForAuth();
    showPage('home');
  } catch (e) {
    alert(e.message);
  }
});

// ---------- РЕГИСТРАЦИЯ ----------
document.getElementById('registerBtn').addEventListener('click', async () => {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  try {
    await request('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    alert('Аккаунт создан! Теперь войдите.');
    showPage('login');
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById('showRegisterLink').addEventListener('click', (e) => {
  e.preventDefault();
  showPage('register');
});

// ---------- ВЫХОД ----------
document.getElementById('logoutLink').addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('nbss_token');
  updateUIForAuth();
  showPage('home');
});

// ---------- ПЕРЕКЛЮЧЕНИЕ ТЕМЫ ----------
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
  localStorage.setItem('nbss_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
});
if (localStorage.getItem('nbss_theme') === 'light') document.body.classList.add('light-mode');

// ---------- ПУБЛИКАЦИЯ ПОСТА ----------
document.getElementById('publishPost').addEventListener('click', async () => {
  const text = document.getElementById('postInput').value.trim();
  if (!text) return;
  try {
    await request('/posts', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    document.getElementById('postInput').value = '';
    loadPosts();   // обновим ленту
  } catch (e) {
    alert(e.message);
  }
});

// ---------- ЗАГРУЗКА ПОСТОВ (лента) ----------
async function loadPosts() {
  const container = document.getElementById('feedContainer');
  try {
    const posts = await request('/posts');
    container.innerHTML = posts.map(p => renderPost(p)).join('');
    attachPostActions();
  } catch (e) {
    container.innerHTML = '<p>Ошибка загрузки ленты</p>';
  }
}

function renderPost(p) {
  // p содержит поля: id, author, text, likes (массив), reposts (массив), timestamp
  // дополнительно сервер может присылать verified/premium автора? Нет, мы не храним это в посте,
  // но мы можем получить из текущего списка пользователей (не очень эффективно).
  // Пока для простоты verified будем брать из глобального объекта, если есть.
  const author = p.author;
  // Попробуем найти пользователя в глобальной переменной? У нас её нет.
  // Но для отображения галочки и премиум-ника можно сделать отдельный запрос или хранить кеш.
  // Пока упростим: верификация и премиум не отображаются в ленте (или можно сделать запрос).
  // В реальном проекте лучше добавить в пост поля verified и premium.
  const verifiedIcon = ''; // временно пусто
  const nickClass = '';    // временно пусто
  const formatted = p.text
    .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  return `
    <div class="post" data-id="${p.id}">
      <div class="avatar">${author[0]?.toUpperCase()}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${nickClass}">${author}${verifiedIcon}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        <div class="post-text">${formatted}</div>
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes.length}</button>
          <button class="repost-btn">🔄 ${p.reposts.length}</button>
        </div>
      </div>
    </div>`;
}

function attachPostActions() {
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.onclick = async function() {
      if (!token) return alert('Войдите, чтобы ставить лайки');
      const postId = this.closest('.post').dataset.id;
      try {
        await request(`/posts/${postId}/like`, { method: 'POST' });
        loadPosts(); // обновим ленту
      } catch (e) { alert(e.message); }
    };
  });
  document.querySelectorAll('.repost-btn').forEach(btn => {
    btn.onclick = async function() {
      if (!token) return alert('Войдите, чтобы делать репосты');
      const postId = this.closest('.post').dataset.id;
      try {
        await request(`/posts/${postId}/repost`, { method: 'POST' });
        loadPosts();
      } catch (e) { alert(e.message); }
    };
  });
}

// ---------- ПРОФИЛЬ ----------
async function loadProfile() {
  if (!currentUser) return;
  const user = currentUser; // получен при входе
  document.getElementById('profileName').textContent = user.username;
  document.getElementById('profileStatus').innerHTML =
    (user.verified ? '✅ Верифицирован' : '') + (user.premium ? ' 💎 НБСС+' : '');
  // загружаем посты автора
  try {
    const allPosts = await request('/posts');
    const userPosts = allPosts.filter(p => p.author === user.username);
    const container = document.getElementById('profilePosts');
    container.innerHTML = userPosts.length
      ? userPosts.map(p => renderPost(p)).join('')
      : '<p>Нет постов</p>';
    attachPostActions();
  } catch (e) {
    console.error(e);
  }
}

// ---------- ИВЕНТЫ ----------
async function loadEvents() {
  const list = document.getElementById('eventsList');
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length
      ? evs.map(e => `<div class="event-banner"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('')
      : '<p>Нет активных ивентов</p>';
  } catch (e) {
    list.innerHTML = '<p>Ошибка загрузки ивентов</p>';
  }
}

// ---------- АДМИНКА ----------
async function loadAdminStats() {
  if (!currentUser?.admin) return;
  try {
    const stats = await request('/stats');
    document.getElementById('adminStats').innerHTML = `
      <h3>📊 Статистика сайта</h3>
      <div class="stat-row"><span>👥 Пользователей:</span> <span>${stats.users}</span></div>
      <div class="stat-row"><span>📝 Постов:</span> <span>${stats.posts}</span></div>
      <div class="stat-row"><span>👁️ Посещений:</span> <span>${stats.pageviews}</span></div>
      <div class="stat-row"><span>🟢 Онлайн:</span> <span>${stats.online}</span></div>`;
  } catch (e) { /* игнорируем */ }
}

async function loadAdminUsers() {
  if (!currentUser?.admin) return;
  try {
    const users = await request('/admin/users');
    const select = document.getElementById('userSelect');
    select.innerHTML = users.map(u => `<option>${u.username}</option>`).join('');
    // назначаем обработчики кнопок
    document.getElementById('verifyUserBtn').onclick = async () => {
      await modifyUser(select.value, { verified: true });
    };
    document.getElementById('unverifyUserBtn').onclick = async () => {
      await modifyUser(select.value, { verified: false });
    };
    document.getElementById('makeAdminBtn').onclick = async () => {
      await modifyUser(select.value, { admin: true });
    };
    document.getElementById('revokeAdminBtn').onclick = async () => {
      if (select.value === 'MrSigma') return alert('Нельзя разжаловать основателя');
      await modifyUser(select.value, { admin: false });
    };
    document.getElementById('givePremiumBtn').onclick = async () => {
      await modifyUser(select.value, { premium: true });
    };
    document.getElementById('revokePremiumBtn').onclick = async () => {
      await modifyUser(select.value, { premium: false });
    };
    document.getElementById('deleteUserBtn').onclick = async () => {
      if (select.value === 'MrSigma') return alert('Нельзя удалить основателя');
      if (confirm(`Удалить ${select.value}?`)) {
        await modifyUser(select.value, { delete: true });
      }
    };
  } catch (e) {
    console.error(e);
  }
}

async function modifyUser(username, changes) {
  try {
    await request(`/admin/user/${username}`, {
      method: 'POST',
      body: JSON.stringify(changes)
    });
    loadAdminUsers(); // обновим список
  } catch (e) {
    alert(e.message);
  }
}

document.getElementById('createEventBtn').addEventListener('click', async () => {
  const title = document.getElementById('eventTitle').value.trim();
  const desc = document.getElementById('eventDesc').value.trim();
  if (!title) return alert('Введите название ивента');
  try {
    await request('/events', {
      method: 'POST',
      body: JSON.stringify({ title, desc })
    });
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDesc').value = '';
    loadEvents();
    alert('Ивент создан!');
  } catch (e) {
    alert(e.message);
  }
});

// ---------- СТАТИСТИКА В ПРАВОЙ ПАНЕЛИ ----------
async function updateStats() {
  try {
    const stats = await request('/stats');
    document.getElementById('statsWidget').innerHTML = `
      <h3>📊 Активность</h3>
      <div class="stat-row"><span>👥</span> <span>${stats.users}</span></div>
      <div class="stat-row"><span>📝</span> <span>${stats.posts}</span></div>
      <div class="stat-row"><span>👁️</span> <span>${stats.pageviews}</span></div>
      <div class="stat-row"><span>🟢</span> <span>${stats.online}</span></div>`;
  } catch (e) { /* тихо */ }
}

// первоначальное обновление и затем каждые 10 секунд
updateStats();
setInterval(updateStats, 10000);
