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
  if (pageId === 'profile') loadProfile();
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
  document.getElementById('mobileNavProfile').style.display = loggedIn ? 'flex' : 'none';
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
    if (page === 'admin' && !(currentUser?.admin)) return alert('Нет прав администратора');
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

// Посты, комментарии, профиль, ивенты, админка — идентичны последней версии (без изменений)
