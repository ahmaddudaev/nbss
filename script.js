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

function showBanScreen(bannedUntil) { /* ... без изменений ... */ }

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
    try { currentUser = await request('/me'); }
    catch (e) {
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

// ... (все функции addNotification, saveNotifications, updateNotificationBadge, renderNotificationHistory, обработчики колокольчика, showToast, showPage, updateUIForAuth, обработчики навигации, входа, регистрации, тем, публикации, ленты, комментариев, профилей, сообщений, ивентов, админки) ...
// Все они должны быть скопированы из предыдущего полного ответа.

// ========== ОБЯЗАТЕЛЬНО ДОБАВЬТЕ ЭТУ ФУНКЦИЮ ==========
async function updateStats() {
  try { await request('/stats'); } catch (e) {}
}
updateStats();
setInterval(updateStats, 10000);

// ... (поиск и всё остальное)
