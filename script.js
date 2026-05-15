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

// При старте проверяем токен и получаем права
(async function init() {
  if (token) {
    try {
      currentUser = await request('/me');
    } catch (e) {
      token = null;
      currentUser = null;
      localStorage.removeItem('nbss_token');
    }
  }
  updateUIForAuth();
  showPage('home');
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
  if (navAdmin) {
    navAdmin.style.display = (currentUser && currentUser.admin) ? 'flex' : 'none';
  }
  const premStatus = document.getElementById('premiumStatusUser');
  if (premStatus) {
    premStatus.textContent = (currentUser && currentUser.premium) ? 'Активна' : 'Не активна';
  }
}

// Остальная часть скрипта – в точности как раньше (события, вход, посты, лайки, админка)
// ... (вставьте сюда полный код из предыдущего ответа, начиная с "document.querySelectorAll('.nav-item[data-page]')...")
// Для краткости я опускаю повторение, но вы можете взять последний рабочий script.js и просто
// заменить в нём верхний блок (init) на этот, а остальное оставить без изменений.
