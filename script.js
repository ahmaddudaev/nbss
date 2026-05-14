(function() {
  // ---------- Хранилище ----------
  const LS = {
    get(key, def) {
      try { const v = localStorage.getItem('nbss_'+key); return v ? JSON.parse(v) : def; }
      catch(e) { return def; }
    },
    set(key, val) { localStorage.setItem('nbss_'+key, JSON.stringify(val)); }
  };

  // Инициализация данных
  if (!LS.get('users')) {
    LS.set('users', {
      'MrSigma': { username:'MrSigma', password:btoa('Mrbeast132!'), verified:true, admin:true, premium:true }
    });
  }
  if (!LS.get('posts')) LS.set('posts', []);
  if (!LS.get('events')) LS.set('events', []);
  if (!LS.get('pageviews')) LS.set('pageviews', 0);
  LS.set('pageviews', LS.get('pageviews') + 1);

  let currentUser = LS.get('currentUser') || null;
  const users = () => LS.get('users');
  const posts = () => LS.get('posts');
  const events = () => LS.get('events');
  function saveUsers(u) { LS.set('users', u); }
  function savePosts(p) { LS.set('posts', p); }
  function saveEvents(e) { LS.set('events', e); }
  function hash(pw) { return btoa(pw); }

  // Страницы
  const pages = {
    login: document.getElementById('loginPage'),
    register: document.getElementById('registerPage'),
    home: document.getElementById('homePage'),
    profile: document.getElementById('profilePage'),
    events: document.getElementById('eventsPage'),
    admin: document.getElementById('adminPage')
  };
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const authBanner = document.getElementById('authBanner');
  const postComposer = document.getElementById('postComposer');
  const navProfile = document.getElementById('navProfile');
  const navAdmin = document.getElementById('navAdmin');
  const logoutLink = document.getElementById('logoutLink');
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');

  // Переключение страниц
  function showPage(pageId) {
    // Скрываем все страницы
    Object.values(pages).forEach(p => p.classList.remove('active'));
    // Показываем нужную
    if (pages[pageId]) pages[pageId].classList.add('active');
    // Обновляем активный пункт навигации
    navItems.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) activeNav.classList.add('active');
    // Рендерим содержимое
    if (pageId === 'home') renderFeed();
    if (pageId === 'profile') renderProfile();
    if (pageId === 'events') renderEvents();
    if (pageId === 'admin') { renderAdminPanel(); updateAdminStats(); }
    updateStatsWidget();
  }

  function isAdmin() { return currentUser && users()[currentUser]?.admin; }
  function isPremium() { return currentUser && users()[currentUser]?.premium; }

  // Обновление видимости элементов в зависимости от авторизации
  function updateUIForAuth() {
    const loggedIn = !!currentUser;
    if (authBanner) authBanner.style.display = loggedIn ? 'none' : 'flex';
    if (postComposer) postComposer.style.display = loggedIn ? 'block' : 'none';
    if (navProfile) navProfile.style.display = loggedIn ? 'flex' : 'none';
    if (navAdmin) navAdmin.style.display = isAdmin() ? 'flex' : 'none';
    if (logoutLink) logoutLink.style.display = loggedIn ? 'flex' : 'none';
    if (loginLink) loginLink.style.display = loggedIn ? 'none' : 'flex';
    if (registerLink) registerLink.style.display = loggedIn ? 'none' : 'flex';
    const premStatus = document.getElementById('premiumStatusUser');
    if (premStatus) premStatus.textContent = isPremium() ? 'Активна' : 'Не активна';
  }

  // Навигация
  navItems.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page === 'profile' && !currentUser) return alert('Сначала войдите');
      if (page === 'admin' && !isAdmin()) return alert('Доступ запрещён');
      showPage(page);
    });
  });
  document.getElementById('loginFromBanner')?.addEventListener('click', () => showPage('login'));
  document.getElementById('registerFromBanner')?.addEventListener('click', () => showPage('register'));
  logoutLink?.addEventListener('click', () => {
    currentUser = null;
    LS.set('currentUser', null);
    updateUIForAuth();
    showPage('home');
  });

  // Вход
  document.getElementById('loginBtn').addEventListener('click', () => {
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const all = users();
    if (all[u] && all[u].password === hash(p)) {
      currentUser = u;
      LS.set('currentUser', u);
      updateUIForAuth();
      showPage('home');
    } else alert('Неверный логин или пароль');
  });
  document.getElementById('showRegisterLink').addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });

  // Регистрация
  document.getElementById('registerBtn').addEventListener('click', () => {
    const u = document.getElementById('regUsername').value.trim();
    const p = document.getElementById('regPassword').value.trim();
    if (!u || !p) return alert('Заполните поля');
    const all = users();
    if (all[u]) return alert('Пользователь уже существует');
    all[u] = { username: u, password: hash(p), verified: false, admin: false, premium: false };
    saveUsers(all);
    currentUser = u;
    LS.set('currentUser', u);
    updateUIForAuth();
    showPage('home');
  });

  // Смена темы
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('nbss_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });
  if (localStorage.getItem('nbss_theme') === 'light') document.body.classList.add('light-mode');

  // Публикация поста
  document.getElementById('publishPost').addEventListener('click', () => {
    if (!currentUser) return;
    const text = document.getElementById('postInput').value.trim();
    if (!text) return;
    const all = posts();
    all.unshift({
      id: Date.now(),
      author: currentUser,
      text: text,
      likes: [],
      reposts: [],
      timestamp: new Date().toISOString()
    });
    savePosts(all);
    document.getElementById('postInput').value = '';
    renderFeed();
    updateStatsWidget();
  });

  // Рендер ленты
  function renderFeed() {
    const container = document.getElementById('feedContainer');
    if (!container) return;
    container.innerHTML = posts().map(p => renderPost(p)).join('');
    attachPostActions();
  }

  function renderPost(p) {
    const author = users()[p.author] || { username:'unknown', verified:false, premium:false };
    const nickClass = author.premium ? 'premium-nick' : '';
    const verifiedIcon = author.verified ? '<span class="verified-badge">✔️</span>' : '';
    const formatted = p.text
      .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
      .replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    return `
      <div class="post" data-id="${p.id}">
        <div class="avatar">${author.username[0]?.toUpperCase()}</div>
        <div class="post-body">
          <div class="post-header">
            <span class="username ${nickClass}">${author.username}${verifiedIcon}</span>
            <span style="color:var(--text2); font-size:13px;">· ${new Date(p.timestamp).toLocaleString()}</span>
          </div>
          <div class="post-text">${formatted}</div>
          <div class="post-actions">
            <button class="like-btn">❤️ ${p.likes.length}</button>
            <button class="repost-btn">🔄 ${p.reposts.length}</button>
          </div>
        </div>
      </div>`;
  }

  function attachPostActions() {
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!currentUser) return alert('Войдите, чтобы ставить лайки');
        const postId = Number(this.closest('.post').dataset.id);
        const all = posts();
        const post = all.find(p => p.id === postId);
        if (!post) return;
        if (!post.likes.includes(currentUser)) {
          post.likes.push(currentUser);
        } else {
          post.likes = post.likes.filter(u => u !== currentUser);
        }
        savePosts(all);
        renderFeed();
      });
    });
    document.querySelectorAll('.repost-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!currentUser) return alert('Войдите, чтобы делать репосты');
        const postId = Number(this.closest('.post').dataset.id);
        const all = posts();
        const post = all.find(p => p.id === postId);
        if (!post) return;
        if (!post.reposts.includes(currentUser)) {
          post.reposts.push(currentUser);
          savePosts(all);
          renderFeed();
        }
      });
    });
  }

  // Профиль
  function renderProfile() {
    if (!currentUser) return;
    const u = users()[currentUser];
    const nameEl = document.getElementById('profileName');
    if (nameEl) {
      nameEl.textContent = currentUser;
      nameEl.className = u?.premium ? 'premium-nick' : '';
    }
    const statusEl = document.getElementById('profileStatus');
    if (statusEl) statusEl.textContent = (u?.verified ? '✅ Верифицирован' : '') + (u?.premium ? ' 💎 НБСС+' : '');
    const container = document.getElementById('profilePosts');
    if (container) {
      const userPosts = posts().filter(p => p.author === currentUser);
      container.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p style="padding:20px;">Нет постов</p>';
      attachPostActions();
    }
  }

  // Ивенты
  function renderEvents() {
    const list = document.getElementById('eventsList');
    if (!list) return;
    const evs = events();
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('') : '<p>Нет активных ивентов</p>';
  }

  // Админка
  function updateAdminStats() {
    document.getElementById('adminUsersStat').textContent = Object.keys(users()).length;
    document.getElementById('adminPostsStat').textContent = posts().length;
    document.getElementById('adminPageViewsStat').textContent = LS.get('pageviews');
    document.getElementById('adminOnlineStat').textContent = document.getElementById('onlineStat')?.textContent || '1';
  }

  function renderAdminPanel() {
    if (!isAdmin()) return;
    const select = document.getElementById('userSelect');
    if (!select) return;
    const all = users();
    select.innerHTML = Object.keys(all).map(u => `<option value="${u}">${u} ${all[u].admin?'(админ)':''} ${all[u].verified?'✔️':''} ${all[u].premium?'💎':''}</option>`).join('');
  }

  // Обработчики кнопок админки
  const adminBtns = {
    verifyUserBtn: (sel) => { const all = users(); if (all[sel]) { all[sel].verified = true; saveUsers(all); } },
    unverifyUserBtn: (sel) => { const all = users(); if (all[sel]) { all[sel].verified = false; saveUsers(all); } },
    makeAdminBtn: (sel) => { const all = users(); if (all[sel]) { all[sel].admin = true; saveUsers(all); } },
    revokeAdminBtn: (sel) => {
      if (sel === 'MrSigma') return alert('Нельзя разжаловать главного админа');
      const all = users(); if (all[sel]) { all[sel].admin = false; saveUsers(all); }
    },
    givePremiumBtn: (sel) => { const all = users(); if (all[sel]) { all[sel].premium = true; saveUsers(all); alert(`Подписка выдана ${sel}`); } },
    revokePremiumBtn: (sel) => { const all = users(); if (all[sel]) { all[sel].premium = false; saveUsers(all); alert(`Подписка отобрана у ${sel}`); } },
    deleteUserBtn: (sel) => {
      if (sel === 'MrSigma') return alert('Нельзя удалить главного админа');
      if (confirm(`Удалить ${sel}?`)) { const all = users(); delete all[sel]; saveUsers(all); }
    }
  };

  Object.entries(adminBtns).forEach(([id, handler]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        if (!isAdmin()) return;
        const sel = document.getElementById('userSelect').value;
        handler(sel);
        renderAdminPanel();
      });
    }
  });

  document.getElementById('createEventBtn')?.addEventListener('click', () => {
    if (!isAdmin()) return;
    const title = document.getElementById('eventTitle').value.trim();
    const desc = document.getElementById('eventDesc').value.trim();
    if (!title) return;
    const evs = events();
    evs.push({ title, desc });
    saveEvents(evs);
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDesc').value = '';
    renderEvents();
    alert('Ивент запущен!');
  });

  // Статистика в боковой панели
  function updateStatsWidget() {
    document.getElementById('totalUsersStat').textContent = Object.keys(users()).length;
    document.getElementById('totalPostsStat').textContent = posts().length;
    document.getElementById('pageViewsStat').textContent = LS.get('pageviews');
    document.getElementById('onlineStat').textContent = Math.floor(Math.random() * 5) + 1;
    if (pages.admin.classList.contains('active')) updateAdminStats();
  }
  setInterval(updateStatsWidget, 10000);

  // Старт
  updateUIForAuth();
  showPage('home');
  updateStatsWidget();
})();
