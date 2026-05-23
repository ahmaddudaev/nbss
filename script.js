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

// Регистрация с проверкой уникальности
document.getElementById('registerBtn').addEventListener('click', async () => {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  if (!username || !password) return alert('Заполните все поля');
  if (username.length < 3) return alert('Логин должен быть минимум 3 символа');
  try {
    await request('/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    alert('Аккаунт создан! Теперь войдите.'); showPage('login');
  } catch (e) { alert(e.message); } // "Пользователь уже существует" если дубликат
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

// Публикация поста (Enter)
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
  const nickClass = p.authorPremium ? 'premium-nick' : '';
  const verifiedIcon = p.authorVerified ? '<span class="verified-badge">✔️</span>' : '';
  const formatted = p.text.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>').replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  return `
    <div class="post" data-id="${p.id}">
      <div class="avatar">${p.author[0]?.toUpperCase()}</div>
      <div class="post-body">
        <div class="post-header"><span class="username ${nickClass}">${p.author}${verifiedIcon}</span><span>· ${new Date(p.timestamp).toLocaleString()}</span></div>
        <div class="post-text">${formatted}</div>
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes.length}</button>
          <button class="repost-btn">🔄 ${p.reposts.length}</button>
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
  const nickClass = c.authorPremium ? 'premium-nick' : '';
  const verifiedIcon = c.authorVerified ? '<span class="verified-badge">✔️</span>' : '';
  return `<div class="comment"><div class="avatar-small">${c.author[0]?.toUpperCase()}</div><div class="comment-body"><span class="username ${nickClass}">${c.author}${verifiedIcon}</span><span class="comment-time">${new Date(c.timestamp).toLocaleString()}</span><p class="comment-text">${c.text}</p></div></div>`;
}

// Профиль, ивенты, админка – остальной код без изменений
