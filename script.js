// ==================== DATA MODELS ====================
let currentUser = null;
let users = [];
let posts = [];

const STORAGE_USERS = 'nbss_users';
const STORAGE_POSTS = 'nbss_posts';
const STORAGE_CURRENT = 'nbss_currentUser';

function initData() {
    const storedUsers = localStorage.getItem(STORAGE_USERS);
    const storedPosts = localStorage.getItem(STORAGE_POSTS);
    
    if (storedUsers) {
        users = JSON.parse(storedUsers);
    } else {
        const now = new Date().toISOString();
        users = [{
            id: '1',
            username: 'MrSigma',
            email: 'sigma@nbss.ru',
            password: 'Mrbeast132!',
            role: 'admin',
            createdAt: now,
            lastLogin: now,
            lastActive: now,
            postCount: 0
        }];
        saveUsers();
    }
    
    if (storedPosts) {
        posts = JSON.parse(storedPosts);
    } else {
        posts = [{
            id: Date.now().toString() + '1',
            userId: '1',
            username: 'MrSigma',
            text: 'Добро пожаловать в нбсс! 🇷🇺 Быстрая социальная сеть для каждого. Регистрируйтесь и делитесь мыслями.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }];
        savePosts();
    }
    
    const savedUserId = localStorage.getItem(STORAGE_CURRENT);
    if (savedUserId) {
        currentUser = users.find(u => u.id === savedUserId);
        if (currentUser) {
            updateLastActive(currentUser.id);
        } else {
            localStorage.removeItem(STORAGE_CURRENT);
        }
    }
}

function saveUsers() { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
function savePosts() { localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts)); }

function updateLastActive(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.lastActive = new Date().toISOString();
        saveUsers();
        if (currentUser && currentUser.id === userId) currentUser.lastActive = user.lastActive;
        if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
    }
}

function updatePostCounts() {
    users.forEach(user => { user.postCount = posts.filter(p => p.userId === user.id).length; });
    saveUsers();
}

// ==================== UI HELPERS ====================
function renderFeed() {
    const feedContainer = document.getElementById('feed');
    if (!feedContainer) return;
    if (posts.length === 0) {
        feedContainer.innerHTML = '<div class="loading-spinner">Пока нет постов. Будьте первым!</div>';
        return;
    }
    const sortedPosts = [...posts].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    feedContainer.innerHTML = sortedPosts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <span class="post-author">@${escapeHtml(post.username)}</span>
                <span class="post-date">${formatDate(post.createdAt)}</span>
            </div>
            <div class="post-text">${escapeHtml(post.text)}</div>
            <div class="post-actions">
                ${ (currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')) ? 
                    `<button class="delete-post" data-id="${post.id}"><i class="fas fa-trash-alt"></i> Удалить</button>` : '' }
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.delete-post').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePostById(btn.dataset.id);
        });
    });
}

function deletePostById(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')) {
        posts = posts.filter(p => p.id !== postId);
        savePosts();
        updatePostCounts();
        renderFeed();
        if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
        showToast('Пост удалён', 'info');
    } else showToast('Нет прав для удаления', 'error');
}

function formatDate(iso) {
    const date = new Date(iso);
    return date.toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'error' ? '#dc2626' : '#2563eb';
    toast.style.color = 'white';
    toast.style.padding = '8px 20px';
    toast.style.borderRadius = '40px';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '0.9rem';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ==================== АВТОРИЗАЦИЯ ====================
function updateUIByAuth() {
    const authDiv = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const greetingSpan = document.getElementById('userGreeting');
    const postForm = document.getElementById('postFormContainer');
    const adminBtn = document.getElementById('adminPanelBtn');
    if (currentUser) {
        authDiv.classList.add('hidden');
        userMenu.classList.remove('hidden');
        greetingSpan.textContent = `@${currentUser.username}`;
        postForm.classList.remove('hidden');
        if (currentUser.role === 'admin') adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
    } else {
        authDiv.classList.remove('hidden');
        userMenu.classList.add('hidden');
        postForm.classList.add('hidden');
    }
    renderFeed();
}

function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        user.lastLogin = new Date().toISOString();
        user.lastActive = user.lastLogin;
        saveUsers();
        localStorage.setItem(STORAGE_CURRENT, user.id);
        updateUIByAuth();
        closeAllModals();
        showToast(`Добро пожаловать, ${user.username}!`);
        renderFeed();
    } else showToast('Неверное имя пользователя или пароль', 'error');
}

function register(username, email, password) {
    if (users.find(u => u.username === username)) { showToast('Имя пользователя уже занято', 'error'); return false; }
    if (users.find(u => u.email === email)) { showToast('Email уже используется', 'error'); return false; }
    const now = new Date().toISOString();
    const newUser = {
        id: Date.now().toString(),
        username, email, password,
        role: 'user',
        createdAt: now, lastLogin: now, lastActive: now, postCount: 0
    };
    users.push(newUser);
    saveUsers();
    showToast('Регистрация успешна! Теперь войдите.');
    return true;
}

function logout() {
    currentUser = null;
    localStorage.removeItem(STORAGE_CURRENT);
    updateUIByAuth();
    showToast('Вы вышли из аккаунта');
}

// ==================== НАСТРОЙКИ ПРОФИЛЯ (для себя) ====================
function openProfileSettings() {
    if (!currentUser) return;
    document.getElementById('profileUsername').value = currentUser.username;
    document.getElementById('profileEmail').value = currentUser.email;
    document.getElementById('profilePassword').value = '';
    openModal('profileModal');
}

function saveProfileSettings(newUsername, newEmail, newPassword) {
    if (!currentUser) return;
    if (newUsername !== currentUser.username && users.find(u => u.username === newUsername)) {
        showToast('Имя пользователя уже занято', 'error');
        return false;
    }
    if (newEmail !== currentUser.email && users.find(u => u.email === newEmail)) {
        showToast('Email уже используется', 'error');
        return false;
    }
    if (newUsername.trim() === '') { showToast('Имя не может быть пустым', 'error'); return false; }
    const oldUsername = currentUser.username;
    currentUser.username = newUsername;
    currentUser.email = newEmail;
    if (newPassword && newPassword.length > 0) currentUser.password = newPassword;
    const index = users.findIndex(u => u.id === currentUser.id);
    if (index !== -1) users[index] = currentUser;
    saveUsers();
    posts.forEach(post => {
        if (post.userId === currentUser.id) post.username = currentUser.username;
    });
    savePosts();
    updateUIByAuth();
    renderFeed();
    if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
    showToast('Профиль обновлён');
    closeModal('profileModal');
    return true;
}

// ==================== АДМИН: РЕДАКТИРОВАНИЕ ЛЮБОГО ПОЛЬЗОВАТЕЛЯ ====================
function openAdminEditUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    document.getElementById('adminEditUserId').value = user.id;
    document.getElementById('adminEditUsername').value = user.username;
    document.getElementById('adminEditEmail').value = user.email;
    document.getElementById('adminEditPassword').value = '';
    document.getElementById('adminEditRole').value = user.role;
    openModal('adminEditUserModal');
}

function saveAdminEditUser() {
    const userId = document.getElementById('adminEditUserId').value;
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newUsername = document.getElementById('adminEditUsername').value.trim();
    const newEmail = document.getElementById('adminEditEmail').value.trim();
    const newPassword = document.getElementById('adminEditPassword').value;
    const newRole = document.getElementById('adminEditRole').value;
    
    if (newUsername === '') { showToast('Имя не может быть пустым', 'error'); return; }
    if (newUsername !== user.username && users.find(u => u.username === newUsername)) {
        showToast('Имя пользователя уже занято', 'error');
        return;
    }
    if (newEmail !== user.email && users.find(u => u.email === newEmail)) {
        showToast('Email уже используется', 'error');
        return;
    }
    
    const oldUsername = user.username;
    user.username = newUsername;
    user.email = newEmail;
    if (newPassword && newPassword.length > 0) user.password = newPassword;
    user.role = newRole;
    saveUsers();
    
    // Обновить username в постах, если изменился
    if (oldUsername !== newUsername) {
        posts.forEach(post => {
            if (post.userId === user.id) post.username = newUsername;
        });
        savePosts();
    }
    
    // Если отредактировали текущего пользователя (админ редактирует себя)
    if (currentUser && currentUser.id === userId) {
        currentUser = user;
        localStorage.setItem(STORAGE_CURRENT, currentUser.id);
        updateUIByAuth();
    }
    
    renderFeed();
    if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
    closeModal('adminEditUserModal');
    showToast(`Пользователь @${newUsername} обновлён`);
}

// ==================== ПОСТЫ ====================
function createPost(text) {
    if (!currentUser) { showToast('Необходимо войти', 'error'); return; }
    if (!text.trim()) { showToast('Текст поста не может быть пустым', 'error'); return; }
    if (text.length > 280) { showToast('Максимум 280 символов', 'error'); return; }
    const newPost = {
        id: Date.now().toString(),
        userId: currentUser.id,
        username: currentUser.username,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    posts.unshift(newPost);
    savePosts();
    updatePostCounts();
    updateLastActive(currentUser.id);
    renderFeed();
    document.getElementById('postText').value = '';
    document.getElementById('charCounter').innerText = '0/280';
    showToast('Пост опубликован!');
    if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
}

// ==================== АДМИН ПАНЕЛЬ (с кнопкой редактирования) ====================
function renderAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') return;
    updatePostCounts();
    const tbody = document.querySelector('#adminUsersTable tbody');
    if (tbody) {
        tbody.innerHTML = users.map(user => {
            const lastLoginF = user.lastLogin ? formatDate(user.lastLogin) : '—';
            const lastActiveF = user.lastActive ? formatDate(user.lastActive) : '—';
            const canDelete = user.role !== 'admin' ? `<button class="delete-user-btn" data-id="${user.id}">Удалить</button>` : '—';
            return `
                <tr>
                    <td>${user.id.slice(-5)}</td>
                    <td>@${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${user.role === 'admin' ? '👑 Админ' : '👤 Пользователь'}</td>
                    <td>${user.postCount || 0}</td>
                    <td>${lastLoginF}</td>
                    <td>${lastActiveF}</td>
                    <td>
                        <button class="edit-user-btn" data-id="${user.id}" style="background:#2563eb; color:white; border:none; border-radius:1rem; padding:0.2rem 0.6rem; margin-right:0.3rem; cursor:pointer;">✏️ Ред.</button>
                        ${canDelete}
                    </td>
                </tr>
            `;
        }).join('');
        // Кнопки удаления
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = btn.dataset.id;
                if (confirm('Удалить пользователя и все его посты?')) {
                    users = users.filter(u => u.id !== userId);
                    posts = posts.filter(p => p.userId !== userId);
                    saveUsers(); savePosts();
                    if (currentUser && currentUser.id === userId) logout();
                    renderAdminPanel();
                    renderFeed();
                    showToast('Пользователь удалён');
                }
            });
        });
        // Кнопки редактирования
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = btn.dataset.id;
                openAdminEditUser(userId);
            });
        });
    }
    const postsTbody = document.querySelector('#adminPostsTable tbody');
    if (postsTbody) {
        const sorted = [...posts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        postsTbody.innerHTML = sorted.map(post => `
            <tr>
                <td>${post.id.slice(-5)}</td>
                <td>@${escapeHtml(post.username)}</td>
                <td style="max-width:300px; word-break:break-word;">${escapeHtml(post.text)}</td>
                <td>${formatDate(post.createdAt)}</td>
                <td><button class="delete-post-admin" data-id="${post.id}"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
        document.querySelectorAll('.delete-post-admin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = btn.dataset.id;
                if (confirm('Удалить этот пост?')) {
                    posts = posts.filter(p => p.id !== postId);
                    savePosts();
                    updatePostCounts();
                    renderFeed();
                    renderAdminPanel();
                    showToast('Пост удалён администратором');
                }
            });
        });
    }
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================
function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

// ==================== ТЕМА ====================
function initTheme() {
    const savedTheme = localStorage.getItem('nbss_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        document.querySelector('#themeToggle i').className = 'fas fa-sun';
    } else {
        document.body.classList.remove('dark');
        document.querySelector('#themeToggle i').className = 'fas fa-moon';
    }
}
function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('nbss_theme', isDark ? 'dark' : 'light');
    const icon = document.querySelector('#themeToggle i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

// ==================== EVENT LISTENERS ====================
function bindEvents() {
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => { const modal = btn.closest('.modal'); if(modal) modal.style.display = 'none'; });
    });
    window.addEventListener('click', (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; });
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        login(document.getElementById('loginUsername').value.trim(), document.getElementById('loginPassword').value);
    });
    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if(register(document.getElementById('regUsername').value.trim(), document.getElementById('regEmail').value.trim(), document.getElementById('regPassword').value)) {
            closeModal('registerModal');
            openModal('loginModal');
        }
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('submitPostBtn').addEventListener('click', () => createPost(document.getElementById('postText').value));
    document.getElementById('postText').addEventListener('input', () => {
        document.getElementById('charCounter').innerText = `${document.getElementById('postText').value.length}/280`;
    });
    document.getElementById('adminPanelBtn').addEventListener('click', () => {
        if(currentUser && currentUser.role === 'admin') { renderAdminPanel(); openModal('adminModal'); }
        else showToast('Доступ только для администратора', 'error');
    });
    document.getElementById('profileSettingsBtn').addEventListener('click', openProfileSettings);
    document.getElementById('profileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveProfileSettings(
            document.getElementById('profileUsername').value.trim(),
            document.getElementById('profileEmail').value.trim(),
            document.getElementById('profilePassword').value
        );
    });
    // Админское редактирование пользователя
    document.getElementById('adminEditUserForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveAdminEditUser();
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
            if(tabId === 'users') document.getElementById('adminUsersTab').classList.add('active');
            else document.getElementById('adminPostsTab').classList.add('active');
        });
    });
}

function startApp() {
    initData();
    bindEvents();
    updateUIByAuth();
    initTheme();
    if(currentUser) updateLastActive(currentUser.id);
}
startApp();
