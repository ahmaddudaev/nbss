const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;

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

// Инициализация
(async function init() {
  if (token) {
    try { currentUser = await request('/me'); }
    catch (e) { token = null; currentUser = null; localStorage.removeItem('nbss_token'); }
  }
  updateUIForAuth(); showPage('home');
})();

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page');
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');
  if (pageId === 'home') loadPosts();
  if (pageId === 'profile') loadProfile();
  if (pageId === 'events') loadEvents();
  if (pageId === 'admin') { loadAdminStats(); loadAdminUsers(); }
  updateStats();
}

function updateUIForAuth() {
  const loggedIn = !!token;
  document.getElementById('authBanner').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('postComposer').style.display = loggedIn ? 'block' : 'none';
  document.getElementById('navProfile').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('logoutLink').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('loginLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('registerLink').style.display = loggedIn ? 'none' : 'flex';
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin) navAdmin.style.display = (currentUser && currentUser.admin) ? 'flex' : 'none';
  const premStatus = document.getElementById('premiumStatusUser');
  if (premStatus) premStatus.textContent = (currentUser && currentUser.premium) ? 'Активна' : 'Не активна';
}

// Поиск людей
document.getElementById('searchInput')?.addEventListener('input', async function (e) {
  const q = e.target.value.trim();
  const container = document.getElementById('searchResults');
  if (!container) return;
  if (q.length === 0) { container.innerHTML = ''; return; }
  try {
    const users = await request(`/users/search?q=${encodeURIComponent(q)}`);
    container.innerHTML = users.map(u => `
      <div class="search-user">
        <span class="username ${u.premium ? 'premium-nick' : ''}">${u.username}${u.verified ? '<span class="verified-badge">✔️</span>' : ''}</span>
        <button class="btn outline" onclick="alert('Профиль: ${u.username}')">→</button>
      </div>
    `).join('');
  } catch (e) { /* тихо */ }
});

// Навигация
document.querySelectorAll('.nav-item[data-page]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    if (page === 'profile' && !token) return alert('Сначала войдите');
    if (page === 'admin' && !(currentUser && currentUser.admin)) return alert('Нет прав администратора');
    showPage(page);
  });
});
document.getElementById('loginFromBanner')?.addEventListener('click', () => showPage('login'));
document.getElementById('registerFromBanner')?.addEventListener('click', () => showPage('register'));

// Вход
document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  try {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    token = data.token; currentUser = data.user;
    localStorage.setItem('nbss_token', token); updateUIForAuth(); showPage('home');
  } catch (e) { alert(e.message); }
});

// Регистрация
document.getElementById('registerBtn').addEventListener('click', async () => {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  if (!username || !password) return alert('Заполните все поля');
  if (username.length < 3) return alert('Логин должен быть минимум 3 символа');
  try {
    await request('/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    alert('Аккаунт создан! Теперь войдите.'); showPage('login');
  } catch (e) { alert(e.message); }
});

document.getElementById('showRegisterLink').addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });

// Выход
document.getElementById('logoutLink').addEventListener('click', () => {
  token = null; currentUser = null; localStorage.removeItem('nbss_token');
  updateUIForAuth(); showPage('home');
});

// Смена темы
document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('nbss_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});
if (localStorage.getItem('nbss_theme') === 'light') document.body.classList.remove('dark-mode');

// Публикация поста
const postInput = document.getElementById('postInput');
postInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('publishPost').click(); }
});
document.getElementById('publishPost').addEventListener('click', async () => {
  const text = postInput.value.trim();
  if (!text) return;
  try {
    await request('/posts', { method: 'POST', body: JSON.stringify({ text }) });
    postInput.value = ''; loadPosts();
  } catch (e) { alert(e.message); }
});

// Загрузка постов
async function loadPosts() {
  const container = document.getElementById('feedContainer');
  try {
    const posts = await request('/posts');
    container.innerHTML = posts.map(p => renderPost(p)).join('');
    attachPostActions();
  } catch (e) { container.innerHTML = '<p>Ошибка загрузки ленты</p>'; }
}

function renderPost(p) {
  const nickClass = (p.authorPremium === true) ? 'premium-nick' : '';
  const verifiedIcon = (p.authorVerified === true) ? '<span class="verified-badge">✔️</span>' : '';
  const formatted = p.text.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>').replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  return `
    <div class="post" data-id="${p.id}">
      <div class="avatar">${p.author ? p.author[0]?.toUpperCase() : '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${nickClass}">${p.author || 'Аноним'}${verifiedIcon}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        <div class="post-text">${formatted}</div>
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes ? p.likes.length : 0}</button>
          <button class="repost-btn">🔄 ${p.reposts ? p.reposts.length : 0}</button>
          <button class="comment-toggle">💬 Комментарии</button>
        </div>
        <div class="comments-section" style="display:none;"></div>
      </div>
    </div>`;
}

function attachPostActions() {
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.onclick = async function() {
      if (!token) return alert('Войдите');
      const postId = this.closest('.post').dataset.id;
      try { await request(`/posts/${postId}/like`, { method: 'POST' }); loadPosts(); } catch (e) { alert(e.message); }
    };
  });
  document.querySelectorAll('.repost-btn').forEach(btn => {
    btn.onclick = async function() {
      if (!token) return alert('Войдите');
      const postId = this.closest('.post').dataset.id;
      try { await request(`/posts/${postId}/repost`, { method: 'POST' }); loadPosts(); } catch (e) { alert(e.message); }
    };
  });
  document.querySelectorAll('.comment-toggle').forEach(btn => {
    btn.onclick = async function() {
      const postEl = this.closest('.post'); const postId = postEl.dataset.id;
      const section = postEl.querySelector('.comments-section');
      if (section.style.display === 'none') { section.style.display = 'block'; await loadComments(postId, section); }
      else section.style.display = 'none';
    };
  });
}

async function loadComments(postId, container) {
  try {
    const comments = await request(`/posts/${postId}/comments`);
    container.innerHTML = `
      <div class="comments-list">${comments.map(c => renderComment(c)).join('')}</div>
      ${token ? `<div class="comment-form"><input type="text" class="comment-input" placeholder="Ваш комментарий..."><button class="btn primary comment-submit">Отправить</button></div>` : '<p class="comment-login-hint">Войдите, чтобы комментировать.</p>'}
    `;
    if (token) {
      const input = container.querySelector('.comment-input');
      const submit = container.querySelector('.comment-submit');
      submit.onclick = async () => {
        const text = input.value.trim(); if (!text) return;
        try { await request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }); await loadComments(postId, container); } catch (e) { alert(e.message); }
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit.click(); } });
    }
  } catch (e) { container.innerHTML = '<p class="error">Ошибка загрузки комментариев</p>'; }
}

function renderComment(c) {
  const nickClass = (c.authorPremium === true) ? 'premium-nick' : '';
  const verifiedIcon = (c.authorVerified === true) ? '<span class="verified-badge">✔️</span>' : '';
  return `<div class="comment"><div class="avatar-small">${c.author ? c.author[0]?.toUpperCase() : '?'}</div><div class="comment-body"><span class="username ${nickClass}">${c.author || 'Аноним'}${verifiedIcon}</span><span class="comment-time">${new Date(c.timestamp).toLocaleString()}</span><p class="comment-text">${c.text}</p></div></div>`;
}

// Профиль
async function loadProfile() {
  if (!currentUser) return;
  document.getElementById('profileName').textContent = currentUser.username;
  document.getElementById('profileStatus').innerHTML =
    (currentUser.verified ? '✅ Верифицирован' : '') + (currentUser.premium ? ' 💎 НБСС+' : '');
  try {
    const allPosts = await request('/posts');
    const userPosts = allPosts.filter(p => p.author === currentUser.username);
    const container = document.getElementById('profilePosts');
    container.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p style="padding:20px;">Нет постов</p>';
    attachPostActions();
  } catch (e) { console.error(e); }
}

// Ивенты
async function loadEvents() {
  const list = document.getElementById('eventsList');
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('') : '<p>Нет активных ивентов</p>';
  } catch (e) { list.innerHTML = '<p>Ошибка загрузки ивентов</p>'; }
}

// Админка
async function loadAdminStats() {
  if (!currentUser || !currentUser.admin) return;
  try {
    const stats = await request('/stats');
    document.getElementById('adminStats').innerHTML = `
      <h3>📊 Статистика</h3>
      <div class="stat-row"><span>👥</span> <span>${stats.users}</span></div>
      <div class="stat-row"><span>📝</span> <span>${stats.posts}</span></div>
      <div class="stat-row"><span>👁️</span> <span>${stats.pageviews}</span></div>
      <div class="stat-row"><span>🟢</span> <span>${stats.online}</span></div>`;
  } catch (e) {}
}

async function loadAdminUsers() {
  if (!currentUser || !currentUser.admin) return;
  try {
    const users = await request('/admin/users');
    const select = document.getElementById('userSelect');
    select.innerHTML = users.map(u => `<option>${u.username}</option>`).join('');
    document.getElementById('verifyUserBtn').onclick = async () => { await modifyUser(select.value, { verified: true }); };
    document.getElementById('unverifyUserBtn').onclick = async () => { await modifyUser(select.value, { verified: false }); };
    document.getElementById('makeAdminBtn').onclick = async () => { await modifyUser(select.value, { admin: true }); };
    document.getElementById('revokeAdminBtn').onclick = async () => {
      if (select.value === 'MrSigma') return alert('Нельзя разжаловать основателя');
      await modifyUser(select.value, { admin: false });
    };
    document.getElementById('givePremiumBtn').onclick = async () => { await modifyUser(select.value, { premium: true }); };
    document.getElementById('revokePremiumBtn').onclick = async () => { await modifyUser(select.value, { premium: false }); };
    document.getElementById('deleteUserBtn').onclick = async () => {
      if (select.value === 'MrSigma') return alert('Нельзя удалить основателя');
      if (confirm(`Удалить ${select.value}?`)) await modifyUser(select.value, { delete: true });
    };
  } catch (e) { console.error(e); }
}

async function modifyUser(username, changes) {
  try {
    await request(`/admin/user/${username}`, { method: 'POST', body: JSON.stringify(changes) });
    loadAdminUsers();
  } catch (e) { alert(e.message); }
}

document.getElementById('createEventBtn').addEventListener('click', async () => {
  const title = document.getElementById('eventTitle').value.trim();
  const desc = document.getElementById('eventDesc').value.trim();
  if (!title) return alert('Введите название');
  try {
    await request('/events', { method: 'POST', body: JSON.stringify({ title, desc }) });
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDesc').value = '';
    loadEvents(); alert('Ивент создан!');
  } catch (e) { alert(e.message); }
});

async function updateStats() {
  try {
    const stats = await request('/stats');
    const w = document.getElementById('statsWidget');
    if (w) w.innerHTML = `<h3>📊 Активность</h3><div class="stat-row"><span>👥</span> <span>${stats.users}</span></div><div class="stat-row"><span>📝</span> <span>${stats.posts}</span></div><div class="stat-row"><span>👁️</span> <span>${stats.pageviews}</span></div><div class="stat-row"><span>🟢</span> <span>${stats.online}</span></div>`;
  } catch (e) {}
}
updateStats();
setInterval(updateStats, 10000);
