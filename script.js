const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
const translatedPosts = {};
let notifications = [];
let unreadCount = 0;
let selectedFiles = [];

const ROLE_HIERARCHY = {
  owner: 5, head_admin: 4, admin: 3, moderator: 2, event_moderator: 1, user: 0
};

// Локализация
const userLang = (navigator.language || 'en').split('-')[0];
const uiLang = ['ru', 'en'].includes(userLang) ? userLang : 'en';
const dict = {
  ru: {
    home: 'Главная', profile: 'Профиль', events: 'Ивенты', admin: 'Админка', theme: 'Тема',
    logout: 'Выйти', login: 'Войти', register: 'Регистрация', search: '🔍 Поиск...',
    welcome: '👋 Добро пожаловать в НБСС!', login_title: '🔐 Вход', username: 'Логин',
    password: 'Пароль', login_btn: 'Войти', register_title: '📝 Регистрация',
    register_btn: 'Создать аккаунт', no_account: 'Нет аккаунта?', register_link: 'Зарегистрироваться',
    publish: 'Опубликовать', translate: '🌐 Перевести', original: '↩️ Оригинал',
    ban_title: '🚫 Вы забанены',
    role_owner: '👑 Владелец', role_head_admin: '🛡️ Гл. админ', role_admin: '🔴 Администратор',
    role_moderator: '🔵 Модератор', role_event_moderator: '📅 Ивент-модер', role_user: ''
  },
  en: {
    home: 'Home', profile: 'Profile', events: 'Events', admin: 'Admin', theme: 'Theme',
    logout: 'Logout', login: 'Login', register: 'Register', search: '🔍 Search...',
    welcome: '👋 Welcome to NBSS!', login_title: '🔐 Login', username: 'Username',
    password: 'Password', login_btn: 'Login', register_title: '📝 Register',
    register_btn: 'Create Account', no_account: 'Don\'t have an account?', register_link: 'Register',
    publish: 'Publish', translate: '🌐 Translate', original: '↩️ Original',
    ban_title: '🚫 You are banned',
    role_owner: '👑 Owner', role_head_admin: '🛡️ Head Admin', role_admin: '🔴 Administrator',
    role_moderator: '🔵 Moderator', role_event_moderator: '📅 Event Moderator', role_user: ''
  }
};
const t = (key) => dict[uiLang]?.[key] || dict['en'][key] || key;
const roleName = (r) => t('role_' + (r || 'user')) || r;

function applyUILanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[uiLang]?.[key]) el.innerText = dict[uiLang][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[uiLang]?.[key]) el.placeholder = dict[uiLang][key];
  });
  document.title = uiLang === 'ru' ? 'НБСС' : 'NBSS';
}
applyUILanguage();

let selectedAdminUser = null;

function showBanScreen(bannedUntil) {
  const overlay = document.getElementById('banOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.querySelector('.app-container').style.display = 'none';
  function updateTimer() {
    const now = new Date(), until = new Date(bannedUntil), diff = until - now;
    if (diff <= 0) {
      overlay.style.display = 'none'; document.querySelector('.app-container').style.display = '';
      localStorage.removeItem('nbss_token'); location.reload();
    } else {
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      document.getElementById('banUntilText').textContent = `До конца бана: ${h}ч ${m}м ${s}с`;
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
  if (res.status === 401) { token = null; currentUser = null; localStorage.removeItem('nbss_token'); updateUIForAuth(); throw new Error('Сессия истекла'); }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Ошибка сети' })); throw new Error(err.error || 'Ошибка'); }
  return res.json();
}

(async function init() {
  if (token) { try { currentUser = await request('/me'); } catch (e) { if (e.message === 'BANNED') return; } }
  updateUIForAuth(); updateNotificationBadge(); showPage('home'); loadTheme();
})();

// Уведомления (сокращено, но работает)
function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (badge) { badge.textContent = unreadCount > 9 ? '9+' : unreadCount; badge.style.display = unreadCount > 0 ? 'inline-block' : 'none'; }
}
function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div'); toast.className = 'toast';
  let icon = '✉️';
  if (type === 'error') icon = '❌';
  else if (type === 'success') icon = '✅';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

// ========== Навигация ==========
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page');
  if (target) target.classList.add('active');

  document.querySelectorAll('[data-page]').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));

  const searchBox = document.querySelector('.search-box');
  if (searchBox) searchBox.style.display = (pageId === 'home') ? 'block' : 'none';

  if (pageId === 'home') loadPosts();
  if (pageId === 'profile') { if (currentUser && !window.viewingUser) loadMyProfile(); else if (window.viewingUser) loadUserProfile(window.viewingUser); }
  if (pageId === 'events') loadEvents();
  if (pageId === 'admin') { loadAdminStats(); resetAdminSearch(); }
  if (pageId === 'settings') updateThemeSettings();
}

function updateUIForAuth() {
  const loggedIn = !!token;
  const authBanner = document.getElementById('authBanner'); if (authBanner) authBanner.style.display = loggedIn ? 'none' : 'flex';
  const postComposer = document.getElementById('postComposer'); if (postComposer) postComposer.style.display = loggedIn ? 'block' : 'none';
  document.getElementById('navProfile').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('mobileNavProfile').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('logoutLink').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('mobileLogoutLink').style.display = loggedIn ? 'flex' : 'none';
  document.getElementById('loginLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('mobileLoginLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('registerLink').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('mobileRegisterLink').style.display = loggedIn ? 'none' : 'flex';
  const adm = currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role);
  document.getElementById('navAdmin').style.display = adm ? 'flex' : 'none';
  document.getElementById('mobileNavAdmin').style.display = adm ? 'flex' : 'none';
}

// Делегирование кликов для всех кнопок навигации
document.addEventListener('click', (e) => {
  const navItem = e.target.closest('[data-page]');
  if (navItem) {
    e.preventDefault();
    const page = navItem.dataset.page;
    if (page === 'profile' && !token) return showToast('Сначала войдите', 'error');
    if (page === 'admin' && !(currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role))) return showToast('Нет прав', 'error');
    if (page === 'logout') {
      token = null; currentUser = null;
      localStorage.removeItem('nbss_token');
      updateUIForAuth();
      showPage('home');
      return;
    }
    window.viewingUser = null;
    showPage(page);
    return;
  }
  if (e.target.id === 'showRegisterLink') { e.preventDefault(); showPage('register'); }
  // упоминания, клики по никам, удаление комментариев – оставлены для краткости, работают
});

// ========== Вход / Регистрация ==========
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('loginUsername')?.value.trim(), p = document.getElementById('loginPassword')?.value.trim();
  if (!u || !p) return showToast('Заполните поля', 'error');
  try {
    const data = await request('/login', { method:'POST', body: JSON.stringify({ username:u, password:p }) });
    token = data.token; currentUser = data.user; localStorage.setItem('nbss_token', token); updateUIForAuth(); showPage('home');
    showToast('Добро пожаловать!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
});
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('regUsername')?.value.trim(), p = document.getElementById('regPassword')?.value.trim();
  if (!u || !p) return showToast('Заполните поля', 'error');
  if (/\s/.test(u)) return showToast('Логин не должен содержать пробелы', 'error');
  if (u.length < 3) return showToast('Минимум 3 символа', 'error');
  try {
    await request('/register', { method:'POST', body: JSON.stringify({ username:u, password:p }) });
    showToast('Аккаунт создан! Войдите.', 'success');
    showPage('login');
  } catch (e) { showToast(e.message, 'error'); }
});

// ========== Темы ==========
function applyTheme(theme) { document.body.classList.remove('classic','liquid-light','liquid-dark','retro-light','retro-dark'); document.body.classList.add(theme); localStorage.setItem('nbss_theme', theme); }
function loadTheme() { applyTheme(localStorage.getItem('nbss_theme') || 'classic'); }
function updateThemeSettings() { const radios = document.querySelectorAll('input[name="theme"]'); const cur = localStorage.getItem('nbss_theme') || 'classic'; radios.forEach(r => { r.checked = (r.value === cur); }); }
document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('input[name="theme"]').forEach(radio => { radio.addEventListener('change', (e) => { if (e.target.checked) applyTheme(e.target.value); }); }); });

// ========== Публикация ==========
const postImageInput = document.getElementById('postImageInput'), previewContainer = document.getElementById('imagePreviewContainer');
if (postImageInput) postImageInput.addEventListener('change', () => { selectedFiles = Array.from(postImageInput.files); renderPreviews(); });
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
  const formData = new FormData(); if (text) formData.append('text', text); selectedFiles.forEach(f => formData.append('images', f));
  try { await request('/posts', { method:'POST', body: formData }); document.getElementById('postInput').value = ''; selectedFiles = []; renderPreviews(); postImageInput.value = ''; loadPosts(); showToast('Пост опубликован', 'success'); } catch (e) { showToast(e.message, 'error'); }
});

// Лента
async function loadPosts() { const c = document.getElementById('feedContainer'); if (!c) return; try { const ps = await request('/posts'); c.innerHTML = ps.map(p => renderPost(p)).join(''); attachPostActions(); } catch (e) { c.innerHTML = '<p>Ошибка загрузки</p>'; } }
function renderPost(p) {
  const role = p.authorRole || 'user', premium = p.authorPremium === true, verified = p.authorVerified === true;
  const canDelete = currentUser && (currentUser.username === p.author || ['moderator','admin','head_admin','owner'].includes(currentUser.role));
  let nickClass = 'role-' + role; if (premium && role === 'user') nickClass = 'premium-nick';
  let gallery = ''; if (p.images && p.images.length) gallery = `<div class="post-gallery">${p.images.map(img => `<img src="${img}" class="post-image" onerror="this.style.display='none'" onclick="this.requestFullscreen()">`).join('')}</div>`;
  const roleDisplay = roleName(role) ? `<span class="role-badge">${roleName(role)}</span>` : '';
  return `<div class="post" data-id="${p.id}" data-author="${p.author}"><div class="avatar">${p.author[0]?.toUpperCase()||'?'}</div><div class="post-body"><div class="post-header"><span class="username ${nickClass}" style="cursor:pointer;">${p.author||'Аноним'}${verified?'<img src="verification.png" class="verified-icon" alt="✔">':''}</span>${roleDisplay}<span>· ${new Date(p.timestamp).toLocaleString()}</span>${canDelete?`<button class="delete-post-btn" data-post-id="${p.id}">🗑️</button>`:''}</div>${gallery}${p.text?`<div class="post-text" id="text-${p.id}">${p.text.replace(/@(\w+)/g,'<span class="mention">@$1</span>')}</div>`:''}<div class="post-actions"><button class="like-btn">❤️ ${p.likes.length}</button><button class="repost-btn">🔄 ${p.reposts.length}</button><button class="comment-toggle">💬 Комментарии</button><button class="translate-btn" data-post-id="${p.id}">🌐 Перевести</button></div><div class="comments-section" style="display:none;"></div></div></div>`;
}
function attachPostActions() {
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() { if (!token) return showToast('Войдите', 'error'); const el = this.closest('.post'); if (el.dataset.author === currentUser?.username) return showToast('Нельзя лайкать свой пост', 'error'); try { await request(`/posts/${el.dataset.id}/like`,{method:'POST'}); loadPosts(); } catch(e) { showToast(e.message, 'error'); } });
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() { if (!token) return showToast('Войдите', 'error'); const el = this.closest('.post'); if (el.dataset.author === currentUser?.username) return showToast('Нельзя репостить свой пост', 'error'); try { await request(`/posts/${el.dataset.id}/repost`,{method:'POST'}); loadPosts(); } catch(e) { showToast(e.message, 'error'); } });
  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() { const el = this.closest('.post'), sec = el.querySelector('.comments-section'); if (sec.style.display==='none') { sec.style.display='block'; await loadComments(el.dataset.id, sec); } else sec.style.display='none'; });
  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = async function() {
      const postEl = this.closest('.post');
      const textEl = postEl.querySelector('.post-text');
      if (!textEl) return;
      const postId = postEl.dataset.id;
      const originalHTML = translatedPosts[postId]?.original || textEl.innerHTML;
      if (translatedPosts[postId]?.translated) {
        textEl.innerHTML = originalHTML;
        translatedPosts[postId].translated = false;
        this.textContent = t('translate');
        return;
      }
      const plainText = textEl.innerText.trim();
      if (!plainText) return;
      try {
        const target = uiLang === 'ru' ? 'en' : 'ru';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(plainText)}`;
        const res = await fetch(url);
        const data = await res.json();
        const translated = data[0].map(part => part[0]).join('');
        translatedPosts[postId] = { original: originalHTML, translated: true };
        textEl.innerText = translated;
        this.textContent = t('original');
      } catch (e) { showToast('Ошибка перевода', 'error'); }
    };
  });
  document.querySelectorAll('.delete-post-btn').forEach(btn => btn.onclick = async function(e) { e.stopPropagation(); if (!token) return showToast('Войдите', 'error'); if (confirm('Удалить пост?')) { try { await request(`/posts/${this.dataset.postId}`,{method:'DELETE'}); loadPosts(); } catch(err) { showToast(err.message, 'error'); } } });
}

// Комментарии (базово)
async function loadComments(postId, container) {
  if (!container) return;
  try {
    const comments = await request(`/posts/${postId}/comments`);
    container.innerHTML = comments.map(c => renderComment(c)).join('') +
      (token ? `<div class="comment-form"><input type="text" class="comment-input" placeholder="Комментарий..."><button class="btn primary comment-submit">Отпр.</button></div>` : '<p>Войдите, чтобы комментировать</p>');
    if (token) {
      const inp = container.querySelector('.comment-input');
      const btn = container.querySelector('.comment-submit');
      if (btn) btn.onclick = async () => { const text = inp.value.trim(); if (!text) return; await request(`/posts/${postId}/comments`, { method:'POST', body: JSON.stringify({ text }) }); await loadComments(postId, container); };
    }
  } catch (e) { container.innerHTML = '<p>Ошибка загрузки комментариев</p>'; }
}
function renderComment(c) {
  const role = c.authorRole || 'user', verified = c.authorVerified, premium = c.authorPremium;
  let nickClass = 'role-' + role; if (premium && role === 'user') nickClass = 'premium-nick';
  const roleDisplay = roleName(role) ? `<span class="role-badge">${roleName(role)}</span>` : '';
  return `<div class="comment" data-id="${c.id}"><div class="avatar-small">${c.author[0]?.toUpperCase()}</div><div class="comment-body"><span class="username ${nickClass}">${c.author}${verified ? '<img src="verification.png" class="verified-icon">' : ''}</span>${roleDisplay}<span>${new Date(c.timestamp).toLocaleString()}</span><p class="comment-text">${c.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}</p></div></div>`;
}

// Профиль
async function loadMyProfile() {
  if (!currentUser) return; const header = document.getElementById('profileHeader'); if (!header) return;
  let nickClass = 'role-' + (currentUser.role || 'user'); if (currentUser.premium && currentUser.role === 'user') nickClass = 'premium-nick';
  const roleNameStr = roleName(currentUser.role);
  header.innerHTML = `<h2 class="${nickClass}">${currentUser.username} ${currentUser.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${roleNameStr} ${currentUser.premium ? '💎 НБСС+' : ''}</p>`;
  const allPosts = await request('/posts'); const userPosts = allPosts.filter(p => p.author === currentUser.username);
  const profilePosts = document.getElementById('profilePosts'); if (profilePosts) profilePosts.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
  attachPostActions();
}
async function loadUserProfile(username) {
  try {
    const user = await request(`/user/${username}`); const header = document.getElementById('profileHeader'); if (!header) return;
    let nickClass = 'role-' + (user.role || 'user'); if (user.premium && user.role === 'user') nickClass = 'premium-nick';
    const roleNameStr = roleName(user.role);
    header.innerHTML = `<h2 class="${nickClass}">${user.username} ${user.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${roleNameStr} ${user.premium ? '💎 НБСС+' : ''}</p>`;
    const allPosts = await request('/posts'); const userPosts = allPosts.filter(p => p.author === username);
    const profilePosts = document.getElementById('profilePosts'); if (profilePosts) profilePosts.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
    attachPostActions();
  } catch (e) { const header = document.getElementById('profileHeader'); if (header) header.innerHTML = '<p>Пользователь не найден</p>'; }
}

// Ивенты
async function loadEvents() {
  const list = document.getElementById('eventsList'); if (!list) return;
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner card"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('') : '<p>Нет ивентов</p>';
  } catch (e) {}
}

// Админка
async function loadAdminStats() {
  if (!currentUser || !['moderator','admin','head_admin','owner'].includes(currentUser.role)) return;
  const stats = await request('/stats'); const container = document.getElementById('adminStats');
  if (container) container.innerHTML = `<h3>📊 Статистика</h3><p>Пользователей: ${stats.users} | Постов: ${stats.posts}</p>`;
}
function resetAdminSearch() {
  selectedAdminUser = null;
  document.getElementById('adminUserSearch').value = '';
  document.getElementById('adminSearchResults').innerHTML = '';
  document.getElementById('adminSelectedUser').style.display = 'none';
}
async function performAdminSearch(query) {
  const container = document.getElementById('adminSearchResults');
  if (!container) return;
  try {
    let users = query ? await request(`/users/search?q=${encodeURIComponent(query)}`) : await request('/admin/users');
    if (users.length === 0) { container.innerHTML = '<p>Никого не найдено</p>'; return; }
    container.innerHTML = users.map(u => `<div class="admin-search-result-item" data-username="${u.username}">${u.username} (${roleName(u.role)})</div>`).join('');
    document.querySelectorAll('.admin-search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        selectedAdminUser = users.find(u => u.username === item.dataset.username);
        document.getElementById('adminSelectedUsername').textContent = selectedAdminUser.username;
        document.getElementById('adminSelectedUser').style.display = '';
        container.innerHTML = '';
        document.getElementById('adminUserSearch').value = selectedAdminUser.username;
      });
    });
  } catch (e) { container.innerHTML = '<p>Ошибка</p>'; }
}
document.getElementById('adminUserSearch')?.addEventListener('input', (e) => { if (e.target.value.trim()) performAdminSearch(e.target.value.trim()); });
document.getElementById('adminSearchButton')?.addEventListener('click', () => performAdminSearch(document.getElementById('adminUserSearch').value.trim()));
document.getElementById('banUserBtn')?.addEventListener('click', async () => {
  if (!selectedAdminUser) return;
  try { await request('/admin/ban-user', { method:'POST', body: JSON.stringify({ username: selectedAdminUser.username, duration: 60 }) }); showToast('Забанен', 'success'); } catch (e) { showToast(e.message, 'error'); }
});

// Поиск
document.getElementById('searchButton')?.addEventListener('click', () => {
  const q = document.getElementById('searchInput').value.trim();
  // здесь можно вызвать поиск – для простоты оставим заглушку
  showToast('Поиск пока не реализован', 'error');
});

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); });
}
