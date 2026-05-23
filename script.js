const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;

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
  updateUIForAuth();
  showPage('home');
  loadTheme();
})();

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId + 'Page');
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-page], .mobile-nav-item[data-page]').forEach(n => n.classList.remove('active'));
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

document.querySelectorAll('.nav-item[data-page], .mobile-nav-item[data-page]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    if (page === 'profile' && !token) return alert('Сначала войдите');
    if (page === 'messages' && !token) return alert('Сначала войдите');
    if (page === 'admin' && !(currentUser?.admin)) return alert('Нет прав администратора');
    window.viewingUser = null;
    showPage(page);
  });
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
  if (u.length < 3) return alert('Минимум 3 символа');
  try {
    await request('/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    alert('Аккаунт создан! Войдите.'); showPage('login');
  } catch (e) { alert(e.message); }
});

document.getElementById('logoutLink').addEventListener('click', () => {
  token = null; currentUser = null; localStorage.removeItem('nbss_token');
  updateUIForAuth(); showPage('home');
});
document.getElementById('mobileLogoutLink').addEventListener('click', () => {
  token = null; currentUser = null; localStorage.removeItem('nbss_token');
  updateUIForAuth(); showPage('home');
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

// Поиск и переход в профиль
document.getElementById('searchInput')?.addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  const container = document.getElementById('searchResults');
  if (!container) return;
  if (!q) { container.innerHTML = ''; return; }
  try {
    const users = await request(`/users/search?q=${encodeURIComponent(q)}`);
    container.innerHTML = users.map(u => `
      <div class="search-user">
        <span class="username ${u.premium ? 'premium-nick' : ''}">${u.username}${u.verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
        <button class="btn outline view-profile-btn" data-username="${u.username}">→</button>
      </div>
    `).join('');
    document.querySelectorAll('.view-profile-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.dataset.username;
        window.viewingUser = username;
        showPage('profile');
      });
    });
  } catch (e) {}
});

// Клик по нику в ленте
document.addEventListener('click', (e) => {
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

// Публикация поста
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
  return `
    <div class="post" data-id="${p.id}" data-author="${p.author}">
      <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${premium ? 'premium-nick' : ''}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        <div class="post-text">${p.text}</div>
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
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите');
    const postId = this.closest('.post').dataset.id;
    await request(`/posts/${postId}/like`, { method: 'POST' }); loadPosts();
  });
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() {
    if (!token) return alert('Войдите');
    const postId = this.closest('.post').dataset.id;
    await request(`/posts/${postId}/repost`, { method: 'POST' }); loadPosts();
  });
  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() {
    const postEl = this.closest('.post');
    const section = postEl.querySelector('.comments-section');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      await loadComments(postEl.dataset.id, section);
    } else section.style.display = 'none';
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
      btn.onclick = async () => {
        const text = inp.value.trim(); if (!text) return;
        await request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
        await loadComments(postId, container);
      };
    }
  } catch (e) {}
}

function renderComment(c) {
  const premium = c.authorPremium === true;
  const verified = c.authorVerified === true;
  return `<div class="comment"><div class="avatar-small">${c.author[0]?.toUpperCase()}</div><div class="comment-body"><span class="username ${premium ? 'premium-nick' : ''}">${c.author}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span> <span>${new Date(c.timestamp).toLocaleString()}</span><p class="comment-text">${c.text}</p></div></div>`;
}

// Профили
async function loadMyProfile() {
  if (!currentUser) return;
  const header = document.getElementById('profileHeader');
  header.innerHTML = `
    <h2 class="${currentUser.premium ? 'premium-nick' : ''}">${currentUser.username}</h2>
    <p>${currentUser.verified ? '✅ Верифицирован' : ''} ${currentUser.premium ? '💎 НБСС+' : ''}</p>
  `;
  const posts = await request('/posts');
  const userPosts = posts.filter(p => p.author === currentUser.username);
  document.getElementById('profilePosts').innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
  attachPostActions();
}

async function loadUserProfile(username) {
  try {
    const user = await request(`/user/${username}`);
    const header = document.getElementById('profileHeader');
    header.innerHTML = `
      <h2 class="${user.premium ? 'premium-nick' : ''}">${user.username} ${user.verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</h2>
      <p>${user.premium ? '💎 НБСС+' : ''}</p>
      <div class="profile-actions">
        <button class="btn primary send-message-btn" data-username="${user.username}">💬 Написать сообщение</button>
      </div>
    `;
    document.querySelector('.send-message-btn')?.addEventListener('click', () => {
      window.viewingUser = null;
      currentDialog = username;
      showPage('messages');
      openChat(username);
    });
    const posts = await request('/posts');
    const userPosts = posts.filter(p => p.author === username);
    document.getElementById('profilePosts').innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p>Нет постов</p>';
    attachPostActions();
  } catch (e) {
    document.getElementById('profileHeader').innerHTML = '<p>Пользователь не найден</p>';
  }
}

// Личные сообщения
async function loadDialogs() {
  const list = document.getElementById('dialogList');
  try {
    const dialogs = await request('/dialogs');
    list.innerHTML = dialogs.map(d => `
      <div class="dialog-item" data-username="${d.username}">
        <div class="dialog-username ${d.premium ? 'premium-nick' : ''}">${d.username}</div>
        <div class="dialog-last">${d.lastMessage || 'Нет сообщений'}</div>
      </div>
    `).join('');
    document.querySelectorAll('.dialog-item').forEach(item => {
      item.addEventListener('click', () => {
        const username = item.dataset.username;
        currentDialog = username;
        openChat(username);
      });
    });
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
    const messages = await request(`/messages?with=${encodeURIComponent(username)}`);
    container.innerHTML = messages.map(m => {
      const isSent = m.from === currentUser.username;
      return `<div class="message-bubble ${isSent ? 'sent' : 'received'}">
        <div>${m.text}</div>
        <div class="message-time">${new Date(m.timestamp).toLocaleString()}</div>
      </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  } catch (e) {}
}

document.getElementById('sendMessageBtn').addEventListener('click', async () => {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !currentDialog) return;
  try {
    await request('/messages', { method: 'POST', body: JSON.stringify({ to: currentDialog, text }) });
    input.value = '';
    await loadMessages(currentDialog);
  } catch (e) { alert(e.message); }
});

document.querySelector('.back-to-dialogs')?.addEventListener('click', () => {
  document.getElementById('chatView').style.display = 'none';
  document.querySelector('.dialog-list').style.display = 'block';
  currentDialog = null;
  loadDialogs();
});

// Ивенты
async function loadEvents() {
  const list = document.getElementById('eventsList');
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner card"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('') : '<p>Нет ивентов</p>';
  } catch (e) {}
}

// Админка
async function loadAdminStats() {
  if (!currentUser?.admin) return;
  const stats = await request('/stats');
  document.getElementById('adminStats').innerHTML = `<h3>📊 Статистика</h3><div class="stat-row"><span>👥</span><span>${stats.users}</span></div><div class="stat-row"><span>📝</span><span>${stats.posts}</span></div>`;
}

async function loadAdminUsers() {
  if (!currentUser?.admin) return;
  const users = await request('/admin/users');
  const select = document.getElementById('userSelect');
  select.innerHTML = users.map(u => `<option>${u.username} ${u.admin ? '(админ)' : ''} ${u.verified ? '✔️' : ''} ${u.premium ? '💎' : ''}</option>`).join('');

  const getSelected = () => select.value.split(' ')[0];
  const isSigma = () => getSelected() === 'MrSigma';

  document.getElementById('verifyUserBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя изменить владельца');
    await modifyUser(getSelected(), { verified: true });
  };
  document.getElementById('unverifyUserBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя изменить владельца');
    await modifyUser(getSelected(), { verified: false });
  };
  document.getElementById('makeAdminBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя изменить владельца');
    await modifyUser(getSelected(), { admin: true });
  };
  document.getElementById('revokeAdminBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя изменить владельца');
    await modifyUser(getSelected(), { admin: false });
  };
  document.getElementById('givePremiumBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя изменить владельца');
    await modifyUser(getSelected(), { premium: true });
  };
  document.getElementById('revokePremiumBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя изменить владельца');
    await modifyUser(getSelected(), { premium: false });
  };
  document.getElementById('deleteUserBtn').onclick = async () => {
    if (isSigma()) return alert('Нельзя удалить основателя');
    if (confirm(`Удалить ${getSelected()}?`)) {
      await modifyUser(getSelected(), { delete: true });
    }
  };
}

async function modifyUser(username, changes) {
  await request(`/admin/user/${username}`, { method: 'POST', body: JSON.stringify(changes) });
  loadAdminUsers();
}

document.getElementById('createEventBtn').addEventListener('click', async () => {
  const title = document.getElementById('eventTitle').value.trim();
  const desc = document.getElementById('eventDesc').value.trim();
  if (!title) return;
  await request('/events', { method: 'POST', body: JSON.stringify({ title, desc }) });
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventDesc').value = '';
  loadEvents();
});

async function updateStats() {
  try { await request('/stats'); } catch (e) {}
}
updateStats(); setInterval(updateStats, 10000);
