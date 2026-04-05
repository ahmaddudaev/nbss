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
            avatar: null,
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
            text: 'Добро пожаловать в нбсс! 🇷🇺 Быстрая социальная сеть с фото, лайками и комментариями.',
            image: null,
            likes: [],
            comments: [],
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

function getAvatarUrl(user) {
    if (user && user.avatar) return user.avatar;
    return 'https://ui-avatars.com/api/?background=2563eb&color=fff&rounded=true&size=40&name=' + (user ? user.username.charAt(0) : '?');
}

// ==================== ЛАЙКИ И КОММЕНТАРИИ ====================
function toggleLike(postId) {
    if (!currentUser) { showToast('Войдите, чтобы ставить лайки', 'error'); return; }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const likedIndex = post.likes.indexOf(currentUser.id);
    if (likedIndex === -1) {
        post.likes.push(currentUser.id);
    } else {
        post.likes.splice(likedIndex, 1);
    }
    savePosts();
    renderFeed();
    if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
}

function openCommentsModal(postId) {
    if (!currentUser) { showToast('Войдите, чтобы комментировать', 'error'); return; }
    window.currentCommentPostId = postId;
    renderCommentsList(postId);
    openModal('commentsModal');
}

function renderCommentsList(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const container = document.getElementById('commentsList');
    if (!post.comments || post.comments.length === 0) {
        container.innerHTML = '<div class="loading-spinner">Нет комментариев. Будьте первым!</div>';
        return;
    }
    container.innerHTML = post.comments.map(comment => {
        const commentUser = users.find(u => u.id === comment.userId);
        const avatar = getAvatarUrl(commentUser);
        return `
            <div class="comment-item">
                <img class="comment-avatar" src="${avatar}" alt="avatar">
                <div class="comment-content">
                    <div class="comment-author">@${escapeHtml(comment.username)}</div>
                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                    <div class="comment-date">${formatDate(comment.createdAt)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function addComment(postId, text) {
    if (!currentUser) return;
    if (!text.trim()) { showToast('Введите текст комментария', 'error'); return; }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const newComment = {
        id: Date.now().toString(),
        userId: currentUser.id,
        username: currentUser.username,
        text: text.trim(),
        createdAt: new Date().toISOString()
    };
    if (!post.comments) post.comments = [];
    post.comments.push(newComment);
    savePosts();
    renderCommentsList(postId);
    document.getElementById('commentText').value = '';
    renderFeed(); // обновить счетчик комментариев в ленте
}

// ==================== ПОСТЫ С ФОТО ====================
let currentPostImageBase64 = null;

document.getElementById('postImageInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            currentPostImageBase64 = ev.target.result;
            const preview = document.getElementById('postImagePreview');
            const img = document.getElementById('previewImg');
            img.src = currentPostImageBase64;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});
document.getElementById('removeImageBtn').addEventListener('click', () => {
    currentPostImageBase64 = null;
    document.getElementById('postImagePreview').style.display = 'none';
    document.getElementById('postImageInput').value = '';
});

function createPost(text, imageBase64) {
    if (!currentUser) { showToast('Необходимо войти', 'error'); return; }
    if (!text.trim() && !imageBase64) { showToast('Напишите текст или добавьте фото', 'error'); return; }
    if (text.length > 280) { showToast('Максимум 280 символов', 'error'); return; }
    const newPost = {
        id: Date.now().toString(),
        userId: currentUser.id,
        username: currentUser.username,
        text: text.trim(),
        image: imageBase64 || null,
        likes: [],
        comments: [],
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
    currentPostImageBase64 = null;
    document.getElementById('postImagePreview').style.display = 'none';
    document.getElementById('postImageInput').value = '';
    showToast('Пост опубликован!');
    if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
}

function renderFeed() {
    const feedContainer = document.getElementById('feed');
    if (!feedContainer) return;
    if (posts.length === 0) {
        feedContainer.innerHTML = '<div class="loading-spinner">Пока нет постов. Будьте первым!</div>';
        return;
    }
    const sortedPosts = [...posts].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    feedContainer.innerHTML = sortedPosts.map(post => {
        const author = users.find(u => u.id === post.userId);
        const avatar = getAvatarUrl(author);
        const isLiked = currentUser && post.likes.includes(currentUser.id);
        const likeCount = post.likes.length;
        const commentCount = post.comments ? post.comments.length : 0;
        return `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-header-left">
                        <img class="post-avatar" src="${avatar}" alt="avatar">
                        <div class="post-author-info">
                            <span class="post-author">@${escapeHtml(post.username)}</span>
                            <span class="post-date">${formatDate(post.createdAt)}</span>
                        </div>
                    </div>
                    <div class="post-actions">
                        ${ (currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')) ? 
                            `<button class="delete-post" data-id="${post.id}"><i class="fas fa-trash-alt"></i></button>` : '' }
                    </div>
                </div>
                <div class="post-text">${escapeHtml(post.text)}</div>
                ${post.image ? `<div class="post-image"><img src="${post.image}" alt="post image"></div>` : ''}
                <div class="post-stats">
                    <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${post.id}"><i class="fas fa-heart"></i> ${likeCount}</button>
                    <button class="comment-btn" data-id="${post.id}"><i class="fas fa-comment"></i> ${commentCount}</button>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.delete-post').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePostById(btn.dataset.id);
        });
    });
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike(btn.dataset.id);
        });
    });
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCommentsModal(btn.dataset.id);
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

// ==================== АВАТАРКИ ПОЛЬЗОВАТЕЛЕЙ ====================
function updateHeaderAvatar() {
    const headerAvatar = document.getElementById('headerAvatar');
    if (currentUser && headerAvatar) {
        headerAvatar.src = getAvatarUrl(currentUser);
    }
}

function openProfileSettings() {
    if (!currentUser) return;
    document.getElementById('profileUsername').value = currentUser.username;
    document.getElementById('profileEmail').value = currentUser.email;
    document.getElementById('profilePassword').value = '';
    document.getElementById('profileAvatarPreview').src = getAvatarUrl(currentUser);
    openModal('profileModal');
}

document.getElementById('profileAvatarInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            document.getElementById('profileAvatarPreview').src = ev.target.result;
            window.tempAvatarBase64 = ev.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function saveProfileSettings(newUsername, newEmail, newPassword, newAvatarBase64) {
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
    if (newAvatarBase64) currentUser.avatar = newAvatarBase64;
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
        updateHeaderAvatar();
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
        avatar: null,
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

// ==================== АДМИН ПАНЕЛЬ (с аватарами) ====================
function renderAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') return;
    updatePostCounts();
    const tbody = document.querySelector('#adminUsersTable tbody');
    if (tbody) {
        tbody.innerHTML = users.map(user => {
            const lastLoginF = user.lastLogin ? formatDate(user.lastLogin) : '—';
            const lastActiveF = user.lastActive ? formatDate(user.lastActive) : '—';
            const avatarHtml = `<img src="${getAvatarUrl(user)}" style="width:32px; height:32px; border-radius:50%;">`;
            return `<tr>
                <td>${avatarHtml}</td>
                <td>@${escapeHtml(user.username)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>${user.role === 'admin' ? '👑 Админ' : '👤 Пользователь'}</td>
                <td>${user.postCount || 0}</td>
                <td>${lastLoginF}</td>
                <td>${lastActiveF}</td>
                <td><button class="edit-user-btn" data-id="${user.id}" style="background:#2563eb;color:white;border:none;border-radius:1rem;padding:0.2rem 0.6rem;margin-right:0.3rem;">✏️ Ред.</button>${user.role !== 'admin' ? `<button class="delete-user-btn" data-id="${user.id}" style="background:#dc2626;color:white;border:none;border-radius:1rem;padding:0.2rem 0.6rem;">Удалить</button>` : ''}</td>
            </tr>`;
        }).join('');
        document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', () => { if(confirm('Удалить пользователя и все его посты?')) deleteUserById(btn.dataset.id); }));
        document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', () => openAdminEditUser(btn.dataset.id)));
    }
    const postsTbody = document.querySelector('#adminPostsTable tbody');
    if (postsTbody) {
        const sorted = [...posts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        postsTbody.innerHTML = sorted.map(post => `
            <tr>
                <td>${post.id.slice(-5)}</td>
                <td>@${escapeHtml(post.username)}</td>
                <td style="max-width:200px; word-break:break-word;">${escapeHtml(post.text)}</td>
                <td>${post.image ? '<i class="fas fa-image"></i>' : '-'}</td>
                <td>${post.likes.length}</td>
                <td>${post.comments ? post.comments.length : 0}</td>
                <td>${formatDate(post.createdAt)}</td>
                <td><button class="delete-post-admin" data-id="${post.id}" style="background:#dc2626;color:white;border:none;border-radius:1rem;padding:0.2rem 0.6rem;"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
        document.querySelectorAll('.delete-post-admin').forEach(btn => btn.addEventListener('click', () => { if(confirm('Удалить пост?')) deletePostById(btn.dataset.id); }));
    }
}

function deleteUserById(userId) {
    users = users.filter(u => u.id !== userId);
    posts = posts.filter(p => p.userId !== userId);
    saveUsers(); savePosts();
    if (currentUser && currentUser.id === userId) logout();
    renderAdminPanel();
    renderFeed();
    showToast('Пользователь удалён');
}

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
    if (newUsername !== user.username && users.find(u => u.username === newUsername)) { showToast('Имя занято', 'error'); return; }
    if (newEmail !== user.email && users.find(u => u.email === newEmail)) { showToast('Email занят', 'error'); return; }
    user.username = newUsername;
    user.email = newEmail;
    if (newPassword) user.password = newPassword;
    user.role = newRole;
    saveUsers();
    posts.forEach(post => { if (post.userId === user.id) post.username = newUsername; });
    savePosts();
    if (currentUser && currentUser.id === userId) { currentUser = user; localStorage.setItem(STORAGE_CURRENT, currentUser.id); updateUIByAuth(); }
    renderFeed();
    renderAdminPanel();
    closeModal('adminEditUserModal');
    showToast(`Пользователь @${newUsername} обновлён`);
}

// ==================== МОДАЛЬНЫЕ ОКНА, ТЕМА, ЗАПУСК ====================
function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

function initTheme() {
    const savedTheme = localStorage.getItem('nbss_theme');
    if (savedTheme === 'dark') { document.body.classList.add('dark'); document.querySelector('#themeToggle i').className = 'fas fa-sun'; }
    else { document.body.classList.remove('dark'); document.querySelector('#themeToggle i').className = 'fas fa-moon'; }
}
function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('nbss_theme', isDark ? 'dark' : 'light');
    const icon = document.querySelector('#themeToggle i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

function bindEvents() {
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => { const modal = btn.closest('.modal'); if(modal) modal.style.display = 'none'; }));
    window.addEventListener('click', (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; });
    document.getElementById('loginForm').addEventListener('submit', (e) => { e.preventDefault(); login(document.getElementById('loginUsername').value.trim(), document.getElementById('loginPassword').value); });
    document.getElementById('registerForm').addEventListener('submit', (e) => { e.preventDefault(); if(register(document.getElementById('regUsername').value.trim(), document.getElementById('regEmail').value.trim(), document.getElementById('regPassword').value)) { closeModal('registerModal'); openModal('loginModal'); } });
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('submitPostBtn').addEventListener('click', () => createPost(document.getElementById('postText').value, currentPostImageBase64));
    document.getElementById('postText').addEventListener('input', () => { document.getElementById('charCounter').innerText = `${document.getElementById('postText').value.length}/280`; });
    document.getElementById('adminPanelBtn').addEventListener('click', () => { if(currentUser && currentUser.role === 'admin') { renderAdminPanel(); openModal('adminModal'); } else showToast('Доступ только для администратора', 'error'); });
    document.getElementById('profileSettingsBtn').addEventListener('click', openProfileSettings);
    document.getElementById('profileForm').addEventListener('submit', (e) => { e.preventDefault(); saveProfileSettings(document.getElementById('profileUsername').value.trim(), document.getElementById('profileEmail').value.trim(), document.getElementById('profilePassword').value, window.tempAvatarBase64 || null); window.tempAvatarBase64 = null; });
    document.getElementById('adminEditUserForm').addEventListener('submit', (e) => { e.preventDefault(); saveAdminEditUser(); });
    document.getElementById('submitCommentBtn').addEventListener('click', () => { if(window.currentCommentPostId) addComment(window.currentCommentPostId, document.getElementById('commentText').value); });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => { const tabId = btn.dataset.tab; document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active')); if(tabId === 'users') document.getElementById('adminUsersTab').classList.add('active'); else document.getElementById('adminPostsTab').classList.add('active'); }));
}

function startApp() { initData(); bindEvents(); updateUIByAuth(); initTheme(); if(currentUser) updateLastActive(currentUser.id); }
startApp();
