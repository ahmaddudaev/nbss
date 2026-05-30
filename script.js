const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {};
let notifications = [];             // массив уведомлений
let unreadCount = 0;

// Загружаем сохранённые уведомления при старте
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

// ========== УВЕДОМЛЕНИЯ ==========
function addNotification(type, message) {
  const notification = {
    id: Date.now(),
    type,        // 'like', 'comment', 'message', 'follow'
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

// Колокольчик: открыть/закрыть историю
document.getElementById('notificationBell').addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = document.getElementById('notificationHistory');
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) {
    // Пометить все как прочитанные
    notifications.forEach(n => n.read = true);
    unreadCount = 0;
    saveNotifications();
    updateNotificationBadge();
    renderNotificationHistory();
  }
});

// Закрыть историю при клике вне
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationHistory');
  if (!e.target.closest('#notificationBell') && !e.target.closest('#notificationHistory')) {
    panel.classList.remove('active');
  }
});

// Всплывающее уведомление (toast)
function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'like' ? '❤️' : type === 'comment' ? '💬' : type === 'message' ? '✉️' : '🔔';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5000);
}

// Пример: при добавлении лайка показываем уведомление (можно расширить)
// В реальном коде вызов addNotification('like', 'Ваш пост понравился пользователю...') происходит после ответа сервера.
// Здесь просто демонстрация: при входе покажем приветствие.
// Уберите, если не нужно.

// ========== ОСТАЛЬНОЙ КОД (вход, регистрация, темы, лента, комментарии, перевод, профили, сообщения, админка, поиск) ==========
// ... полностью идентичен предыдущей полной версии (с личными сообщениями и упоминаниями).
// Я не дублирую его из-за объёма, но он должен присутствовать в вашем script.js.
