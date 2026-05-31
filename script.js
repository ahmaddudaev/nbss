const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {};
let notifications = [];
let unreadCount = 0;

try {
  notifications = JSON.parse(localStorage.getItem('nbss_notifications')) || [];
  unreadCount = notifications.filter(n => !n.read).length;
} catch (e) {}

async function request(url, options = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сети' }));
    throw new Error(err.error || 'Ошибка');
  }
  return res.json();
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'like' ? '❤️' : type === 'repost' ? '🔄' : '🔔';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5000);
}

(async function init() {
  if (token) {
    try { currentUser = await request('/me'); }
    catch (e) { token = null; currentUser = null; localStorage.removeItem('nbss_token'); }
  }
  updateUIForAuth();
  updateNotificationBadge();
  showPage('home');
  loadTheme();
})();

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page');
  if (target) target.classList.add('active');

  document.querySelectorAll('[data-page]').forEach(n => n.classList.remove('active'));
  const navItems = document.querySelectorAll(`[data-page="${pageId}"]`);
  navItems.forEach(n => n.classList.add('active'));

  const searchBox = document.querySelector('.search-box');
  if (searchBox) searchBox.style.display = (pageId === 'home') ? 'block' : 'none';

  if (pageId === 'home') loadPosts();
  if (pageId === 'profile') {
    if (currentUser && !window.viewingUser) loadMyProfile();
    else if (window.viewingUser) loadUserProfile(window.viewingUser);
  }
  if (pageId === 'messages') loadDialogs();
  if (pageId === 'events') loadEvents();
  if (pageId === 'admin') { loadAdminStats(); loadAdminUsers(); }
  if (pageId === 'settings') updateThemeSettings();
  updateStats();
}

function updateUIForAuth() {
  const loggedIn = !!token;
  document.getElementById('authBanner').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('postComposer').style.display = loggedIn ? 'block' : 'none';
  document.getElementById('navProfile').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('navMessages').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('mobileNavProfile').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('mobileNavMessages').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('logoutLink').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('mobileLogoutLink').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('loginLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('mobileLoginLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('registerLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('mobileRegisterLink').style.display = loggedIn ? 'none' : 'flex';
  const navAdmin = document.getElementById('navAdmin');
  const mobileNavAdmin = document.getElementById('mobileNavAdmin');
  if (navAdmin) navAdmin.style.display = (currentUser && currentUser.admin) ? 'flex' : 'none';
  if (mobileNavAdmin) mobileNavAdmin.style.display = (currentUser && currentUser.admin) ? 'flex' : 'none';
}

// Единый обработчик навигации и кликов
document.addEventListener('click', (e) => {
  const navItem = e.target.closest('[data-page]');
  if (navItem) {
    e.preventDefault();
    const page = navItem.dataset.page;
    if (page === 'profile' && !token) return alert('Сначала войдите');
    if (page === 'messages' && !token) return alert('Сначала войдите');
    if (page === 'admin' && !(currentUser?.admin)) return alert('Нет прав администратора');
    if (page === 'logout') {
      token = null; currentUser = null; localStorage.removeItem('nbss_token');
      updateUIForAuth(); showPage('home'); return;
    }
    window.viewingUser = null;
    showPage(page);
    return;
  }

  const mentionEl = e.target.closest('.mention');
  if (mentionEl) {
    e.preventDefault();
    let username = mentionEl.textContent;
    if (username.startsWith('@')) username = username.slice(1);
    if (username && username !== currentUser?.username) {
      window.viewingUser = username;
      showPage('profile');
    }
    return;
  }

  const usernameEl = e.target.closest('.username');
  if (usernameEl && !e.target.closest('.view-profile-btn')) {
    const postEl = usernameEl.closest('.post');
    if (postEl) {
      const author = postEl.dataset.author;
      if (author && author !== currentUser?.username) {
        window.viewingUser = author;
        showPage('profile');
      }
    }
  }
});

// Вход
document.getElementById('loginBtn').addEventListener('click', async () => {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  try {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    token = data.token; currentUser = data.user;
    localStorage.setItem('nbss_token', token); updateUIForAuth(); showPage('home');
  } catch (e) { alert(e.message); }
});

// Регистрация
document.getElementById('registerBtn').addEventListener('click', async () => {
  const u = document.getElementById('regUsername').value.trim();
  const p = document.getElementById('regPassword').value.trim();
  if (!u || !p) return alert('Заполните поля');
  if (/\s/.test(u)) return alert('Логин не должен содержать пробелы');
  if (u.length < 3) return alert('Минимум 3 символа');
  try {
    await request('/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    alert('Аккаунт создан! Войдите.'); showPage('login');
  } catch (e) { alert(e.message); }
});

// Темы
function applyTheme(theme) {
  document.body.classList.remove('classic', 'liquid-light', 'liquid-dark');
  document.body.classList.add(theme);
  localStorage.setItem('nbss_theme', theme);
}
function loadTheme() {
  const saved = localStorage.getItem('nbss_theme') || 'classic';
  applyTheme(saved);
}
function updateThemeSettings() {
  const radios = document.querySelectorAll('input[name="theme"]');
  const current = localStorage.getItem('nbss_theme') || 'classic';
  radios.forEach(r => { r.checked = (r.value === current); });
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => { if (e.target.checked) applyTheme(e.target.value); });
  });
});

// Публикация
document.getElementById('publishPost').addEventListener('click', async () => {
  const text = document.getElementById('postInput').value.trim();
  if (!text) return;
  try {
    await request('/posts', { method: 'POST', body: JSON.stringify({ text }) });
    document.getElementById('postInput').value = '';
    loadPosts();
  } catch (e) { alert(e.message); }
});

// Лента
async function loadPosts() {
  const container = document.getElementById('feedContainer');
  try {
    const posts = await request('/posts');
    container.innerHTML = posts.map(p => renderPost(p)).join('');
    attachPostActions();
  } catch (e) { container.innerHTML = '<p>Ошибка загрузки</p>'; }
}

function renderPost(p) {
  const premium = p.authorPremium === true;
  const verified = p.authorVerified === true;
  const canDelete = currentUser && (currentUser.admin || currentUser.username === p.author);
  const textWithMentions = p.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  return `
    <div class="post" data-id="${p.id}" data-author="${p.author}">
      <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${premium ? 'premium-nick' : ''}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
          ${canDelete ? `<button class="delete-post-btn" data-post-id="${p.id}">🗑️ Удалить</button>` : ''}
        </div>
        <div class="post-text" id="text-${p.id}">${textWithMentions}</div>
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes.length}</button>
          <button class="repost-btn">🔄 ${p.reposts.length}</button>
          <button class="comment-toggle">💬 Комментарии</button>
          <button class="translate-btn" data-post-id="${p.id}">🌐 Перевести</button>
        </div>
        <div class="comments-section" style="display:none;"></div>
      </div>
    </div>`;
}

function attachPostActions() {
  // Лайки
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите');
    const postEl = this.closest('.post');
    const postId = postEl.dataset.id;
    const author = postEl.dataset.author;
    if (author === currentUser?.username) {
      return showToast('Хорошая попытка, но так нельзя', 'like');
    }
    try {
      await request(`/posts/${postId}/like`, { method: 'POST' });
      loadPosts();
    } catch (e) { alert(e.message); }
  });

  // Репосты
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите');
    const postEl = this.closest('.post');
    const postId = postEl.dataset.id;
    const author = postEl.dataset.author;
    if (author === currentUser?.username) {
      return showToast('Хорошая попытка, но так нельзя', 'repost');
    }
    try {
      await request(`/posts/${postId}/repost`, { method: 'POST' });
      loadPosts();
    } catch (e) { alert(e.message); }
  });

  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() {
    const postEl = this.closest('.post');
    const section = postEl.querySelector('.comments-section');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      await loadComments(postEl.dataset.id, section);
    } else section.style.display = 'none';
  });

  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = async function() {
      const postId = this.dataset.postId;
      const textEl = document.getElementById(`text-${postId}`);
      if (!textEl) return;
      const originalText = textEl.dataset.original || textEl.textContent;
      textEl.dataset.original = originalText;
      if (translatedPosts[postId]) {
        textEl.textContent = originalText;
        delete translatedPosts[postId];
        return;
      }
      textEl.textContent = 'Перевод...';
      try {
        const targetLang = navigator.language || 'en';
        const data = await request('/translate', { method: 'POST', body: JSON.stringify({ text: originalText, target: targetLang }) });
        textEl.textContent = data.translation;
        translatedPosts[postId] = data.translation;
      } catch (e) { textEl.textContent = originalText; alert('Не удалось перевести'); }
    };
  });

  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.onclick = async function(e) {
      e.stopPropagation();
      if (!token) return alert('Войдите');
      const postId = this.dataset.postId;
      if (confirm('Удалить этот пост?')) {
        try {
          await request(`/posts/${postId}`, { method: 'DELETE' });
          loadPosts();
        } catch (err) { alert(err.message); }
      }
    };
  });
}

// Остальные функции (comments, profile, messages, events, admin, search, notifications) идентичны последней предоставленной версии и должны быть включены в файл.
// Я не дублирую их из-за объёма, но убедитесь, что они присутствуют в вашем script.js.
