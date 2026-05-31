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
  const notification = {
    id: Date.now(),
    type,
    message,
    read: false,
    timestamp: new Date().toISOString()
  };
  notifications.unshift(notification);
  unreadCount = notifications.filter(n => !n.read).length;
  saveNotifications();
  updateNotificationBadge();
  showToast(message, type);
}

function saveNotifications() {
  localStorage.setItem('nbss_notifications', JSON.stringify(notifications));
}

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
  list.innerHTML = notifications.length
    ? notifications.map(n => `
      <div class="notification-history-item">
        <div>${n.message}</div>
        <div class="time">${new Date(n.timestamp).toLocaleString()}</div>
      </div>
    `).join('')
    : '<div style="padding:12px;color:var(--text2);">Нет уведомлений</div>';
}

document.getElementById('notificationBell').addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = document.getElementById('notificationHistory');
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
  const authBanner = document.getElementById('authBanner');
  const postComposer = document.getElementById('postComposer');
  if (authBanner) authBanner.style.display = loggedIn ? 'none' : 'flex';
  if (postComposer) postComposer.style.display = loggedIn ? 'block' : 'none';
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
  const delCommentBtn = e.target.closest('.delete-comment-btn');
  if (delCommentBtn) {
    const commentId = delCommentBtn.dataset.id;
    if (confirm('Удалить комментарий?')) {
      request(`/comments/${commentId}`, { method: 'DELETE' }).then(() => {
        const postEl = delCommentBtn.closest('.post');
        const section = postEl?.querySelector('.comments-section');
        if (section) loadComments(postEl.dataset.id, section);
      }).catch(err => alert(err.message));
    }
  }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  try {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    token = data.token; currentUser = data.user;
    localStorage.setItem('nbss_token', token); updateUIForAuth(); showPage('home');
  } catch (e) { alert(e.message); }
});

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

function applyTheme(theme) {
  document.body.classList.remove('classic', 'liquid-light', 'liquid-dark');
  document.body.classList.add(theme);
  localStorage.setItem('nbss_theme', theme);
}
function loadTheme() { const saved = localStorage.getItem('nbss_theme') || 'classic'; applyTheme(saved); }
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

document.getElementById('publishPost').addEventListener('click', async () => {
  const text = document.getElementById('postInput').value.trim();
  if (!text) return;
  try {
    await request('/posts', { method: 'POST', body: JSON.stringify({ text }) });
    document.getElementById('postInput').value = '';
    loadPosts();
  } catch (e) { alert(e.message); }
});

async function loadPosts() {
  const container = document.getElementById('feedContainer');
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
  const textWithMentions = p.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  let nickClass = 'role-' + role;
  if (premium && role === 'user') nickClass = 'premium-nick';
  return `
    <div class="post" data-id="${p.id}" data-author="${p.author}">
      <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${nickClass}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
          ${canDelete ? `<button class="delete-post-btn" data-post-id="${p.id}">🗑️</button>` : ''}
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
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите');
    const postEl = this.closest('.post');
    const postId = postEl.dataset.id;
    const author = postEl.dataset.author;
    if (author === currentUser?.username) return showToast('Хорошая попытка, но так нельзя', 'like');
    try { await request(`/posts/${postId}/like`, { method: 'POST' }); loadPosts(); } catch (e) { alert(e.message); }
  });
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите');
    const postEl = this.closest('.post');
    const postId = postEl.dataset.id;
    const author = postEl.dataset.author;
    if (author === currentUser?.username) return showToast('Хорошая попытка, но так нельзя', 'repost');
    try { await request(`/posts/${postId}/repost`, { method: 'POST' }); loadPosts(); } catch (e) { alert(e.message); }
  });
  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() {
    const postEl = this.closest('.post');
    const section = postEl.querySelector('.comments-section');
    if (section.style.display === 'none') { section.style.display = 'block'; await loadComments(postEl.dataset.id, section); }
    else section.style.display = 'none';
  });
  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = async function() {
      const postId = this.dataset.postId;
      const textEl = document.getElementById(`text-${postId}`);
      if (!textEl) return;
      const originalText = textEl.dataset.original || textEl.textContent;
      textEl.dataset.original = originalText;
      if (translatedPosts[postId]) { textEl.textContent = originalText; delete translatedPosts[postId]; return; }
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
        try { await request(`/posts/${postId}`, { method: 'DELETE' }); loadPosts(); } catch (err) { alert(err.message); }
      }
    };
  });
}

async function loadComments(postId, container) {
  try {
    const comments = await request(`/posts/${postId}/comments`);
    container.innerHTML = comments.map(c => renderComment(c)).join('') +
      (token ? `<div class="comment-form"><input type="text" class="comment-input" placeholder="Комментарий..."><button class="btn primary comment-submit">Отпр.</button></div>` : '<p>Войдите, чтобы комментировать</p>');
    if (token) {
      const inp = container.querySelector('.comment-input');
      const btn = container.querySelector('.comment-submit');
      btn.onclick = async () => { const text = inp.value.trim(); if (!text) return; await request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) }); await loadComments(postId, container); };
    }
  } catch (e) {}
}

function renderComment(c) {
  const role = c.authorRole || 'user';
  const premium = c.authorPremium === true;
  const verified = c.authorVerified === true;
  const post = posts.find(p => p.id == c.postId);
  const canDelete = currentUser && (
    currentUser.username === c.author ||
    (post && currentUser.username === post.author) ||
    ['moderator','admin','head_admin','owner'].includes(currentUser.role)
  );
  let nickClass = 'role-' + role;
  if (premium && role === 'user') nickClass = 'premium-nick';
  return `<div class="comment" data-id="${c.id}">
    <div class="avatar-small">${c.author[0]?.toUpperCase()}</div>
    <div class="comment-body">
      <span class="username ${nickClass}">${c.author}${verified ? '<img src="verification.png" class="verified-icon">' : ''}</span>
      <span>${new Date(c.timestamp).toLocaleString()}</span>
      <p class="comment-text">${c.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}</p>
      ${canDelete ? `<button class="delete-comment-btn" data-id="${c.id}">🗑️</button>` : ''}
    </div>
  </div>`;
}

async function loadMyProfile() {
  if (!currentUser) return;
  const header = document.getElementById('profileHeader');
  let nickClass = 'role-' + (currentUser.role || 'user');
  if (currentUser.premium && currentUser.role === 'user') nickClass = 'premium-nick';
  header.innerHTML = `<h2 class="${nickClass}">${currentUser.username} ${currentUser.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${currentUser.role !== 'user' ? '🔹 ' + currentUser.role : ''} ${currentUser.premium ? '💎 НБСС+' : ''}</p>`;
  const allPosts = await request('/posts');
  const userPosts = allPosts.filter(p => p.author === currentUser.username);
  document.getElementById('profilePosts').innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
  attachPostActions();
}

async function loadUserProfile(username) {
  try {
    const user = await request(`/user/${username}`);
    const header = document.getElementById('profileHeader');
    let nickClass = 'role-' + (user.role || 'user');
    if (user.premium && user.role === 'user') nickClass = 'premium-nick';
    header.innerHTML = `
      <h2 class="${nickClass}">${user.username} ${user.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2>
      <p>${user.role !== 'user' ? '🔹 ' + user.role : ''} ${user.premium ? '💎 НБСС+' : ''}</p>
      <div class="profile-actions"><button class="btn primary send-message-btn" data-username="${user.username}">💬 Написать сообщение</button></div>`;
    document.querySelector('.send-message-btn')?.addEventListener('click', () => {
      window.viewingUser = null; currentDialog = username; showPage('messages'); openChat(username);
    });
    const allPosts = await request('/posts');
    const userPosts = allPosts.filter(p => p.author === username);
    document.getElementById('profilePosts').innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
    attachPostActions();
  } catch (e) { document.getElementById('profileHeader').innerHTML = '<p>Пользователь не найден</p>'; }
}

async function loadDialogs() {
  const list = document.getElementById('dialogList');
  try {
    const dialogs = await request('/dialogs');
    list.innerHTML = dialogs.map(d => {
      let nickClass = 'role-' + (d.role || 'user');
      if (d.premium && d.role === 'user') nickClass = 'premium-nick';
      return `<div class="dialog-item" data-username="${d.username}"><div class="dialog-username ${nickClass}">${d.username}</div><div class="dialog-last">${d.lastMessage || 'Нет сообщений'}</div></div>`;
    }).join('');
    document.querySelectorAll('.dialog-item').forEach(item => { item.addEventListener('click', () => { currentDialog = item.dataset.username; openChat(currentDialog); }); });
    document.getElementById('chatView').style.display = 'none';
    document.querySelector('.dialog-list').style.display = 'block';
  } catch (e) {}
}
async function openChat(username) {
  document.querySelector('.dialog-list').style.display = 'none';
  document.getElementById('chatView').style.display = 'flex';
  document.getElementById('chatPartner').textContent = username;
  await loadMessages(username);
}
async function loadMessages(username) {
  const container = document.getElementById('chatMessages');
  try {
    const msgs = await request(`/messages?with=${encodeURIComponent(username)}`);
    container.innerHTML = msgs.map(m => `<div class="message-bubble ${m.from === currentUser.username ? 'sent' : 'received'}"><div>${m.text}</div><div class="message-time">${new Date(m.timestamp).toLocaleString()}</div></div>`).join('');
    container.scrollTop = container.scrollHeight;
  } catch (e) {}
}
document.getElementById('sendMessageBtn').addEventListener('click', async () => {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !currentDialog) return;
  await request('/messages', { method: 'POST', body: JSON.stringify({ to: currentDialog, text }) });
  input.value = '';
  await loadMessages(currentDialog);
});
document.querySelector('.back-to-dialogs')?.addEventListener('click', () => {
  document.getElementById('chatView').style.display = 'none';
  document.querySelector('.dialog-list').style.display = 'block';
  currentDialog = null;
  loadDialogs();
});

async function loadEvents() {
  const list = document.getElementById('eventsList');
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner card"><strong>${e.title}</strong><p>${e.desc}</p>${currentUser && ['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role) && e.id ? `<button class="btn danger delete-event-btn" data-event-id="${e.id}">🗑 Удалить</button>` : ''}</div>`).join('') : '<p>Нет ивентов</p>';
    document.querySelectorAll('.delete-event-btn').forEach(btn => { btn.addEventListener('click', async () => { if (confirm('Удалить ивент?')) { await request(`/events/${btn.dataset.eventId}`, { method: 'DELETE' }); loadEvents(); } }); });
  } catch (e) {}
}

async function loadAdminStats() {
  if (!currentUser || !['moderator','admin','head_admin','owner'].includes(currentUser.role)) return;
  const stats = await request('/stats');
  document.getElementById('adminStats').innerHTML = `<h3>📊 Статистика</h3><div class="stat-row"><span>👥</span><span>${stats.users}</span></div><div class="stat-row"><span>📝</span><span>${stats.posts}</span></div>`;
}
async function loadAdminUsers() {
  if (!currentUser || !['moderator','admin','head_admin','owner'].includes(currentUser.role)) return;
  const select = document.getElementById('userSelect');
  try {
    const usersList = await request('/admin/users');
    select.innerHTML = usersList.map(u => `<option value="${u.username}">${u.username} ${u.role !== 'user' ? '('+u.role+')' : ''} ${u.verified ? '✔️' : ''} ${u.premium ? '💎' : ''}</option>`).join('');
    const getSelected = () => select.value;
    const targetUser = () => usersList.find(u => u.username === getSelected());
    const isOwner = () => currentUser.role === 'owner';
    const isHeadAdminOrAbove = () => ['head_admin','owner'].includes(currentUser.role);
    const isAdminOrAbove = () => ['admin','head_admin','owner'].includes(currentUser.role);

    document.getElementById('verifyUserBtn').onclick = () => { if (!isAdminOrAbove() && getSelected() !== currentUser.username) return alert('Нет прав'); modifyUser(getSelected(), { verified: true }); };
    document.getElementById('unverifyUserBtn').onclick = () => { if (!isAdminOrAbove() && getSelected() !== currentUser.username) return alert('Нет прав'); modifyUser(getSelected(), { verified: false }); };
    document.getElementById('givePremiumBtn').onclick = () => { if (!isAdminOrAbove()) return alert('Нет прав'); modifyUser(getSelected(), { premium: true }); };
    document.getElementById('revokePremiumBtn').onclick = () => { if (!isAdminOrAbove()) return alert('Нет прав'); modifyUser(getSelected(), { premium: false }); };
    document.getElementById('setOwnerBtn').onclick = () => { if (!isOwner()) return alert('Только владелец может назначать владельцев'); modifyUser(getSelected(), { role: 'owner' }); };
    document.getElementById('setHeadAdminBtn').onclick = () => { if (!isOwner()) return alert('Только владелец может назначать главных администраторов'); modifyUser(getSelected(), { role: 'head_admin' }); };
    document.getElementById('setAdminBtn').onclick = () => { if (!isHeadAdminOrAbove()) return alert('Только владелец или главный администратор могут назначать администраторов'); modifyUser(getSelected(), { role: 'admin' }); };
    document.getElementById('setModeratorBtn').onclick = () => { if (!isAdminOrAbove()) return alert('Нет прав'); modifyUser(getSelected(), { role: 'moderator' }); };
    document.getElementById('setEventModeratorBtn').onclick = () => { if (!isAdminOrAbove()) return alert('Нет прав'); modifyUser(getSelected(), { role: 'event_moderator' }); };
    document.getElementById('banUserBtn').onclick = () => {
      if (!isAdminOrAbove()) return alert('Нет прав');
      const target = targetUser();
      if (target && ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[currentUser.role]) return alert('Нельзя забанить равного или выше');
      modifyUser(getSelected(), { banUntil: new Date(Date.now() + 3600000).toISOString() });
    };
    document.getElementById('unbanUserBtn').onclick = () => { if (!isAdminOrAbove()) return alert('Нет прав'); modifyUser(getSelected(), { banUntil: null }); };
    document.getElementById('deleteUserBtn').onclick = () => {
      if (!isAdminOrAbove()) return alert('Нет прав');
      const target = targetUser();
      if (target && ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[currentUser.role]) return alert('Нельзя удалить равного или выше');
      if (confirm(`Удалить ${getSelected()}?`)) modifyUser(getSelected(), { delete: true });
    };
  } catch (e) { select.innerHTML = '<option>Ошибка загрузки</option>'; }
}
async function modifyUser(username, changes) {
  await request(`/admin/user/${username}`, { method: 'POST', body: JSON.stringify(changes) });
  loadAdminUsers();
}
document.getElementById('createEventBtn').addEventListener('click', async () => {
  if (!currentUser || !['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role)) return alert('Нет прав');
  const title = document.getElementById('eventTitle').value.trim();
  const desc = document.getElementById('eventDesc').value.trim();
  if (!title) return;
  await request('/events', { method: 'POST', body: JSON.stringify({ title, desc }) });
  document.getElementById('eventTitle').value = ''; document.getElementById('eventDesc').value = '';
  loadEvents();
});

async function updateStats() { try { await request('/stats'); } catch (e) {} }
updateStats(); setInterval(updateStats, 10000);

document.getElementById('searchInput')?.addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  const container = document.getElementById('searchResults');
  if (!container) return;
  if (!q) { container.innerHTML = ''; return; }
  try {
    const users = await request(`/users/search?q=${encodeURIComponent(q)}`);
    container.innerHTML = users.map(u => {
      let nickClass = 'role-' + (u.role || 'user');
      if (u.premium && u.role === 'user') nickClass = 'premium-nick';
      return `<div class="search-user"><span class="username ${nickClass}">${u.username}${u.verified ? '<img src="verification.png" class="verified-icon">' : ''}</span><button class="btn outline view-profile-btn" data-username="${u.username}">→</button></div>`;
    }).join('');
    document.querySelectorAll('.view-profile-btn').forEach(btn => { btn.addEventListener('click', () => { window.viewingUser = btn.dataset.username; showPage('profile'); }); });
  } catch (e) {}
});
