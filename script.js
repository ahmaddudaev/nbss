(function() {
  const LS = {
    get(key, def) { try { const v = localStorage.getItem('nbss_'+key); return v ? JSON.parse(v) : def; } catch(e) { return def; } },
    set(key, val) { localStorage.setItem('nbss_'+key, JSON.stringify(val)); }
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

  function saveUsers(u) { LS.set('users', u); }
  function savePosts(p) { LS.set('posts', p); }
  function saveEvents(e) { LS.set('events', e); }

  function hash(pw) { return btoa(pw); }

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
  const logoutBtn = document.getElementById('logoutBtn');
  // Новые элементы навигации для входа/регистрации
  const loginNavItem = document.getElementById('loginNavItem');
  const registerNavItem = document.getElementById('registerNavItem');

  function showPage(pageId) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    if (pages[pageId]) pages[pageId].classList.add('active');
    navItems.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (pageId === 'home') renderFeed();
    if (pageId === 'profile') renderProfile();
    if (pageId === 'events') renderEvents();
    if (pageId === 'admin') renderAdminPanel();
    updateStatsWidget();
    if (pageId === 'admin') updateAdminStats();
  }

  function isAdmin() { return currentUser && users()[currentUser]?.admin; }
  function isPremium() { return currentUser && users()[currentUser]?.premium; }

  function updateUIForAuth() {
    const loggedIn = !!currentUser;
    authBanner.style.display = loggedIn ? 'none' : 'flex';
    postComposer.style.display = loggedIn ? 'block' : 'none';
    navProfile.style.display = loggedIn ? 'flex' : 'none';
    navAdmin.style.display = isAdmin() ? 'flex' : 'none';
    logoutBtn.style.display = loggedIn ? 'flex' : 'none';
    // Пункты «Войти» и «Регистрация» видны только гостям
    loginNavItem.style.display = loggedIn ? 'none' : 'flex';
    registerNavItem.style.display = loggedIn ? 'none' : 'flex';
    document.getElementById('premiumStatusUser').textContent = isPremium() ? 'Активна' : 'Не активна';
  }

  document.getElementById('loginBtn').addEventListener('click', () => {
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const allUsers = users();
    if (allUsers[u] && allUsers[u].password === hash(p)) {
      currentUser = u;
      LS.set('currentUser', u);
      updateUIForAuth();
      showPage('home');
    } else alert('Неверный логин или пароль');
  });

  document.getElementById('showRegisterLink').addEventListener('click', (e) => {
    e.preventDefault();
    showPage('register');
  });

  document.getElementById('registerBtn').addEventListener('click', () => {
    const u = document.getElementById('regUsername').value.trim();
    const p = document.getElementById('regPassword').value.trim();
    if (!u || !p) return alert('Заполните поля');
    const allUsers = users();
    if (allUsers[u]) return alert('Пользователь уже существует');
    allUsers[u] = { username:u, password:hash(p), verified:false, admin:false, premium:false };
    saveUsers(allUsers);
    currentUser = u;
    LS.set('currentUser', u);
    updateUIForAuth();
    showPage('home');
  });

  // Обработчики для пунктов навигации (включая Войти/Регистрация)
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page === 'profile' && !currentUser) return alert('Сначала войдите');
      if (page === 'admin' && !isAdmin()) return alert('Доступ запрещён');
      showPage(page);
    });
  });

  // Кнопки из баннера (оставлены для удобства)
  document.getElementById('loginFromBanner')?.addEventListener('click', () => showPage('login'));
  document.getElementById('registerFromBanner')?.addEventListener('click', () => showPage('register'));

  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    LS.set('currentUser', null);
    updateUIForAuth();
    showPage('home');
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('nbss_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
  });
  if (localStorage.getItem('nbss_theme') === 'light') document.body.classList.add('light-mode');

  document.getElementById('publishPost').addEventListener('click', () => {
    if (!currentUser) return;
    const text = document.getElementById('postInput').value.trim();
    if (!text) return;
    const allPosts = posts();
    allPosts.unshift({
      id: Date.now(),
      author: currentUser,
      text: text,
      likes: [],
      reposts: [],
      timestamp: new Date().toISOString()
    });
    savePosts(allPosts);
    document.getElementById('postInput').value = '';
    renderFeed();
    updateStatsWidget();
  });

  function renderFeed() {
    const container = document.getElementById('feedContainer');
    const allPosts = posts();
    container.innerHTML = allPosts.map(p => renderPost(p)).join('');
    attachPostActions();
  }

  function renderPost(p) {
    const author = users()[p.author] || { username:'unknown', verified:false, premium:false };
    const isPremiumUser = author.premium;
    const nickClass = isPremiumUser ? 'premium-nick' : '';
    const verifiedIcon = author.verified ? '<span class="verified-badge">✔️</span>' : '';
    const textFormatted = p.text
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
          <div class="post-text">${textFormatted}</div>
          <div class="post-actions">
            <button class="like-btn">❤️ ${p.likes.length}</button>
            <button class="repost-btn">🔄 ${p.reposts.length}</button>
          </div>
        </div>
      </div>`;
  }

  function attachPostActions() {
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        if (!currentUser) return alert('Войдите, чтобы ставить лайки');
        const postId = Number(this.closest('.post').dataset.id);
        const allPosts = posts();
        const post = allPosts.find(p => p.id === postId);
        if (!post) return;
        if (!post.likes.includes(currentUser)) {
          post.likes.push(currentUser);
        } else {
          post.likes = post.likes.filter(u => u !== currentUser);
        }
        savePosts(allPosts);
        renderFeed();
      });
    });
    document.querySelectorAll('.repost-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        if (!currentUser) return alert('Войдите, чтобы делать репосты');
        const postId = Number(this.closest('.post').dataset.id);
        const allPosts = posts();
        const post = allPosts.find(p => p.id === postId);
        if (!post) return;
        if (!post.reposts.includes(currentUser)) {
          post.reposts.push(currentUser);
          savePosts(allPosts);
          renderFeed();
        }
      });
    });
  }

  function renderProfile() {
    if (!currentUser) return;
    const profileNameEl = document.getElementById('profileName');
    const u = users()[currentUser];
    if (u?.premium) {
      profileNameEl.classList.add('premium-nick');
    } else {
      profileNameEl.classList.remove('premium-nick');
    }
    profileNameEl.textContent = currentUser;
    document.getElementById('profileStatus').textContent = (u?.verified ? '✅ Верифицирован' : '') + (u?.premium ? ' 💎 НБСС+' : '');
    const profilePostsDiv = document.getElementById('profilePosts');
    const userPosts = posts().filter(p => p.author === currentUser);
    profilePostsDiv.innerHTML = userPosts.map(p => renderPost(p)).join('') || '<p style="padding:20px;">Нет постов</p>';
    attachPostActions();
  }

  function renderEvents() {
    const list = document.getElementById('eventsList');
    const evs = events();
    list.innerHTML = evs.length ? evs.map(e => `<div class="event-banner"><strong>${e.title}</strong><p>${e.desc}</p></div>`).join('') : '<p>Нет активных ивентов</p>';
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
    const allUsers = users();
    select.innerHTML = Object.keys(allUsers).map(u => `<option value="${u}">${u} ${allUsers[u].admin?'(админ)':''} ${allUsers[u].verified?'✔️':''} ${allUsers[u].premium?'💎':''}</option>`).join('');
    updateAdminStats();
  }

  // Обработчики админских кнопок
  document.getElementById('verifyUserBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    const all = users();
    if (all[sel]) { all[sel].verified = true; saveUsers(all); renderAdminPanel(); }
  });
  document.getElementById('unverifyUserBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    const all = users();
    if (all[sel]) { all[sel].verified = false; saveUsers(all); renderAdminPanel(); }
  });
  document.getElementById('makeAdminBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    const all = users();
    if (all[sel]) { all[sel].admin = true; saveUsers(all); renderAdminPanel(); }
  });
  document.getElementById('revokeAdminBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    if (sel === 'MrSigma') return alert('Нельзя лишить админки главного администратора');
    const all = users();
    if (all[sel]) { all[sel].admin = false; saveUsers(all); renderAdminPanel(); }
  });
  document.getElementById('givePremiumBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    const all = users();
    if (all[sel]) { all[sel].premium = true; saveUsers(all); renderAdminPanel(); alert(`Подписка НБСС+ выдана ${sel}`); }
  });
  document.getElementById('revokePremiumBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    const all = users();
    if (all[sel]) { all[sel].premium = false; saveUsers(all); renderAdminPanel(); alert(`Подписка НБСС+ отобрана у ${sel}`); }
  });
  document.getElementById('deleteUserBtn').addEventListener('click', () => {
    if (!isAdmin()) return;
    const sel = document.getElementById('userSelect').value;
    if (sel === 'MrSigma') return alert('Нельзя удалить главного админа');
    if (confirm(`Удалить ${sel}?`)) {
      const all = users();
      delete all[sel];
      saveUsers(all);
      renderAdminPanel();
    }
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
    const online = Math.floor(Math.random() * 5) + 1;
    document.getElementById('onlineStat').textContent = online;
    if (pages.admin.classList.contains('active')) {
      updateAdminStats();
    }
  }
  setInterval(updateStatsWidget, 10000);

  updateUIForAuth();
  showPage('home');
  updateStatsWidget();
})();
