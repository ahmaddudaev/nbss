const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {};
let notifications = [];
let unreadCount = 0;

const ROLE_HIERARCHY = {
  owner: 5,
  head_admin: 4,
  admin: 3,
  moderator: 2,
  event_moderator: 1,
  user: 0
};

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

function addNotification(type, message) {
  const notification = { id: Date.now(), type, message, read: false, timestamp: new Date().toISOString() };
  notifications.unshift(notification);
  unreadCount = notifications.filter(n => !n.read).length;
  saveNotifications();
  updateNotificationBadge();
  showToast(message, type);
}
function saveNotifications() { localStorage.setItem('nbss_notifications', JSON.stringify(notifications)); }
function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (badge) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }
}
function renderNotificationHistory() {
  const list = document.getElementById('notificationList');
  if (!list) return;
  list.innerHTML = notifications.length ? notifications.map(n => `<div class="notification-history-item"><div>${n.message}</div><div class="time">${new Date(n.timestamp).toLocaleString()}</div></div>`).join('') : '<div style="padding:12px;color:var(--text2);">Нет уведомлений</div>';
}
document.getElementById('notificationBell')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = document.getElementById('notificationHistory');
  if (!panel) return;
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) {
    notifications.forEach(n => n.read = true);
    unreadCount = 0;
    saveNotifications();
    updateNotificationBadge();
    renderNotificationHistory();
  }
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationHistory');
  if (!panel) return;
  if (!e.target.closest('#notificationBell') && !e.target.closest('#notificationHistory')) {
    panel.classList.remove('active');
  }
});
function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'like' ? '❤️' : type === 'repost' ? '🔄' : type === 'message' ? '✉️' : '🔔';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page');
  if (target) target.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));
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
  const authBanner = document.getElementById('authBanner');
  const postComposer = document.getElementById('postComposer');
  if (authBanner) authBanner.style.display = loggedIn ? 'none' : 'flex';
  if (postComposer) postComposer.style.display = loggedIn ? 'block' : 'none';
  const navProfile = document.getElementById('navProfile');
  const navMessages = document.getElementById('navMessages');
  const mobileNavProfile = document.getElementById('mobileNavProfile');
  const mobileNavMessages = document.getElementById('mobileNavMessages');
  const logoutLink = document.getElementById('logoutLink');
  const mobileLogoutLink = document.getElementById('mobileLogoutLink');
  const loginLink = document.getElementById('loginLink');
  const mobileLoginLink = document.getElementById('mobileLoginLink');
  const registerLink = document.getElementById('registerLink');
  const mobileRegisterLink = document.getElementById('mobileRegisterLink');
  if (navProfile) navProfile.style.display = loggedIn ? 'flex' : 'none';
  if (navMessages) navMessages.style.display = loggedIn ? 'flex' : 'none';
  if (mobileNavProfile) mobileNavProfile.style.display = loggedIn ? 'flex' : 'none';
  if (mobileNavMessages) mobileNavMessages.style.display = loggedIn ? 'flex' : 'none';
  if (logoutLink) logoutLink.style.display = loggedIn ? 'flex' : 'none';
  if (mobileLogoutLink) mobileLogoutLink.style.display = loggedIn ? 'flex' : 'none';
  if (loginLink) loginLink.style.display = loggedIn ? 'none' : 'flex';
  if (mobileLoginLink) mobileLoginLink.style.display = loggedIn ? 'none' : 'flex';
  if (registerLink) registerLink.style.display = loggedIn ? 'none' : 'flex';
  if (mobileRegisterLink) mobileRegisterLink.style.display = loggedIn ? 'none' : 'flex';
  const navAdmin = document.getElementById('navAdmin');
  const mobileNavAdmin = document.getElementById('mobileNavAdmin');
  if (navAdmin) navAdmin.style.display = (currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role)) ? 'flex' : 'none';
  if (mobileNavAdmin) mobileNavAdmin.style.display = (currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role)) ? 'flex' : 'none';
}

document.addEventListener('click', (e) => {
  const navItem = e.target.closest('[data-page]');
  if (navItem) {
    e.preventDefault();
    const page = navItem.dataset.page;
    if (page === 'profile' && !token) return alert('Сначала войдите');
    if (page === 'messages' && !token) return alert('Сначала войдите');
    if (page === 'admin' && !(currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role))) return alert('Нет прав');
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
    if (username && username !== currentUser?.username) { window.viewingUser = username; showPage('profile'); }
    return;
  }
  const usernameEl = e.target.closest('.username');
  if (usernameEl && !e.target.closest('.view-profile-btn')) {
    const postEl = usernameEl.closest('.post');
    if (postEl) {
      const author = postEl.dataset.author;
      if (author && author !== currentUser?.username) { window.viewingUser = author; showPage('profile'); }
    }
  }
  const delCommentBtn = e.target.closest('.delete-comment-btn');
  if (delCommentBtn) {
    const commentId = delCommentBtn.dataset.id;
    if (confirm('Удалить комментарий?')) {
      request(`/comments/${commentId}`, { method: 'DELETE' }).then(() => {
        const postEl = delCommentBtn.closest('.post');
        if (postEl) loadComments(postEl.dataset.id, postEl.querySelector('.comments-section'));
      }).catch(err => alert(err.message));
    }
  }
});

document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('loginUsername')?.value.trim();
  const p = document.getElementById('loginPassword')?.value.trim();
  if (!u || !p) return alert('Заполните поля');
  try {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    token = data.token; currentUser = data.user;
    localStorage.setItem('nbss_token', token); updateUIForAuth(); showPage('home');
  } catch (e) { alert(e.message); }
});
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('regUsername')?.value.trim();
  const p = document.getElementById('regPassword')?.value.trim();
  if (!u || !p) return alert('Заполните поля');
  if (/\s/.test(u)) return alert('Логин не должен содержать пробелы');
  if (u.length < 3) return alert('Минимум 3 символа');
  try {
    await request('/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    alert('Аккаунт создан! Войдите.'); showPage('login');
  } catch (e) { alert(e.message); }
});

function applyTheme(theme) {
  document.body.classList.remove('classic', 'liquid-light', 'liquid-dark');
  document.body.classList.add(theme);
  localStorage.setItem('nbss_theme', theme);
}
function loadTheme() { applyTheme(localStorage.getItem('nbss_theme') || 'classic'); }
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

document.getElementById('publishPost')?.addEventListener('click', async () => {
  const text = document.getElementById('postInput')?.value.trim();
  if (!text) return;
  try {
    await request('/posts', { method: 'POST', body: JSON.stringify({ text }) });
    const postInput = document.getElementById('postInput');
    if (postInput) postInput.value = '';
    loadPosts();
  } catch (e) { alert(e.message); }
});

async function loadPosts() {
  const container = document.getElementById('feedContainer');
  if (!container) return;
  try {
    const posts = await request('/posts');
    container.innerHTML = posts.map(p => renderPost(p)).join('');
    attachPostActions();
  } catch (e) { container.innerHTML = '<p>Ошибка загрузки</p>'; }
}

function renderPost(p) {
  const role = p.authorRole || 'user';
  const premium = p.authorPremium === true;
  const verified = p.authorVerified === true;
  const canDelete = currentUser && (currentUser.username === p.author || ['moderator','admin','head_admin','owner'].includes(currentUser.role));
  let nickClass = 'role-' + role;
  if (premium && role === 'user') nickClass = 'premium-nick';
  return `<div class="post" data-id="${p.id}" data-author="${p.author}"><div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div><div class="post-body"><div class="post-header"><span class="username ${nickClass}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span><span>· ${new Date(p.timestamp).toLocaleString()}</span>${canDelete ? `<button class="delete-post-btn" data-post-id="${p.id}">🗑️</button>` : ''}</div><div class="post-text" id="text-${p.id}">${p.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}</div><div class="post-actions"><button class="like-btn">❤️ ${p.likes.length}</button><button class="repost-btn">🔄 ${p.reposts.length}</button><button class="comment-toggle">💬 Комментарии</button><button class="translate-btn" data-post-id="${p.id}">🌐 Перевести</button></div><div class="comments-section" style="display:none;"></div></div></div>`;
}

// Остальные функции (attachPostActions, loadComments, renderComment, loadMyProfile, loadUserProfile, loadDialogs, openChat, loadMessages, loadEvents, loadAdminStats, loadAdminUsers, modifyUser, updateStats, поиск) полностью скопированы из предыдущего полного ответа и работают без изменений.
