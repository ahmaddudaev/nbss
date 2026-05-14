(function() {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('nbss_'+k); return v ? JSON.parse(v) : d; } catch(e) { return d; } },
    set(k, v) { localStorage.setItem('nbss_'+k, JSON.stringify(v)); }
  };

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
  const saveUsers = (u) => LS.set('users', u);
  const savePosts = (p) => LS.set('posts', p);
  const saveEvents = (e) => LS.set('events', e);
  const hash = (pw) => btoa(pw);

  // DOM элементы
  const pageElements = {
    login: document.getElementById('loginPage'),
    register: document.getElementById('registerPage'),
    home: document.getElementById('homePage'),
    profile: document.getElementById('profilePage'),
    events: document.getElementById('eventsPage'),
    admin: document.getElementById('adminPage')
  };
  const navLinks = document.querySelectorAll('.nav-item[data-page]');
  const authBanner = document.getElementById('authBanner');
  const postComposer = document.getElementById('postComposer');
  const navProfile = document.getElementById('navProfile');
  const navAdmin = document.getElementById('navAdmin');
  const logoutLink = document.getElementById('logoutLink');
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');

  function showPage(pageId) {
    Object.values(pageElements).forEach(p => p.classList.remove('active'));
    if (pageElements[pageId]) pageElements[pageId].classList.add('active');
    navLinks.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (pageId === 'home') renderFeed();
    if (pageId === 'profile') renderProfile();
    if (pageId === 'events') renderEvents();
    if (pageId === 'admin') { renderAdminPanel(); updateAdminStats(); }
    updateStatsWidget();
  }

  function isAdmin() { return currentUser && users()[currentUser]?.admin; }
  function isPremium() { return currentUser && users()[currentUser]?.premium; }

  function updateUIForAuth() {
    const loggedIn = !!currentUser;
    authBanner.style.display = loggedIn ? 'none' : 'flex';
    postComposer.style.display = loggedIn ? 'block' : 'none';
    navProfile.style.display = loggedIn ? 'flex' : 'none';
    navAdmin.style.display = isAdmin() ? 'flex' : 'none';
    logoutLink.style.display = loggedIn ? 'flex' : 'none';
    loginLink.style.display = loggedIn ? 'none' : 'flex';
    registerLink.style.display = loggedIn ? 'none' : 'flex';
    document.getElementById('premiumStatusUser').textContent = isPremium() ? 'Активна' : 'Не активна';
  }

  // Навигация
  navLinks.forEach(link => {
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
  logoutLink.addEventListener('click', () => { currentUser = null; LS.set('currentUser', null); updateUIForAuth(); showPage('home'); });

  // Вход / Регистрация
  document.getElementById('loginBtn').addEventListener('click', () => {
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const all = users();
    if (all[u] && all[u].password === hash(p)) {
      currentUser = u; LS.set('currentUser', u); updateUIForAuth(); showPage('home');
    } else alert('Неверный логин или пароль');
  });
  document.getElementById('showRegisterLink').addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });
  document.getElementById('registerBtn').addEventListener('click', () => {
    const u = document.getElementById('regUsername').value.trim();
    const p = document.getElementById('regPassword').value.trim();
    if (!u || !p) return alert('Заполните поля');
    const all = users();
    if (all[u]) return alert('Пользователь уже существует');
    all[u] = { username: u, password: hash(p), verified: false, admin: false, premium: false };
    saveUsers(all);
    currentUser = u; LS.set('currentUser', u); updateUIForAuth(); showPage('home');
  });

  // Смена темы
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('nbss_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });
  if (localStorage.getItem('nbss_theme') === 'light') document.body.classList.add('light-mode');

  // Публикация
  document.getElementById('publishPost').addEventListener('click', () => {
    if (!currentUser) return;
    const text = document.getElementById('postInput').value.trim();
    if (!text) return;
    const all = posts();
    all.unshift({ id: Date.now(), author: currentUser, text, likes: [], reposts: [], timestamp: new Date().toISOString() });
    savePosts(all);
    document.getElementById('postInput').value = '';
    renderFeed();
    updateStatsWidget();
  });

  function renderFeed() {
    const container = document.getElementById('feedContainer');
    container.innerHTML = posts().map(p => renderPost(p)).join('');
    attachPostActions();
  }

  function renderPost(p) {
    const author = users()[p.author] || { username:'unknown', verified:false, premium:false };
    const nickClass = author.premium ? 'premium-nick' : '';
    const verifiedIcon = author.verified ? '<span class="verified-badge">✔️</span>' : '';
    const formatted = p.text.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>').replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    return `
      <div class="post" data-id="${p.id}">
        <div class="avatar">${author.username[0]?.toUpperCase()}</div>
        <div class="post-body">
          <div class="post-header">
            <span class="username ${nickClass}">${author.username}${verifiedIcon}</span>
            <span class="post-time">· ${new Date(p.timestamp).toLocaleString()}</span>
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
        if (!post.likes.includes(currentUser)) post.likes.push(currentUser);
        else post.likes = post.likes.filter(u => u !== currentUser);
        savePosts(all); renderFeed();
      });
    });
    document.querySelectorAll('.repost-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!currentUser) return alert('Войдите, чтобы делать репосты');
        const postId = Number(this.closest('.post').dataset.id);
        const all = posts();
        const post = all.find(p => p.id === postId);
        if (!post) return;
        if (!post.reposts.includes(currentUser)) post.reposts.push(currentUser);
        savePosts(all); renderFeed();
      });
    });
  }

  function renderProfile() {
    if (!currentUser) return;
    const u = users()[currentUser];
    const nameEl = document.getElementById('profileName');
    nameEl.textContent = currentUser;
    nameEl.className = u?.premium ? 'premium-nick' : '';
    document.getElementById('profileStatus').textContent = (u?.verified ? '✅ Верифицирован' : '') + (u?.premium ? ' 💎 НБСС+' : '');
    const container = document.getElementById('profilePosts');
    const userPosts = posts().filter(p => p.author === currentUser);
    container.innerHTML = userPosts.length ? userPosts.map(p => renderPost(p)).join('') : '<p style="padding:20px;">Нет постов</p>';
    attachPostActions();
  }

  function renderEvents() {
    const evs = events();
    document.getElementById('eventsList').innerHTML = evs.length ? evs.map(e => `<div class="event-banner"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('') : '<p>Нет активных ивентов</p>';
  }

  function updateAdminStats() {
    document.getElementById('adminUsersStat').textContent = Object.keys(users()).length;
    document.getElementById('adminPostsStat').textContent = posts().length;
    document.getElementById('adminPageViewsStat').textContent = LS.get('pageviews');
    document.getElementById('adminOnlineStat').textContent = document.getElementById('onlineStat').textContent;
  }

  function renderAdminPanel() {
    if (!isAdmin()) return;
    const select = document.getElementById('userSelect');
    const all = users();
    select.innerHTML = Object.keys(all).map(u => `<option value="${u}">${u} ${all[u].admin?'(админ)':''} ${all[u].verified?'✔️':''} ${all[u].premium?'💎':''}</option>`).join('');
  }

  // Админ действия
  const adminHandlers = {
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
  Object.entries(adminHandlers).forEach(([id, handler]) => {
    document.getElementById(id).addEventListener('click', () => {
      if (!isAdmin()) return;
      const sel = document.getElementById('userSelect').value;
      handler(sel);
      renderAdminPanel();
    });
  });
  document.getElementById('createEventBtn').addEventListener('click', () => {
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

  function updateStatsWidget() {
    document.getElementById('totalUsersStat').textContent = Object.keys(users()).length;
    document.getElementById('totalPostsStat').textContent = posts().length;
    document.getElementById('pageViewsStat').textContent = LS.get('pageviews');
    document.getElementById('onlineStat').textContent = Math.floor(Math.random() * 5) + 1;
    if (pageElements.admin.classList.contains('active')) updateAdminStats();
  }
  setInterval(updateStatsWidget, 10000);

  // Инициализация
  updateUIForAuth();
  showPage('home');
  updateStatsWidget();
})();
