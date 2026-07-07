const API = '/api';
const LS = key => ({ get: () => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }, set: v => localStorage.setItem(key, JSON.stringify(v)), remove: () => localStorage.removeItem(key) });
const tokenStore = LS('token'), themeStore = LS('theme');
const lang = (navigator.language || 'en').split('-')[0], uiLang = ['ru','en'].includes(lang) ? lang : 'en';
const t = (key, dict = { ru:{ home:'Главная', profile:'Профиль', events:'Ивенты', admin:'Админка', theme:'Тема', logout:'Выйти', login:'Войти', register:'Регистрация', search:'🔍 Поиск', publish:'Опубликовать', translate:'🌐 Перевести', original:'↩️ Оригинал', welcome:'👋 Добро пожаловать!', login_title:'🔐 Вход', username:'Логин', password:'Пароль', login_btn:'Войти', register_title:'📝 Регистрация', register_btn:'Создать', no_account:'Нет аккаунта?', register_link:'Зарегистрироваться', ban:'⛔ Бан 1ч', unban:'✅ Разбан', ban_ip:'🌐 Бан IP', unban_ip:'🌐 Разбан IP', delete:'🗑 Удалить', password_btn:'🔑 Пароль', role_owner:'👑 Владелец', role_head_admin:'🛡️ Гл.админ', role_admin:'🔴 Админ', role_moderator:'🔵 Модер', role_event_moderator:'📅 Ивент-модер', role_user:'' }, en:{ home:'Home', profile:'Profile', events:'Events', admin:'Admin', theme:'Theme', logout:'Logout', login:'Login', register:'Register', search:'🔍 Search', publish:'Publish', translate:'🌐 Translate', original:'↩️ Original', welcome:'👋 Welcome!', login_title:'🔐 Login', username:'Username', password:'Password', login_btn:'Login', register_title:'📝 Register', register_btn:'Create', no_account:'No account?', register_link:'Register', ban:'⛔ Ban 1h', unban:'✅ Unban', ban_ip:'🌐 Ban IP', unban_ip:'🌐 Unban IP', delete:'🗑 Delete', password_btn:'🔑 Password', role_owner:'👑 Owner', role_head_admin:'🛡️ Head Admin', role_admin:'🔴 Admin', role_moderator:'🔵 Moderator', role_event_moderator:'📅 Event Moderator', role_user:'' } }) => (dict[uiLang] || dict['en'])[key] || key;
let token = tokenStore.get(), currentUser = null, translated = {}, selectedUser = null;

async function api(url, opt = {}) {
  const headers = {}; if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opt.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + url, { ...opt, headers: { ...headers, ...opt.headers } });
  if (r.status === 423) { const d = await r.json(); document.getElementById('banOverlay').style.display = 'flex'; return; }
  if (r.status === 401) { token = null; currentUser = null; tokenStore.remove(); updateUI(); throw new Error('Auth'); }
  if (!r.ok) { let msg = 'Error'; try { msg = (await r.json()).error || msg; } catch {} throw new Error(msg); }
  return r.json();
}

async function init() {
  if (token) { try { currentUser = await api('/me'); updateTokens(); } catch {} }
  updateUI(); showPage('home'); loadTheme();
  document.getElementById('searchButton')?.addEventListener('click', () => searchUsers(document.getElementById('searchInput').value.trim()));
}
init();

function updateUI() {
  const on = !!token;
  document.getElementById('authBanner').style.display = on ? 'none' : 'flex';
  document.getElementById('postComposer').style.display = on ? 'block' : 'none';
  ['navProfile','mobileNavProfile','logoutLink','mobileLogoutLink'].forEach(id => document.getElementById(id).style.display = on ? 'flex' : 'none');
  ['loginLink','mobileLoginLink','registerLink','mobileRegisterLink'].forEach(id => document.getElementById(id).style.display = on ? 'none' : 'flex');
  const adm = currentUser?.role && ['owner','head_admin','admin','moderator'].includes(currentUser.role);
  ['navAdmin','mobileNavAdmin'].forEach(id => document.getElementById(id).style.display = adm ? 'flex' : 'none');
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id + 'Page')?.classList.add('active');
  document.querySelector('.search-box').style.display = id === 'home' ? 'block' : 'none';
  if (id === 'home') loadPosts();
  if (id === 'admin') { loadAdminStats(); searchAdminUsers(''); }
}

// Auth
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('loginUsername').value.trim(), p = document.getElementById('loginPassword').value.trim(), cap = grecaptcha.getResponse();
  if (!u || !p || !cap) return alert('Fill all fields and captcha');
  try {
    const d = await api('/login', { method:'POST', body: JSON.stringify({ username:u, password:p, recaptchaToken:cap }) });
    token = d.token; currentUser = d.user; tokenStore.set(token); updateUI(); showPage('home');
  } catch(e) { alert(e.message); grecaptcha.reset(); }
});

document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('regUsername').value.trim(), p = document.getElementById('regPassword').value.trim(), cap = grecaptcha.getResponse();
  if (!u || !p || !cap) return alert('Fill all fields and captcha');
  try {
    await api('/register', { method:'POST', body: JSON.stringify({ username:u, password:p, recaptchaToken:cap }) });
    alert('Аккаунт создан! Теперь войдите.');
    showPage('login');
  } catch(e) { alert(e.message); grecaptcha.reset(); }
});

// Posts
async function loadPosts() {
  const ps = await api('/posts');
  document.getElementById('feedContainer').innerHTML = ps.map(p => `
    <div class="post" data-id="${p.id}">
      <div class="avatar">${p.author[0]}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username role-${p.authorRole||'user'}">${p.author}${p.authorVerified?'<img src="verification.png" class="verified-icon">':''}</span>
          <span class="role-badge">${t('role_'+ (p.authorRole||'user'))}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        ${p.text ? `<div class="post-text" id="text-${p.id}">${p.text}</div>` : ''}
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes.length}</button>
          <button class="repost-btn">🔄 ${p.reposts.length}</button>
          <button class="comment-toggle">💬</button>
          <button class="translate-btn" data-post="${p.id}">${t('translate')}</button>
        </div>
      </div>
    </div>`).join('');
  document.querySelectorAll('.translate-btn').forEach(b => b.onclick = async () => {
    const el = document.getElementById('text-' + b.dataset.post);
    if (!el) return;
    if (translated[b.dataset.post]) { el.innerHTML = translated[b.dataset.post].orig; translated[b.dataset.post] = null; b.textContent = t('translate'); return; }
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(el.innerText)}`);
    const data = await res.json();
    translated[b.dataset.post] = { orig: el.innerHTML };
    el.innerText = data[0].map(x => x[0]).join('');
    b.textContent = t('original');
  });
}

// Admin
async function loadAdminStats() { const s = await api('/stats'); document.getElementById('adminStats').innerHTML = `<h3>Stats</h3><p>Users: ${s.users} | Posts: ${s.posts}</p>`; }
async function searchAdminUsers(q) {
  const users = await api(q ? `/users/search?q=${encodeURIComponent(q)}` : '/admin/users');
  const container = document.getElementById('adminSearchResults');
  container.innerHTML = users.map(u => `<div class="admin-search-result-item" data-username="${u.username}">${u.username} (${t('role_'+u.role)})</div>`).join('');
  container.querySelectorAll('.admin-search-result-item').forEach(el => el.onclick = () => { selectedUser = users.find(u => u.username === el.dataset.username); document.getElementById('adminSelectedUsername').textContent = selectedUser.username; document.getElementById('adminSelectedUser').style.display = ''; });
}
document.getElementById('adminSearchButton')?.addEventListener('click', () => searchAdminUsers(document.getElementById('adminUserSearch').value.trim()));

// IP ban
document.getElementById('banIPBtn')?.addEventListener('click', async () => {
  if (!selectedUser) return;
  try { await api('/admin/ban-ip', { method:'POST', body: JSON.stringify({ username: selectedUser.username }) }); alert('IP banned'); } catch(e) { alert(e.message); }
});
document.getElementById('unbanIPBtn')?.addEventListener('click', async () => {
  const ip = prompt('IP to unban:');
  if (ip) { try { await api('/admin/unban-ip', { method:'POST', body: JSON.stringify({ ip }) }); alert('Unbanned'); } catch(e) { alert(e.message); } }
});

// Прочие кнопки (ban, unban, delete, show password) реализуются аналогично через api-запросы к соответствующим маршрутам.

// Темы
function loadTheme() { document.body.classList.add(themeStore.get() || 'classic'); }
document.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', () => { if (r.checked) { document.body.className = r.value; themeStore.set(r.value); } }));

// PWA
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); }); }
