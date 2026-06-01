const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {};
let notifications = [];
let unreadCount = 0;
let selectedFiles = [];

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

function showBanScreen(bannedUntil) {
  const overlay = document.getElementById('banOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.querySelector('.app-container').style.display = 'none';
  function updateTimer() {
    const now = new Date();
    const until = new Date(bannedUntil);
    const diff = until - now;
    if (diff <= 0) {
      overlay.style.display = 'none';
      document.querySelector('.app-container').style.display = '';
      localStorage.removeItem('nbss_token');
      location.reload();
    } else {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      document.getElementById('banUntilText').textContent =
        `Извините, но вы забанены. До окончания бана: ${hours}ч ${minutes}м ${seconds}с`;
    }
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

async function request(url, options = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + url, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 423) {
    const data = await res.json();
    showBanScreen(data.bannedUntil);
    throw new Error('BANNED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сети' }));
    throw new Error(err.error || 'Ошибка');
  }
  return res.json();
}

(async function init() {
  if (token) {
    try {
      currentUser = await request('/me');
    } catch (e) {
      if (e.message === 'BANNED') return;
      token = null; currentUser = null;
      localStorage.removeItem('nbss_token');
    }
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
  if (pageId === 'events') {
    loadEvents();
    const createCard = document.getElementById('createEventCard');
    if (createCard) {
      createCard.style.display = (currentUser && ['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role)) ? '' : 'none';
    }
  }
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
  document.body.classList.remove('classic', 'liquid-light', 'liquid-dark', 'retro-light', 'retro-dark');
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

const postImageInput = document.getElementById('postImageInput');
const previewContainer = document.getElementById('imagePreviewContainer');
if (postImageInput) {
  postImageInput.addEventListener('change', () => { selectedFiles = Array.from(postImageInput.files); renderPreviews(); });
}
function renderPreviews() {
  if (!previewContainer) return; previewContainer.innerHTML = '';
  if (selectedFiles.length === 0) { previewContainer.style.display = 'none'; return; }
  previewContainer.style.display = 'flex';
  selectedFiles.forEach((file, idx) => {
    const reader = new FileReader(); reader.onload = (e) => {
      const wrap = document.createElement('div'); wrap.className = 'preview-image-wrapper';
      const img = document.createElement('img'); img.src = e.target.result; img.className = 'preview-image';
      const btn = document.createElement('button'); btn.className = 'remove-preview-btn'; btn.textContent = '✕';
      btn.onclick = () => { selectedFiles.splice(idx, 1); renderPreviews(); };
      wrap.appendChild(img); wrap.appendChild(btn); previewContainer.appendChild(wrap);
    }; reader.readAsDataURL(file);
  });
}

document.getElementById('publishPost')?.addEventListener('click', async () => {
  const text = document.getElementById('postInput')?.value.trim();
  if (!text && selectedFiles.length === 0) return;
  const formData = new FormData(); if (text) formData.append('text', text);
  selectedFiles.forEach(f => formData.append('images', f));
  try {
    await request('/posts', { method: 'POST', body: formData });
    document.getElementById('postInput').value = ''; selectedFiles = []; renderPreviews(); postImageInput.value = ''; loadPosts();
  } catch (e) { alert(e.message); }
});

async function loadPosts() {
  const container = document.getElementById('feedContainer'); if (!container) return;
  try { const posts = await request('/posts'); container.innerHTML = posts.map(p => renderPost(p)).join(''); attachPostActions(); } catch (e) { container.innerHTML = '<p>Ошибка загрузки</p>'; }
}

function renderPost(p) {
  const role = p.authorRole || 'user'; const premium = p.authorPremium === true; const verified = p.authorVerified === true;
  const canDelete = currentUser && (currentUser.username === p.author || ['moderator','admin','head_admin','owner'].includes(currentUser.role));
  let nickClass = 'role-' + role; if (premium && role === 'user') nickClass = 'premium-nick';
  let galleryHtml = '';
  if (p.images && p.images.length > 0) {
    galleryHtml = `<div class="post-gallery">${p.images.map(img => `<img src="${img}" class="post-image" alt="Фото" onclick="this.requestFullscreen()">`).join('')}</div>`;
  }
  return `<div class="post" data-id="${p.id}" data-author="${p.author}">
    <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
    <div class="post-body">
      <div class="post-header"><span class="username ${nickClass}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span><span>· ${new Date(p.timestamp).toLocaleString()}</span>${canDelete ? `<button class="delete-post-btn" data-post-id="${p.id}">🗑️</button>` : ''}</div>
      ${galleryHtml}
      ${p.text ? `<div class="post-text" id="text-${p.id}">${p.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}</div>` : ''}
      <div class="post-actions"><button class="like-btn">❤️ ${p.likes.length}</button><button class="repost-btn">🔄 ${p.reposts.length}</button><button class="comment-toggle">💬 Комментарии</button><button class="translate-btn" data-post-id="${p.id}">🌐 Перевести</button></div>
      <div class="comments-section" style="display:none;"></div>
    </div>
  </div>`;
}

function attachPostActions() {
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите'); const postEl = this.closest('.post');
    if (postEl.dataset.author === currentUser?.username) return showToast('Хорошая попытка, но так нельзя', 'like');
    try { await request(`/posts/${postEl.dataset.id}/like`, { method: 'POST' }); loadPosts(); } catch (e) { alert(e.message); }
  });
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите'); const postEl = this.closest('.post');
    if (postEl.dataset.author === currentUser?.username) return showToast('Хорошая попытка, но так нельзя', 'repost');
    try { await request(`/posts/${postEl.dataset.id}/repost`, { method: 'POST' }); loadPosts(); } catch (e) { alert(e.message); }
  });
  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() {
    const postEl = this.closest('.post'); const section = postEl.querySelector('.comments-section');
    if (section.style.display === 'none') { section.style.display = 'block'; await loadComments(postEl.dataset.id, section); }
    else section.style.display = 'none';
  });
  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = async function() {
      const postId = this.dataset.postId; const textEl = document.getElementById(`text-${postId}`);
      if (!textEl) return; const originalText = textEl.dataset.original || textEl.textContent;
      textEl.dataset.original = originalText;
      if (translatedPosts[postId]) { textEl.textContent = originalText; delete translatedPosts[postId]; return; }
      textEl.textContent = 'Перевод...';
      try {
        const targetLang = navigator.language || 'en';
        const data = await request('/translate', { method: 'POST', body: JSON.stringify({ text: originalText, target: targetLang }) });
        textEl.textContent = data.translation; translatedPosts[postId] = data.translation;
      } catch (e) { textEl.textContent = originalText; alert('Не удалось перевести'); }
    };
  });
  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.onclick = async function(e) {
      e.stopPropagation(); if (!token) return alert('Войдите');
      if (confirm('Удалить этот пост?')) {
        try { await request(`/posts/${this.dataset.postId}`, { method: 'DELETE' }); loadPosts(); } catch (err) { alert(err.message); }
      }
    };
  });
}

async function loadComments(postId, container) {
  if (!container) return;
  try {
    const comments = await request(`/posts/${postId}/comments`);
    container.innerHTML = comments.map(c => renderComment(c)).join('') +
      (token ? `<div class="comment-form"><input type="text" class="comment-input" placeholder="Комментарий..."><button class="btn primary comment-submit">Отпр.</button></div>` : '<p>Войдите, чтобы комментировать</p>');
    if (token) {
      const inp = container.querySelector('.comment-input'); const btn = container.querySelector('.comment-submit');
      if (btn) btn.onclick = async () => { const text = inp.value.trim(); if (!text) return; await request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }); await loadComments(postId, container); };
    }
  } catch (e) {}
}

function renderComment(c) {
  const role = c.authorRole || 'user'; const premium = c.authorPremium === true; const verified = c.authorVerified === true;
  let canDelete = currentUser && (currentUser.username === c.author || ['moderator','admin','head_admin','owner'].includes(currentUser.role));
  let nickClass = 'role-' + role; if (premium && role === 'user') nickClass = 'premium-nick';
  return `<div class="comment" data-id="${c.id}"><div class="avatar-small">${c.author[0]?.toUpperCase()}</div><div class="comment-body"><span class="username ${nickClass}">${c.author}${verified ? '<img src="verification.png" class="verified-icon">' : ''}</span><span>${new Date(c.timestamp).toLocaleString()}</span><p class="comment-text">${c.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}</p>${canDelete ? `<button class="delete-comment-btn" data-id="${c.id}">🗑️</button>` : ''}</div></div>`;
}

async function loadMyProfile() {
  if (!currentUser) return; const header = document.getElementById('profileHeader'); if (!header) return;
  let nickClass = 'role-' + (currentUser.role || 'user'); if (currentUser.premium && currentUser.role === 'user') nickClass = 'premium-nick';
  header.innerHTML = `<h2 class="${nickClass}">${currentUser.username} ${currentUser.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${currentUser.role !== 'user' ? '🔹 ' + currentUser.role : ''} ${currentUser.premium ? '💎 НБСС+' : ''}</p>`;
  const allPosts = await request('/posts'); const userPosts = allPosts.filter(p => p.author === currentUser.username);
  const profilePosts = document.getElementById('profilePosts'); if (profilePosts) profilePosts.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
  attachPostActions();
}

async function loadUserProfile(username) {
  try {
    const user = await request(`/user/${username}`); const header = document.getElementById('profileHeader'); if (!header) return;
    let nickClass = 'role-' + (user.role || 'user'); if (user.premium && user.role === 'user') nickClass = 'premium-nick';
    header.innerHTML = `<h2 class="${nickClass}">${user.username} ${user.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${user.role !== 'user' ? '🔹 ' + user.role : ''} ${user.premium ? '💎 НБСС+' : ''}</p><div class="profile-actions"><button class="btn primary send-message-btn" data-username="${user.username}">💬 Написать сообщение</button></div>`;
    const btn = document.querySelector('.send-message-btn'); if (btn) btn.addEventListener('click', () => { window.viewingUser = null; currentDialog = username; showPage('messages'); openChat(username); });
    const allPosts = await request('/posts'); const userPosts = allPosts.filter(p => p.author === username);
    const profilePosts = document.getElementById('profilePosts'); if (profilePosts) profilePosts.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
    attachPostActions();
  } catch (e) { const header = document.getElementById('profileHeader'); if (header) header.innerHTML = '<p>Пользователь не найден</p>'; }
}

async function loadDialogs() { /* полный код из предыдущего ответа */ }
async function openChat(username) { /* ... */ }
async function loadMessages(username) { /* ... */ }
document.getElementById('sendMessageBtn')?.addEventListener('click', async () => { /* ... */ });
document.querySelector('.back-to-dialogs')?.addEventListener('click', () => { /* ... */ });

async function loadEvents() {
  const list = document.getElementById('eventsList'); if (!list) return;
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner card"><strong>${e.title}</strong><p>${e.desc}</p>${currentUser && ['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role) && e.id ? `<button class="btn danger delete-event-btn" data-event-id="${e.id}">🗑 Удалить</button>` : ''}</div>`).join('') : '<p>Нет ивентов</p>';
    document.querySelectorAll('.delete-event-btn').forEach(btn => { btn.addEventListener('click', async () => { if (confirm('Удалить ивент?')) { await request(`/events/${btn.dataset.eventId}`, { method: 'DELETE' }); loadEvents(); } }); });
  } catch (e) {}
}

document.getElementById('createEventBtnEvents')?.addEventListener('click', async () => {
  if (!currentUser || !['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role)) return alert('Нет прав');
  const title = document.getElementById('eventTitleEvents')?.value.trim();
  const desc = document.getElementById('eventDescEvents')?.value.trim();
  if (!title) return;
  await request('/events', { method: 'POST', body: JSON.stringify({ title, desc }) });
  document.getElementById('eventTitleEvents').value = ''; document.getElementById('eventDescEvents').value = '';
  loadEvents();
});

async function loadAdminStats() { /* ... */ }
async function loadAdminUsers() { /* полный код из предыдущего ответа */ }
async function modifyUser(username, changes) { /* ... */ }
document.getElementById('createEventBtn')?.addEventListener('click', async () => { /* ... */ });

async function updateStats() {
  try { await request('/stats'); } catch (e) {}
}
updateStats();
setInterval(updateStats, 10000);

document.getElementById('searchInput')?.addEventListener('input', async (e) => {
  const q = e.target.value.trim(); const container = document.getElementById('searchResults'); if (!container) return;
  if (!q) { container.innerHTML = ''; return; }
  try {
    const users = await request(`/users/search?q=${encodeURIComponent(q)}`);
    container.innerHTML = users.map(u => {
      let nickClass = 'role-' + (u.role || 'user'); if (u.premium && u.role === 'user') nickClass = 'premium-nick';
      return `<div class="search-user"><span class="username ${nickClass}">${u.username}${u.verified ? '<img src="verification.png" class="verified-icon">' : ''}</span><button class="btn outline view-profile-btn" data-username="${u.username}">→</button></div>`;
    }).join('');
    document.querySelectorAll('.view-profile-btn').forEach(btn => { btn.addEventListener('click', () => { window.viewingUser = btn.dataset.username; showPage('profile'); }); });
  } catch (e) {}
});
