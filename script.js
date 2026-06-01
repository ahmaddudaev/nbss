const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {};
let notifications = [];
let unreadCount = 0;
let selectedFiles = [];

const ROLE_HIERARCHY = { owner: 5, head_admin: 4, admin: 3, moderator: 2, event_moderator: 1, user: 0 };

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
    const now = new Date(); const until = new Date(bannedUntil); const diff = until - now;
    if (diff <= 0) {
      overlay.style.display = 'none'; document.querySelector('.app-container').style.display = '';
      localStorage.removeItem('nbss_token'); location.reload();
    } else {
      const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
      document.getElementById('banUntilText').textContent = `Извините, но вы забанены. До окончания бана: ${h}ч ${m}м ${s}с`;
    }
  }
  updateTimer(); setInterval(updateTimer, 1000);
}

async function request(url, options = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + url, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 423) { const data = await res.json(); showBanScreen(data.bannedUntil); throw new Error('BANNED'); }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Ошибка сети' })); throw new Error(err.error || 'Ошибка'); }
  return res.json();
}

(async function init() {
  if (token) { try { currentUser = await request('/me'); } catch (e) { if (e.message === 'BANNED') return; token = null; currentUser = null; localStorage.removeItem('nbss_token'); } }
  updateUIForAuth(); updateNotificationBadge(); showPage('home'); loadTheme();
})();

function addNotification(type, message) {
  const n = { id: Date.now(), type, message, read: false, timestamp: new Date().toISOString() };
  notifications.unshift(n); unreadCount = notifications.filter(x => !x.read).length;
  saveNotifications(); updateNotificationBadge(); showToast(message, type);
}
function saveNotifications() { localStorage.setItem('nbss_notifications', JSON.stringify(notifications)); }
function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (badge) { badge.textContent = unreadCount > 9 ? '9+' : unreadCount; badge.style.display = unreadCount > 0 ? 'inline-block' : 'none'; }
}
function renderNotificationHistory() {
  const list = document.getElementById('notificationList');
  if (!list) return;
  list.innerHTML = notifications.length ? notifications.map(n => `<div class="notification-history-item"><div>${n.message}</div><div class="time">${new Date(n.timestamp).toLocaleString()}</div></div>`).join('') : '<div style="padding:12px;color:var(--text2);">Нет уведомлений</div>';
}
document.getElementById('notificationBell')?.addEventListener('click', (e) => {
  e.stopPropagation(); const panel = document.getElementById('notificationHistory'); if (!panel) return;
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) { notifications.forEach(n => n.read = true); unreadCount = 0; saveNotifications(); updateNotificationBadge(); renderNotificationHistory(); }
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationHistory'); if (!panel) return;
  if (!e.target.closest('#notificationBell') && !e.target.closest('#notificationHistory')) panel.classList.remove('active');
});
function showToast(message, type = '') {
  const container = document.getElementById('toastContainer'); if (!container) return;
  const toast = document.createElement('div'); toast.className = 'toast';
  const icon = type === 'like' ? '❤️' : type === 'repost' ? '🔄' : '✉️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast); setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page'); if (target) target.classList.add('active');
  document.querySelectorAll('[data-page]').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));
  const searchBox = document.querySelector('.search-box'); if (searchBox) searchBox.style.display = (pageId === 'home') ? 'block' : 'none';
  if (pageId === 'home') loadPosts();
  if (pageId === 'profile') { if (currentUser && !window.viewingUser) loadMyProfile(); else if (window.viewingUser) loadUserProfile(window.viewingUser); }
  if (pageId === 'messages') loadDialogs();
  if (pageId === 'events') { loadEvents(); const card = document.getElementById('createEventCard'); if (card) card.style.display = (currentUser && ['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role)) ? '' : 'none'; }
  if (pageId === 'admin') { loadAdminStats(); loadAdminUsers(); }
  if (pageId === 'settings') updateThemeSettings();
  updateStats();
}

function updateUIForAuth() {
  const loggedIn = !!token;
  const authBanner = document.getElementById('authBanner'); if (authBanner) authBanner.style.display = loggedIn ? 'none' : 'flex';
  const postComposer = document.getElementById('postComposer'); if (postComposer) postComposer.style.display = loggedIn ? 'block' : 'none';
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
  const navAdmin = document.getElementById('navAdmin'), mobAdmin = document.getElementById('mobileNavAdmin');
  if (navAdmin) navAdmin.style.display = (currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role)) ? 'flex' : 'none';
  if (mobAdmin) mobAdmin.style.display = (currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role)) ? 'flex' : 'none';
}

document.addEventListener('click', (e) => {
  const navItem = e.target.closest('[data-page]');
  if (navItem) {
    e.preventDefault(); const page = navItem.dataset.page;
    if (page === 'profile' && !token) return alert('Сначала войдите');
    if (page === 'messages' && !token) return alert('Сначала войдите');
    if (page === 'admin' && !(currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role))) return alert('Нет прав');
    if (page === 'logout') { token = null; currentUser = null; localStorage.removeItem('nbss_token'); updateUIForAuth(); showPage('home'); return; }
    window.viewingUser = null; showPage(page); return;
  }
  const mentionEl = e.target.closest('.mention');
  if (mentionEl) { e.preventDefault(); let u = mentionEl.textContent; if (u.startsWith('@')) u = u.slice(1); if (u && u !== currentUser?.username) { window.viewingUser = u; showPage('profile'); } return; }
  const usernameEl = e.target.closest('.username');
  if (usernameEl && !e.target.closest('.view-profile-btn')) { const postEl = usernameEl.closest('.post'); if (postEl) { const a = postEl.dataset.author; if (a && a !== currentUser?.username) { window.viewingUser = a; showPage('profile'); } } }
  const delCommentBtn = e.target.closest('.delete-comment-btn');
  if (delCommentBtn) {
    const commentId = delCommentBtn.dataset.id; if (confirm('Удалить комментарий?')) {
      request(`/comments/${commentId}`, { method: 'DELETE' }).then(() => {
        const postEl = delCommentBtn.closest('.post'); if (postEl) loadComments(postEl.dataset.id, postEl.querySelector('.comments-section'));
      }).catch(err => alert(err.message));
    }
  }
});

document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('loginUsername')?.value.trim(); const p = document.getElementById('loginPassword')?.value.trim();
  if (!u || !p) return alert('Заполните поля');
  try { const data = await request('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); token = data.token; currentUser = data.user; localStorage.setItem('nbss_token', token); updateUIForAuth(); showPage('home'); } catch (e) { alert(e.message); }
});
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('regUsername')?.value.trim(); const p = document.getElementById('regPassword')?.value.trim();
  if (!u || !p) return alert('Заполните поля'); if (/\s/.test(u)) return alert('Логин не должен содержать пробелы'); if (u.length < 3) return alert('Минимум 3 символа');
  try { await request('/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); alert('Аккаунт создан! Войдите.'); showPage('login'); } catch (e) { alert(e.message); }
});

function applyTheme(theme) { document.body.classList.remove('classic','liquid-light','liquid-dark','retro-light','retro-dark'); document.body.classList.add(theme); localStorage.setItem('nbss_theme', theme); }
function loadTheme() { applyTheme(localStorage.getItem('nbss_theme') || 'classic'); }
function updateThemeSettings() { const radios = document.querySelectorAll('input[name="theme"]'); const cur = localStorage.getItem('nbss_theme') || 'classic'; radios.forEach(r => { r.checked = (r.value === cur); }); }
document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('input[name="theme"]').forEach(radio => { radio.addEventListener('change', (e) => { if (e.target.checked) applyTheme(e.target.value); }); }); });

// Загрузка файлов
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
  // Галерея (фото над текстом)
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
  document.querySelectorAll('.translate-btn').forEach(btn => { btn.onclick = async function() { /* ... */ }; });
  document.querySelectorAll('.delete-post-btn').forEach(btn => { btn.onclick = async function(e) { e.stopPropagation(); if (!token) return alert('Войдите'); if (confirm('Удалить этот пост?')) { try { await request(`/posts/${this.dataset.postId}`, { method: 'DELETE' }); loadPosts(); } catch (err) { alert(err.message); } } }; });
}

// Остальные функции (loadComments, renderComment, loadMyProfile, loadUserProfile, loadDialogs, openChat, loadMessages, loadEvents, loadAdminStats, loadAdminUsers, modifyUser, updateStats, поиск) полностью совпадают с последней версией из предыдущих ответов.
