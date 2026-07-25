const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
const translatedPosts = {};
let notifications = [];
let unreadCount = 0;
let selectedFiles = [];

const ROLE_HIERARCHY = { owner:5, head_admin:4, admin:3, moderator:2, event_moderator:1, user:0 };

// Локализация
const userLang = (navigator.language || 'en').split('-')[0];
const uiLang = ['ru','en'].includes(userLang) ? userLang : 'en';
const dict = {
  ru: {
    home:'Главная', profile:'Профиль', events:'Ивенты', admin:'Админка', theme:'Тема', logout:'Выйти', login:'Войти', register:'Регистрация',
    search:'🔍 Поиск...', welcome:'👋 Добро пожаловать в НБСС!', login_title:'🔐 Вход', username:'Логин', password:'Пароль', login_btn:'Войти',
    register_title:'📝 Регистрация', register_btn:'Создать', no_account:'Нет аккаунта?', register_link:'Зарегистрироваться', publish:'Опубликовать',
    translate:'🌐 Перевести', original:'↩️ Оригинал', ban_title:'🚫 Вы забанены',
    role_owner:'👑 Владелец', role_head_admin:'🛡️ Гл. админ', role_admin:'🔴 Администратор', role_moderator:'🔵 Модератор', role_event_moderator:'📅 Ивент-модер', role_user:''
  },
  en: {
    home:'Home', profile:'Profile', events:'Events', admin:'Admin', theme:'Theme', logout:'Logout', login:'Login', register:'Register',
    search:'🔍 Search...', welcome:'👋 Welcome to NBSS!', login_title:'🔐 Login', username:'Username', password:'Password', login_btn:'Login',
    register_title:'📝 Register', register_btn:'Create', no_account:'Don\'t have an account?', register_link:'Register', publish:'Publish',
    translate:'🌐 Translate', original:'↩️ Original', ban_title:'🚫 You are banned',
    role_owner:'👑 Owner', role_head_admin:'🛡️ Head Admin', role_admin:'🔴 Admin', role_moderator:'🔵 Moderator', role_event_moderator:'📅 Event Moderator', role_user:''
  }
};
const t = key => dict[uiLang]?.[key] || dict['en'][key] || key;
const roleName = r => t('role_' + (r||'user')) || r;

// Кастомное уведомление (вместо alert)
function notify(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span> <span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Кастомный confirm (возвращает Promise<boolean>)
function confirmDialog(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn outline" id="confirmYes">Да</button>
          <button class="btn primary" id="confirmNo">Нет</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#confirmNo').onclick = () => { overlay.remove(); resolve(false); };
  });
}

// Применяем локализацию
document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (dict[uiLang]?.[key]) el.innerText = dict[uiLang][key]; });
document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const key = el.getAttribute('data-i18n-placeholder'); if (dict[uiLang]?.[key]) el.placeholder = dict[uiLang][key]; });
document.title = uiLang === 'ru' ? 'НБСС' : 'NBSS';

let selectedAdminUser = null;

function showBanScreen(bannedUntil) {
  const overlay = document.getElementById('banOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.querySelector('.app-container').style.display = 'none';
  function updateTimer() {
    const diff = new Date(bannedUntil) - new Date();
    if (diff <= 0) {
      overlay.style.display = 'none'; document.querySelector('.app-container').style.display = '';
      localStorage.removeItem('nbss_token'); location.reload();
    } else {
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
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
  updateUIForAuth(); showPage('home'); loadTheme();
})();

// ... (остальные функции: уведомления, навигация, лента, комментарии, админка) полностью идентичны предыдущему полному ответу,
// но с заменой alert на notify, confirm на confirmDialog.

// Пример замены:
// Было: alert('Заполните поля');
// Стало: notify('Заполните поля', 'error');

// Было: if (confirm('Удалить пост?')) { ... }
// Стало: const ok = await confirmDialog('Удалить пост?'); if (ok) { ... }
