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

const ROLE_NAMES_RU = {
  owner: '👑 Владелец',
  head_admin: '🛡️ Главный админ',
  admin: '🔴 Администратор',
  moderator: '🔵 Модератор',
  event_moderator: '📅 Ивент-модератор',
  user: 'Пользователь'
};

const userLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
const supportedUILangs = ['ru', 'en', 'ja'];
const uiLang = supportedUILangs.includes(userLang) ? userLang : 'en';

const translations = {
  ru: {
    ban_title: '🚫 Вы забанены',
    notifications: 'Уведомления',
    home: 'Главная',
    profile: 'Профиль',
    events: 'Ивенты',
    admin: 'Админка',
    theme: 'Тема',
    logout: 'Выйти',
    login: 'Войти',
    register: 'Регистрация',
    search_placeholder: '🔍 Поиск людей...',
    settings_title: '⚙️ Настройки',
    theme_label: '🎨 Тема',
    theme_classic: 'Классическая',
    theme_liquid_light: 'Liquid Glass Светлая',
    theme_liquid_dark: 'Liquid Glass Тёмная',
    theme_retro_light: 'Ретро ВК Светлая',
    theme_retro_dark: 'Ретро ВК Тёмная',
    secret_code: '🎁 Секретный код',
    code_placeholder: 'Введите код',
    activate_code: 'Активировать',
    tokens_label: '💰 НБСС‑токены:',
    buy_premium: '💎 Купить НБСС+ за 1000 токенов',
    login_title: '🔐 Вход в НБСС',
    username_placeholder: 'Логин',
    password_placeholder: 'Пароль',
    login_btn: 'Войти',
    no_account: 'Нет аккаунта?',
    register_link: 'Зарегистрироваться',
    register_title: '📝 Регистрация',
    register_btn: 'Создать аккаунт',
    welcome: '👋 Добро пожаловать в НБСС!',
    post_placeholder: 'Что происходит? #хештег @упоминание',
    publish: 'Опубликовать',
    events_title: '📅 Активные ивенты',
    create_event: 'Создать ивент',
    event_title_placeholder: 'Название',
    event_desc_placeholder: 'Описание',
    launch_event: '🚀 Запустить',
    admin_title: '⚙️ Административная панель',
    users_section: '👥 Пользователи',
    admin_search_placeholder: '🔍 Введите ник...',
    selected_user: 'Выбран:',
    verify: '✅ Галочка',
    unverify: '❌ Убрать',
    give_premium: '💎 НБСС+',
    revoke_premium: '💔 Отобрать',
    set_owner: '👑 Владелец',
    set_head_admin: '🛡 Гл.админ',
    set_admin: '🔴 Админ',
    set_moderator: '🔵 Модер',
    set_event_moderator: '📅 Ивент-модер',
    remove_role: '👤 Снять роль',
    ban_1h: '⛔ Бан (1ч)',
    unban: '✅ Разбан',
    delete_user: '🗑 Удалить',
    show_password: '🔑 Пароль',
    secret_codes: '🎁 Секретные коды',
    code_value_placeholder: 'Код (например, PREMIUM2025)',
    reward_tokens: '💰 Токены',
    reward_premium: '💎 Премиум',
    code_amount_placeholder: 'Сумма токенов',
    code_max_uses_placeholder: 'Макс. использований (0 — безлимит)',
    create_code: 'Создать код',
    no_posts: 'Нет постов',
    no_events: 'Нет ивентов',
    no_notifications: 'Нет уведомлений',
    error_loading: 'Ошибка загрузки',
    error_network: 'Ошибка сети',
    login_required: 'Сначала войдите',
    no_permission: 'Нет прав',
    comment_placeholder: 'Комментарий...',
    send: 'Отпр.',
    delete_confirm: 'Удалить комментарий?',
    post_delete_confirm: 'Удалить пост?',
    event_delete_confirm: 'Удалить ивент?',
    user_delete_confirm: 'Удалить пользователя',
    code_delete_confirm: 'Удалить код',
    translate: '🌐 Перевести',
    original: '↩️ Оригинал',
    translation_error: 'Ошибка перевода',
    no_users_found: 'Никого не найдено',
    premium_active: '✅ НБСС+ активно',
    premium_not_active: '',
    password_owner_forbidden: 'Нельзя посмотреть пароль владельца',
    password_not_found: 'Пароль не найден (возможно, был утерян при обновлении)',
    password_user: 'Пароль пользователя',
    language_changed: 'Язык изменён на Русский. Перезагрузите страницу для полного применения.',
    account_created: 'Аккаунт создан! Войдите.'
  },
  en: {
    ban_title: '🚫 You are banned',
    notifications: 'Notifications',
    home: 'Home',
    profile: 'Profile',
    events: 'Events',
    admin: 'Admin',
    theme: 'Theme',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    search_placeholder: '🔍 Search people...',
    settings_title: '⚙️ Settings',
    theme_label: '🎨 Theme',
    theme_classic: 'Classic',
    theme_liquid_light: 'Liquid Glass Light',
    theme_liquid_dark: 'Liquid Glass Dark',
    theme_retro_light: 'Retro VK Light',
    theme_retro_dark: 'Retro VK Dark',
    secret_code: '🎁 Secret Code',
    code_placeholder: 'Enter code',
    activate_code: 'Activate',
    tokens_label: '💰 NBSS Tokens:',
    buy_premium: '💎 Buy NBSS+ for 1000 tokens',
    login_title: '🔐 Login to NBSS',
    username_placeholder: 'Username',
    password_placeholder: 'Password',
    login_btn: 'Login',
    no_account: 'Don\'t have an account?',
    register_link: 'Register',
    register_title: '📝 Registration',
    register_btn: 'Create Account',
    welcome: '👋 Welcome to NBSS!',
    post_placeholder: 'What\'s happening? #hashtag @mention',
    publish: 'Publish',
    events_title: '📅 Active Events',
    create_event: 'Create Event',
    event_title_placeholder: 'Title',
    event_desc_placeholder: 'Description',
    launch_event: '🚀 Launch',
    admin_title: '⚙️ Admin Panel',
    users_section: '👥 Users',
    admin_search_placeholder: '🔍 Enter username...',
    selected_user: 'Selected:',
    verify: '✅ Verify',
    unverify: '❌ Unverify',
    give_premium: '💎 NBSS+',
    revoke_premium: '💔 Revoke',
    set_owner: '👑 Owner',
    set_head_admin: '🛡 Head Admin',
    set_admin: '🔴 Admin',
    set_moderator: '🔵 Moderator',
    set_event_moderator: '📅 Event Moderator',
    remove_role: '👤 Remove Role',
    ban_1h: '⛔ Ban (1h)',
    unban: '✅ Unban',
    delete_user: '🗑 Delete',
    show_password: '🔑 Password',
    secret_codes: '🎁 Secret Codes',
    code_value_placeholder: 'Code (e.g., PREMIUM2025)',
    reward_tokens: '💰 Tokens',
    reward_premium: '💎 Premium',
    code_amount_placeholder: 'Token amount',
    code_max_uses_placeholder: 'Max uses (0 = unlimited)',
    create_code: 'Create Code',
    no_posts: 'No posts',
    no_events: 'No events',
    no_notifications: 'No notifications',
    error_loading: 'Error loading',
    error_network: 'Network error',
    login_required: 'Please login first',
    no_permission: 'No permission',
    comment_placeholder: 'Comment...',
    send: 'Send',
    delete_confirm: 'Delete comment?',
    post_delete_confirm: 'Delete post?',
    event_delete_confirm: 'Delete event?',
    user_delete_confirm: 'Delete user',
    code_delete_confirm: 'Delete code',
    translate: '🌐 Translate',
    original: '↩️ Original',
    translation_error: 'Translation error',
    no_users_found: 'Nobody found',
    premium_active: '✅ NBSS+ active',
    premium_not_active: '',
    password_owner_forbidden: 'Cannot view owner password',
    password_not_found: 'Password not found (may have been lost during update)',
    password_user: 'User password',
    language_changed: 'Language changed to English. Reload page for full effect.',
    account_created: 'Account created! Login.'
  },
  ja: {
    ban_title: '🚫 あなたは禁止されています',
    notifications: '通知',
    home: 'ホーム',
    profile: 'プロフィール',
    events: 'イベント',
    admin: '管理',
    theme: 'テーマ',
    logout: 'ログアウト',
    login: 'ログイン',
    register: '登録',
    search_placeholder: '🔍 人を検索...',
    settings_title: '⚙️ 設定',
    theme_label: '🎨 テーマ',
    theme_classic: 'クラシック',
    theme_liquid_light: 'Liquid Glass ライト',
    theme_liquid_dark: 'Liquid Glass ダーク',
    theme_retro_light: 'レトロ VK ライト',
    theme_retro_dark: 'レトロ VK ダーク',
    secret_code: '🎁 シークレットコード',
    code_placeholder: 'コードを入力',
    activate_code: 'アクティブ化',
    tokens_label: '💰 NBSSトークン:',
    buy_premium: '💎 NBSS+を1000トークンで購入',
    login_title: '🔐 NBSSにログイン',
    username_placeholder: 'ユーザー名',
    password_placeholder: 'パスワード',
    login_btn: 'ログイン',
    no_account: 'アカウントをお持ちでないですか？',
    register_link: '登録',
    register_title: '📝 登録',
    register_btn: 'アカウント作成',
    welcome: '👋 NBSSへようこそ！',
    post_placeholder: '今何してる？ #ハッシュタグ @メンション',
    publish: '公開',
    events_title: '📅 アクティブなイベント',
    create_event: 'イベントを作成',
    event_title_placeholder: 'タイトル',
    event_desc_placeholder: '説明',
    launch_event: '🚀 開始',
    admin_title: '⚙️ 管理パネル',
    users_section: '👥 ユーザー',
    admin_search_placeholder: '🔍 ユーザー名を入力...',
    selected_user: '選択:',
    verify: '✅ 認証',
    unverify: '❌ 解除',
    give_premium: '💎 NBSS+',
    revoke_premium: '💔 剥奪',
    set_owner: '👑 オーナー',
    set_head_admin: '🛡 ヘッド管理者',
    set_admin: '🔴 管理者',
    set_moderator: '🔵 モデレーター',
    set_event_moderator: '📅 イベントモデレーター',
    remove_role: '👤 役割を削除',
    ban_1h: '⛔ 禁止 (1時間)',
    unban: '✅ 禁止解除',
    delete_user: '🗑 削除',
    show_password: '🔑 パスワード',
    secret_codes: '🎁 シークレットコード',
    code_value_placeholder: 'コード (例: PREMIUM2025)',
    reward_tokens: '💰 トークン',
    reward_premium: '💎 プレミアム',
    code_amount_placeholder: 'トークン量',
    code_max_uses_placeholder: '最大使用回数 (0=無制限)',
    create_code: 'コードを作成',
    no_posts: '投稿がありません',
    no_events: 'イベントがありません',
    no_notifications: '通知がありません',
    error_loading: '読み込みエラー',
    error_network: 'ネットワークエラー',
    login_required: 'まずログインしてください',
    no_permission: '権限がありません',
    comment_placeholder: 'コメント...',
    send: '送信',
    delete_confirm: 'コメントを削除しますか？',
    post_delete_confirm: '投稿を削除しますか？',
    event_delete_confirm: 'イベントを削除しますか？',
    user_delete_confirm: 'ユーザーを削除',
    code_delete_confirm: 'コードを削除',
    translate: '🌐 翻訳',
    original: '↩️ オリジナル',
    translation_error: '翻訳エラー',
    no_users_found: '誰も見つかりません',
    premium_active: '✅ NBSS+ アクティブ',
    premium_not_active: '',
    password_owner_forbidden: 'オーナーのパスワードは表示できません',
    password_not_found: 'パスワードが見つかりません（更新により失われた可能性があります）',
    password_user: 'ユーザーパスワード',
    language_changed: '言語が日本語に変更されました。ページをリロードしてください。',
    account_created: 'アカウントが作成されました！ログインしてください。'
  }
};

function t(key) {
  return (translations[uiLang] && translations[uiLang][key]) || translations['en'][key] || key;
}

function applyUILanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.innerText = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
}

applyUILanguage();

let selectedAdminUser = null;

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
    const now = new Date(), until = new Date(bannedUntil), diff = until - now;
    if (diff <= 0) {
      overlay.style.display = 'none'; document.querySelector('.app-container').style.display = '';
      localStorage.removeItem('nbss_token'); location.reload();
    } else {
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      document.getElementById('banUntilText').textContent = `${t('ban_title')}. ${h}ч ${m}м ${s}с`;
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
  if (res.status === 401) { token = null; currentUser = null; localStorage.removeItem('nbss_token'); updateUIForAuth(); throw new Error(t('error_network')); }
  if (!res.ok) {
    let msg = t('error_network');
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch (e) {
      try { msg = await res.text(); } catch (e2) {}
    }
    throw new Error(msg);
  }
  return res.json();
}

(async function init() {
  if (token) {
    try {
      currentUser = await request('/me');
      updateTokenDisplay();
    } catch (e) { if (e.message === 'BANNED') return; }
  }
  updateUIForAuth(); updateNotificationBadge(); showPage('home'); loadTheme();
})();

function addNotification(type, message) {
  notifications.unshift({ id: Date.now(), type, message, read: false, timestamp: new Date().toISOString() });
  unreadCount = notifications.filter(n => !n.read).length;
  saveNotifications(); updateNotificationBadge(); showToast(message, type);
}
function saveNotifications() { localStorage.setItem('nbss_notifications', JSON.stringify(notifications)); }
function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (badge) { badge.textContent = unreadCount > 9 ? '9+' : unreadCount; badge.style.display = unreadCount > 0 ? 'inline-block' : 'none'; }
}
function renderNotificationHistory() {
  const list = document.getElementById('notificationList'); if (!list) return;
  list.innerHTML = notifications.length ? notifications.map(n => `<div class="notification-history-item"><div>${n.message}</div><div class="time">${new Date(n.timestamp).toLocaleString()}</div></div>`).join('') : `<div style="padding:12px;color:var(--text2);">${t('no_notifications')}</div>`;
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
  if (pageId === 'events') { loadEvents(); const card = document.getElementById('createEventCard'); if (card) card.style.display = (currentUser && ['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role)) ? '' : 'none'; }
  if (pageId === 'admin') { loadAdminStats(); resetAdminSearch(); loadAdminCodes(); loadInitialAdminUsers(); }
  if (pageId === 'settings') { updateThemeSettings(); updateTokenDisplay(); }
  updateStats();
}
function updateUIForAuth() {
  const loggedIn = !!token;
  const authBanner = document.getElementById('authBanner'); if (authBanner) authBanner.style.display = loggedIn ? 'none' : 'flex';
  const postComposer = document.getElementById('postComposer'); if (postComposer) postComposer.style.display = loggedIn ? 'block' : 'none';
  const navProfile = document.getElementById('navProfile');
  if (navProfile) navProfile.style.display = loggedIn ? 'flex' : 'none';
  const mobileNavProfile = document.getElementById('mobileNavProfile');
  if (mobileNavProfile) mobileNavProfile.style.display = loggedIn ? 'flex' : 'none';
  const logoutLink = document.getElementById('logoutLink'), mobileLogoutLink = document.getElementById('mobileLogoutLink');
  if (logoutLink) logoutLink.style.display = loggedIn ? 'flex' : 'none';
  if (mobileLogoutLink) mobileLogoutLink.style.display = loggedIn ? 'flex' : 'none';
  const loginLink = document.getElementById('loginLink'), mobileLoginLink = document.getElementById('mobileLoginLink');
  if (loginLink) loginLink.style.display = loggedIn ? 'none' : 'flex';
  if (mobileLoginLink) mobileLoginLink.style.display = loggedIn ? 'none' : 'flex';
  const registerLink = document.getElementById('registerLink'), mobileRegisterLink = document.getElementById('mobileRegisterLink');
  if (registerLink) registerLink.style.display = loggedIn ? 'none' : 'flex';
  if (mobileRegisterLink) mobileRegisterLink.style.display = loggedIn ? 'none' : 'flex';
  const navAdmin = document.getElementById('navAdmin'), mobileNavAdmin = document.getElementById('mobileNavAdmin');
  if (navAdmin) navAdmin.style.display = (currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role)) ? 'flex' : 'none';
  if (mobileNavAdmin) mobileNavAdmin.style.display = (currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role)) ? 'flex' : 'none';
}

document.addEventListener('click', (e) => {
  const navItem = e.target.closest('[data-page]');
  if (navItem) {
    e.preventDefault(); const page = navItem.dataset.page;
    if (page === 'profile' && !token) return alert(t('login_required'));
    if (page === 'admin' && !(currentUser && ['moderator','admin','head_admin','owner'].includes(currentUser.role))) return alert(t('no_permission'));
    if (page === 'logout') { token = null; currentUser = null; localStorage.removeItem('nbss_token'); updateUIForAuth(); showPage('home'); return; }
    window.viewingUser = null; showPage(page); return;
  }
  if (e.target.id === 'showRegisterLink') { e.preventDefault(); showPage('register'); return; }
  const mentionEl = e.target.closest('.mention');
  if (mentionEl) { e.preventDefault(); let u = mentionEl.textContent; if (u.startsWith('@')) u = u.slice(1); if (u && u !== currentUser?.username) { window.viewingUser = u; showPage('profile'); } return; }
  const usernameEl = e.target.closest('.username');
  if (usernameEl && !e.target.closest('.view-profile-btn')) { const postEl = usernameEl.closest('.post'); if (postEl) { const a = postEl.dataset.author; if (a && a !== currentUser?.username) { window.viewingUser = a; showPage('profile'); } } }
  const delCommentBtn = e.target.closest('.delete-comment-btn');
  if (delCommentBtn) { const commentId = delCommentBtn.dataset.id; if (confirm(t('delete_confirm'))) { request(`/comments/${commentId}`, { method:'DELETE' }).then(() => { const postEl = delCommentBtn.closest('.post'); if (postEl) loadComments(postEl.dataset.id, postEl.querySelector('.comments-section')); }).catch(err => alert(err.message)); } }
});

document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('loginUsername')?.value.trim(), p = document.getElementById('loginPassword')?.value.trim();
  if (!u || !p) return alert(t('error_network'));
  try {
    const data = await request('/login', { method:'POST', body: JSON.stringify({ username:u, password:p }) });
    token = data.token; currentUser = data.user;
    localStorage.setItem('nbss_token', token);
    updateUIForAuth();
    updateTokenDisplay();
    showPage('home');
  } catch (e) { alert(e.message); }
});
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const u = document.getElementById('regUsername')?.value.trim(), p = document.getElementById('regPassword')?.value.trim();
  if (!u || !p) return alert(t('error_network')); if (/\s/.test(u)) return alert('No spaces in username'); if (u.length < 3) return alert('Min 3 symbols');
  try { await request('/register', { method:'POST', body: JSON.stringify({ username:u, password:p }) }); alert(t('account_created')); showPage('login'); } catch (e) { alert(e.message); }
});

function applyTheme(theme) { document.body.classList.remove('classic','liquid-light','liquid-dark','retro-light','retro-dark'); document.body.classList.add(theme); localStorage.setItem('nbss_theme', theme); }
function loadTheme() { applyTheme(localStorage.getItem('nbss_theme') || 'classic'); }
function updateThemeSettings() { const radios = document.querySelectorAll('input[name="theme"]'); const cur = localStorage.getItem('nbss_theme') || 'classic'; radios.forEach(r => { r.checked = (r.value === cur); }); }
document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('input[name="theme"]').forEach(radio => { radio.addEventListener('change', (e) => { if (e.target.checked) applyTheme(e.target.value); }); }); });

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
  try { await request('/posts', { method:'POST', body: formData }); document.getElementById('postInput').value = ''; selectedFiles = []; renderPreviews(); postImageInput.value = ''; loadPosts(); } catch (e) { alert(e.message); }
});

async function loadPosts() { const c = document.getElementById('feedContainer'); if (!c) return; try { const ps = await request('/posts'); c.innerHTML = ps.length ? ps.map(p => renderPost(p)).join('') : `<p>${t('no_posts')}</p>`; attachPostActions(); } catch (e) { c.innerHTML = `<p>${t('error_loading')}</p>`; } }
function renderPost(p) {
  const role = p.authorRole || 'user', premium = p.authorPremium === true, verified = p.authorVerified === true;
  const canDelete = currentUser && (currentUser.username === p.author || ['moderator','admin','head_admin','owner'].includes(currentUser.role));
  let nickClass = 'role-' + role; if (premium && role === 'user') nickClass = 'premium-nick';
  let gallery = ''; if (p.images && p.images.length) gallery = `<div class="post-gallery">${p.images.map(img => `<img src="${img}" class="post-image" onerror="this.style.display='none'" onclick="this.requestFullscreen()">`).join('')}</div>`;
  const roleDisplay = ROLE_NAMES_RU[role] ? `<span class="role-badge">${ROLE_NAMES_RU[role]}</span>` : '';
  return `<div class="post" data-id="${p.id}" data-author="${p.author}"><div class="avatar">${p.author[0]?.toUpperCase()||'?'}</div><div class="post-body"><div class="post-header"><span class="username ${nickClass}" style="cursor:pointer;">${p.author||'Аноним'}${verified?'<img src="verification.png" class="verified-icon" alt="✔">':''}</span>${roleDisplay}<span>· ${new Date(p.timestamp).toLocaleString()}</span>${canDelete?`<button class="delete-post-btn" data-post-id="${p.id}">🗑️</button>`:''}</div>${gallery}${p.text?`<div class="post-text" id="text-${p.id}">${p.text.replace(/@(\w+)/g,'<span class="mention">@$1</span>')}</div>`:''}<div class="post-actions"><button class="like-btn">❤️ ${p.likes.length}</button><button class="repost-btn">🔄 ${p.reposts.length}</button><button class="comment-toggle">💬 ${t('comment_placeholder')}</button><button class="translate-btn" data-post-id="${p.id}">${t('translate')}</button></div><div class="comments-section" style="display:none;"></div></div></div>`;
}
function attachPostActions() {
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() { if (!token) return alert(t('login_required')); const el = this.closest('.post'); if (el.dataset.author === currentUser?.username) return showToast('Nice try, but no','like'); try { await request(`/posts/${el.dataset.id}/like`,{method:'POST'}); loadPosts(); } catch(e) { alert(e.message); } });
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() { if (!token) return alert(t('login_required')); const el = this.closest('.post'); if (el.dataset.author === currentUser?.username) return showToast('Nice try, but no','repost'); try { await request(`/posts/${el.dataset.id}/repost`,{method:'POST'}); loadPosts(); } catch(e) { alert(e.message); } });
  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() { const el = this.closest('.post'), sec = el.querySelector('.comments-section'); if (sec.style.display==='none') { sec.style.display='block'; await loadComments(el.dataset.id, sec); } else sec.style.display='none'; });
  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = async function() {
      const postEl = this.closest('.post');
      const textEl = postEl.querySelector('.post-text');
      if (!textEl) return;
      const postId = postEl.dataset.id;
      if (translatedPosts[postId]?.translated) {
        textEl.innerHTML = translatedPosts[postId].original;
        translatedPosts[postId].translated = false;
        this.textContent = t('translate');
        return;
      }
      const plainText = textEl.innerText.trim();
      if (!plainText) return;
      try {
        const target = userLang;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(plainText)}`;
        const res = await fetch(url);
        const data = await res.json();
        const translated = data[0].map(part => part[0]).join('');
        translatedPosts[postId] = { original: textEl.innerHTML, translated: true };
        textEl.innerText = translated;
        this.textContent = t('original');
      } catch (e) {
        alert(t('translation_error'));
      }
    };
  });
  document.querySelectorAll('.delete-post-btn').forEach(btn => btn.onclick = async function(e) { e.stopPropagation(); if (!token) return alert(t('login_required')); if (confirm(t('post_delete_confirm'))) { try { await request(`/posts/${this.dataset.postId}`,{method:'DELETE'}); loadPosts(); } catch(err) { alert(err.message); } } });
}

async function loadComments(postId, container) {
  if (!container) return;
  try {
    const comments = await request(`/posts/${postId}/comments`);
    container.innerHTML = comments.map(c => renderComment(c)).join('') +
      (token ? `<div class="comment-form"><input type="text" class="comment-input" placeholder="${t('comment_placeholder')}"><button class="btn primary comment-submit">${t('send')}</button></div>` : `<p>${t('login_required')}</p>`);
    if (token) {
      const inp = container.querySelector('.comment-input');
      const btn = container.querySelector('.comment-submit');
      if (btn) btn.onclick = async () => { const text = inp.value.trim(); if (!text) return; await request(`/posts/${postId}/comments`, { method:'POST', body: JSON.stringify({ text }) }); await loadComments(postId, container); };
      inp?.addEventListener('keypress', (e) => { if (e.key === 'Enter') btn.click(); });
    }
  } catch (e) { container.innerHTML = `<p>${t('error_loading')}</p>`; }
}
function renderComment(c) {
  const role = c.authorRole || 'user', premium = c.authorPremium === true, verified = c.authorVerified === true;
  let canDelete = currentUser && (currentUser.username === c.author || ['moderator','admin','head_admin','owner'].includes(currentUser.role));
  let nickClass = 'role-' + role; if (premium && role === 'user') nickClass = 'premium-nick';
  const roleDisplay = ROLE_NAMES_RU[role] ? `<span class="role-badge">${ROLE_NAMES_RU[role]}</span>` : '';
  return `<div class="comment" data-id="${c.id}"><div class="avatar-small">${c.author[0]?.toUpperCase()}</div><div class="comment-body"><span class="username ${nickClass}">${c.author}${verified ? '<img src="verification.png" class="verified-icon">' : ''}</span>${roleDisplay}<span>${new Date(c.timestamp).toLocaleString()}</span><p class="comment-text">${c.text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')}</p>${canDelete ? `<button class="delete-comment-btn" data-id="${c.id}">🗑️</button>` : ''}</div></div>`;
}

async function loadMyProfile() {
  if (!currentUser) return; const header = document.getElementById('profileHeader'); if (!header) return;
  let nickClass = 'role-' + (currentUser.role || 'user'); if (currentUser.premium && currentUser.role === 'user') nickClass = 'premium-nick';
  const roleName = ROLE_NAMES_RU[currentUser.role] || currentUser.role;
  header.innerHTML = `<h2 class="${nickClass}">${currentUser.username} ${currentUser.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${roleName} ${currentUser.premium ? '💎 НБСС+' : ''}</p>`;
  const allPosts = await request('/posts'); const userPosts = allPosts.filter(p => p.author === currentUser.username);
  const profilePosts = document.getElementById('profilePosts'); if (profilePosts) profilePosts.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : `<p>${t('no_posts')}</p>`;
  attachPostActions();
}
async function loadUserProfile(username) {
  try {
    const user = await request(`/user/${username}`); const header = document.getElementById('profileHeader'); if (!header) return;
    let nickClass = 'role-' + (user.role || 'user'); if (user.premium && user.role === 'user') nickClass = 'premium-nick';
    const roleName = ROLE_NAMES_RU[user.role] || user.role;
    header.innerHTML = `<h2 class="${nickClass}">${user.username} ${user.verified ? '<img src="verification.png" class="verified-icon">' : ''}</h2><p>${roleName} ${user.premium ? '💎 НБСС+' : ''}</p>`;
    const allPosts = await request('/posts'); const userPosts = allPosts.filter(p => p.author === username);
    const profilePosts = document.getElementById('profilePosts'); if (profilePosts) profilePosts.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : `<p>${t('no_posts')}</p>`;
    attachPostActions();
  } catch (e) { const header = document.getElementById('profileHeader'); if (header) header.innerHTML = `<p>${t('error_loading')}</p>`; }
}

async function loadEvents() {
  const list = document.getElementById('eventsList'); if (!list) return;
  try {
    const evs = await request('/events');
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner card"><strong>${e.title}</strong><p>${e.desc}</p>${currentUser && ['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role) && e.id ? `<button class="btn danger delete-event-btn" data-event-id="${e.id}">🗑 ${t('delete_user')}</button>` : ''}</div>`).join('') : `<p>${t('no_events')}</p>`;
    document.querySelectorAll('.delete-event-btn').forEach(btn => { btn.addEventListener('click', async () => { if (confirm(t('event_delete_confirm'))) { await request(`/events/${btn.dataset.eventId}`, { method:'DELETE' }); loadEvents(); } }); });
  } catch (e) {}
}
document.getElementById('createEventBtnEvents')?.addEventListener('click', async () => {
  if (!currentUser || !['event_moderator','moderator','admin','head_admin','owner'].includes(currentUser.role)) return alert(t('no_permission'));
  const title = document.getElementById('eventTitleEvents')?.value.trim(), desc = document.getElementById('eventDescEvents')?.value.trim();
  if (!title) return;
  await request('/events', { method:'POST', body: JSON.stringify({ title, desc }) });
  document.getElementById('eventTitleEvents').value = ''; document.getElementById('eventDescEvents').value = '';
  loadEvents();
});

async function loadAdminStats() {
  if (!currentUser || !['moderator','admin','head_admin','owner'].includes(currentUser.role)) return;
  const stats = await request('/stats'); const container = document.getElementById('adminStats');
  if (container) container.innerHTML = `<h3>📊 ${t('admin')}</h3><div class="stat-row"><span>👥</span><span>${stats.users}</span></div><div class="stat-row"><span>📝</span><span>${stats.posts}</span></div>`;
}

function resetAdminSearch() {
  selectedAdminUser = null;
  document.getElementById('adminUserSearch').value = '';
  document.getElementById('adminSearchResults').innerHTML = '';
  document.getElementById('adminSelectedUser').style.display = 'none';
  hideAllAdminButtons();
}

async function performAdminSearch(query) {
  const container = document.getElementById('adminSearchResults');
  if (!container) return;
  try {
    let users;
    if (query) {
      users = await request(`/users/search?q=${encodeURIComponent(query)}`);
    } else {
      users = await request('/admin/users');
    }
    if (users.length === 0) {
      container.innerHTML = `<p>${t('no_users_found')}</p>`;
      return;
    }
    container.innerHTML = users.map(u => `
      <div class="admin-search-result-item" data-username="${u.username}">
        <span>${u.username} ${u.role !== 'user' ? '('+ROLE_NAMES_RU[u.role]+')' : ''} ${u.verified ? '✔️' : ''} ${u.premium ? '💎' : ''}</span>
      </div>
    `).join('');
    document.querySelectorAll('.admin-search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const username = item.dataset.username;
        const user = users.find(u => u.username === username);
        selectAdminUser(user);
        container.innerHTML = '';
        document.getElementById('adminUserSearch').value = username;
      });
    });
  } catch (e) {
    container.innerHTML = `<p>${t('error_loading')}</p>`;
  }
}

document.getElementById('adminUserSearch')?.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  if (query) performAdminSearch(query);
});
document.getElementById('adminSearchButton')?.addEventListener('click', () => {
  const query = document.getElementById('adminUserSearch').value.trim();
  performAdminSearch(query || '');
});
document.getElementById('adminUserSearch')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = e.target.value.trim();
    performAdminSearch(query || '');
  }
});
function loadInitialAdminUsers() { performAdminSearch(''); }

function selectAdminUser(user) {
  selectedAdminUser = user;
  document.getElementById('adminSelectedUsername').textContent = user.username;
  document.getElementById('adminSelectedUser').style.display = '';
  updateAdminButtonsVisibility(user);
}

function updateAdminButtonsVisibility(target) {
  if (!target) { hideAllAdminButtons(); return; }
  const isOwner = () => currentUser.role === 'owner',
        isHeadAdminOrAbove = () => ['head_admin','owner'].includes(currentUser.role),
        isAdminOrAbove = () => ['admin','head_admin','owner'].includes(currentUser.role),
        isModeratorOrAbove = () => ['moderator','admin','head_admin','owner'].includes(currentUser.role);
  const canModify = () => {
    if (!target) return false;
    if (target.username === 'MrSigma') return false;
    return (ROLE_HIERARCHY[currentUser.role]||0) > (ROLE_HIERARCHY[target.role]||0);
  };

  const buttons = {
    verifyUserBtn: isModeratorOrAbove() && (canModify() || target.username === currentUser.username),
    unverifyUserBtn: isModeratorOrAbove() && (canModify() || target.username === currentUser.username),
    givePremiumBtn: isModeratorOrAbove() && canModify(),
    revokePremiumBtn: isModeratorOrAbove() && canModify(),
    setOwnerBtn: isOwner() && canModify(),
    setHeadAdminBtn: isOwner() && canModify(),
    setAdminBtn: isHeadAdminOrAbove() && canModify(),
    setModeratorBtn: isAdminOrAbove() && canModify(),
    setEventModeratorBtn: isAdminOrAbove() && canModify(),
    removeRoleBtn: isModeratorOrAbove() && canModify(),
    banUserBtn: isModeratorOrAbove() && canModify(),
    unbanUserBtn: isModeratorOrAbove() && canModify(),
    deleteUserBtn: isModeratorOrAbove() && canModify(),
    showPasswordBtn: isOwner()
  };

  for (const [id, visible] of Object.entries(buttons)) {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = visible ? '' : 'none';
  }
}

function hideAllAdminButtons() {
  ['verifyUserBtn','unverifyUserBtn','givePremiumBtn','revokePremiumBtn',
   'setOwnerBtn','setHeadAdminBtn','setAdminBtn','setModeratorBtn',
   'setEventModeratorBtn','removeRoleBtn','banUserBtn','unbanUserBtn',
   'deleteUserBtn','showPasswordBtn'].forEach(id => {
     const btn = document.getElementById(id);
     if (btn) btn.style.display = 'none';
   });
}

async function modifyUser(username, changes) {
  try {
    await request(`/admin/user/${username}`, { method:'POST', body: JSON.stringify(changes) });
    const updated = await request(`/user/${username}`);
    selectAdminUser(updated);
    loadAdminStats();
  } catch (e) { alert(e.message); }
}

document.getElementById('verifyUserBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { verified: true }); });
document.getElementById('unverifyUserBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { verified: false }); });
document.getElementById('givePremiumBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { premium: true }); });
document.getElementById('revokePremiumBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { premium: false }); });
document.getElementById('setOwnerBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { role: 'owner' }); });
document.getElementById('setHeadAdminBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { role: 'head_admin' }); });
document.getElementById('setAdminBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { role: 'admin' }); });
document.getElementById('setModeratorBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { role: 'moderator' }); });
document.getElementById('setEventModeratorBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { role: 'event_moderator' }); });
document.getElementById('removeRoleBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { role: 'user' }); });
document.getElementById('banUserBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { banUntil: new Date(Date.now()+3600000).toISOString() }); });
document.getElementById('unbanUserBtn')?.addEventListener('click', () => { if (selectedAdminUser) modifyUser(selectedAdminUser.username, { banUntil: null }); });
document.getElementById('deleteUserBtn')?.addEventListener('click', () => {
  if (selectedAdminUser && confirm(t('user_delete_confirm'))) {
    modifyUser(selectedAdminUser.username, { delete: true });
    resetAdminSearch();
  }
});

document.getElementById('showPasswordBtn')?.addEventListener('click', async () => {
  if (!selectedAdminUser) return;
  if (selectedAdminUser.username === 'MrSigma') {
    alert(t('password_owner_forbidden'));
    return;
  }
  try {
    const data = await request(`/admin/user/${selectedAdminUser.username}/password`);
    alert(`${t('password_user')} ${selectedAdminUser.username}: ${data.password}`);
  } catch (e) {
    alert(e.message);
  }
});

async function loadAdminCodes() {
  if (!currentUser || !['head_admin','owner'].includes(currentUser.role)) {
    document.getElementById('adminCodesCard').style.display = 'none';
    return;
  }
  document.getElementById('adminCodesCard').style.display = '';
  try {
    const codes = await request('/admin/codes');
    const container = document.getElementById('codesList');
    if (!codes.length) {
      container.innerHTML = `<p>${t('no_events')}</p>`;
      return;
    }
    container.innerHTML = codes.map(c => `
      <div class="code-item">
        <div>
          <span class="code-value">${c.code}</span>
          <span class="code-reward">${c.reward === 'tokens' ? '💰 ' + c.amount + ' ' + t('tokens_label') : '💎 ' + t('reward_premium')}</span>
          <span class="code-used">${c.maxUses > 0 ? `${c.usedBy?.length || 0}/${c.maxUses}` : (c.usedBy?.length || 0)} ${t('used')}</span>
        </div>
        <button class="btn danger delete-code-btn" data-code="${c.code}">🗑</button>
      </div>
    `).join('');
    document.querySelectorAll('.delete-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(t('code_delete_confirm'))) return;
        try {
          await request(`/admin/codes/${encodeURIComponent(btn.dataset.code)}`, { method: 'DELETE' });
          loadAdminCodes();
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {}
}

document.getElementById('createCodeBtn')?.addEventListener('click', async () => {
  const code = document.getElementById('newCodeValue').value.trim();
  const reward = document.getElementById('newCodeReward').value;
  const amount = parseInt(document.getElementById('newCodeAmount').value) || 0;
  const maxUses = parseInt(document.getElementById('newCodeMaxUses').value) || 0;
  if (!code) return alert(t('error_network'));
  try {
    await request('/admin/create-code', { method:'POST', body: JSON.stringify({ code, reward, amount, maxUses }) });
    alert(t('code_created'));
    document.getElementById('newCodeValue').value = '';
    loadAdminCodes();
  } catch (e) { alert(e.message); }
});

document.getElementById('newCodeReward')?.addEventListener('change', function() {
  document.getElementById('newCodeAmount').style.display = this.value === 'tokens' ? '' : 'none';
});

async function updateStats() { try { await request('/stats'); } catch(e) {} }
updateStats(); setInterval(updateStats, 10000);

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const searchResultsContainer = document.getElementById('searchResults');

async function performSearch(query) {
  if (!searchResultsContainer) return;
  try {
    const users = await request(`/users/search?q=${encodeURIComponent(query)}`);
    if (users.length === 0) {
      searchResultsContainer.innerHTML = `<p>${t('no_users_found')}</p>`;
      return;
    }
    searchResultsContainer.innerHTML = users.map(u => {
      let nickClass = 'role-' + (u.role || 'user');
      if (u.premium && u.role === 'user') nickClass = 'premium-nick';
      return `<div class="search-user">
        <span class="username ${nickClass}">${u.username}${u.verified ? '<img src="verification.png" class="verified-icon">' : ''}</span>
        <button class="btn outline view-profile-btn" data-username="${u.username}">→</button>
      </div>`;
    }).join('');
    document.querySelectorAll('.view-profile-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.viewingUser = btn.dataset.username;
        showPage('profile');
      });
    });
  } catch (e) {
    searchResultsContainer.innerHTML = `<p>${t('error_loading')}</p>`;
  }
}

searchInput?.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (q) performSearch(q);
  else searchResultsContainer.innerHTML = '';
});
searchButton?.addEventListener('click', () => {
  const q = searchInput.value.trim();
  performSearch(q || '');
});
searchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = searchInput.value.trim();
    performSearch(q || '');
  }
});

const secretCodeInput = document.getElementById('secretCodeInput');
const activateCodeBtn = document.getElementById('activateCodeBtn');
const codeMessage = document.getElementById('codeMessage');
const tokenBalanceSpan = document.getElementById('tokenBalance');
const buyPremiumBtn = document.getElementById('buyPremiumBtn');
const premiumStatus = document.getElementById('premiumStatus');

function updateTokenDisplay() {
  const row = document.getElementById('tokenBalanceRow');
  if (!currentUser) {
    if (row) row.style.display = 'none';
    return;
  }
  if (row) row.style.display = '';
  if (tokenBalanceSpan) tokenBalanceSpan.textContent = currentUser.tokens || 0;
  if (currentUser.premium) {
    if (buyPremiumBtn) buyPremiumBtn.style.display = 'none';
    if (premiumStatus) premiumStatus.textContent = t('premium_active');
  } else {
    if (buyPremiumBtn) buyPremiumBtn.style.display = '';
    if (premiumStatus) premiumStatus.textContent = t('premium_not_active');
  }
}

buyPremiumBtn?.addEventListener('click', async () => {
  try {
    const result = await request('/buy-premium', { method: 'POST' });
    alert(result.message);
    currentUser = await request('/me');
    updateTokenDisplay();
    updateUIForAuth();
  } catch (e) { alert(e.message); }
});

activateCodeBtn?.addEventListener('click', async () => {
  const code = secretCodeInput.value.trim();
  if (!code) return;
  try {
    const result = await request('/redeem-code', { method: 'POST', body: JSON.stringify({ code }) });
    codeMessage.innerHTML = '<span style="color:green;">' + result.message + '</span>';
    secretCodeInput.value = '';
    currentUser = await request('/me');
    updateTokenDisplay();
    updateUIForAuth();
  } catch (e) {
    codeMessage.innerHTML = '<span style="color:red;">' + e.message + '</span>';
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered'))
      .catch(error => console.log('SW error'));
  });
}
