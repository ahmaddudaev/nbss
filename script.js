// ---------- DATA ----------
let currentUser = null;
let users = [];
let posts = [];
let searchQuery = '';

const STORAGE_USERS = 'nbss_users';
const STORAGE_POSTS = 'nbss_posts';
const STORAGE_CURRENT = 'nbss_currentUser';

function initData() {
    const storedUsers = localStorage.getItem(STORAGE_USERS);
    const storedPosts = localStorage.getItem(STORAGE_POSTS);
    
    if (storedUsers) {
        users = JSON.parse(storedUsers);
        // Миграция: добавить поле verified и avatar если нет
        users = users.map(u => {
            if (u.verified === undefined) u.verified = (u.role === 'admin');
            if (u.avatar === undefined) u.avatar = null;
            return u;
        });
    } else {
        const now = new Date().toISOString();
        users = [{ 
            id: '1', username: 'MrSigma', email: 'sigma@nbss.ru', password: 'Mrbeast132!', 
            role: 'admin', avatar: null, verified: true, 
            createdAt: now, lastLogin: now, lastActive: now, postCount: 0 
        }];
    }
    saveUsers();
    
    if (storedPosts) {
        posts = JSON.parse(storedPosts);
        // Миграция: добавить likes и comments если нет
        posts = posts.map(p => {
            if (!p.likes) p.likes = [];
            if (!p.comments) p.comments = [];
            return p;
        });
    } else {
        posts = [{ 
            id: Date.now().toString() + '1', userId: '1', username: 'MrSigma', 
            text: 'Добро пожаловать в нбсс! 🇷🇺 Быстрая соцсеть с фото, лайками и комментариями. Администратор может выдавать галочку верификации ✅', 
            image: null, likes: [], comments: [], createdAt: new Date().toISOString() 
        }];
    }
    savePosts();
    
    const savedUserId = localStorage.getItem(STORAGE_CURRENT);
    if (savedUserId) {
        currentUser = users.find(u => u.id === savedUserId);
        if (currentUser) updateLastActive(currentUser.id);
        else localStorage.removeItem(STORAGE_CURRENT);
    }
}
function saveUsers() { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
function savePosts() { localStorage.setItem(STORAGE_POSTS, JSON.stringify(posts)); }
function updateLastActive(userId) {
    const user = users.find(u => u.id === userId);
    if (user) { user.lastActive = new Date().toISOString(); saveUsers(); if (currentUser && currentUser.id === userId) currentUser.lastActive = user.lastActive; if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel(); }
}
function updatePostCounts() { users.forEach(u => { u.postCount = posts.filter(p => p.userId === u.id).length; }); saveUsers(); }
function formatDate(iso) { return new Date(iso).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }
function showToast(msg, type='info') { const t = document.createElement('div'); t.innerText = msg; t.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:${type==='error'?'#dc2626':'#2563eb'};color:white;padding:8px 20px;border-radius:40px;z-index:9999;font-size:0.9rem;`; document.body.appendChild(t); setTimeout(()=>t.remove(),2500); }
function getAvatarUrl(user) { return user?.avatar || `https://ui-avatars.com/api/?background=2563eb&color=fff&rounded=true&size=40&name=${user?.username?.charAt(0)||'?'}`; }

// ---------- LIKES & COMMENTS ----------
function toggleLike(postId) {
    if (!currentUser) { showToast('Войдите, чтобы ставить лайки', 'error'); return; }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!post.likes) post.likes = [];
    const idx = post.likes.indexOf(currentUser.id);
    if (idx === -1) post.likes.push(currentUser.id);
    else post.likes.splice(idx, 1);
    savePosts(); renderFeed(); if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
}
let currentCommentPostId = null;
function openCommentsModal(postId) { if (!currentUser) { showToast('Войдите, чтобы комментировать', 'error'); return; } currentCommentPostId = postId; renderCommentsList(postId); openModal('commentsModal'); }
function renderCommentsList(postId) {
    const post = posts.find(p => p.id === postId);
    const container = document.getElementById('commentsList');
    if (!post?.comments?.length) { container.innerHTML = '<div class="loading-spinner">Нет комментариев. Будьте первым!</div>'; return; }
    container.innerHTML = post.comments.map(c => { const u = users.find(u=>u.id===c.userId); const av = getAvatarUrl(u); return `<div class="comment-item"><img class="comment-avatar" src="${av}"><div class="comment-content"><div class="comment-author">@${escapeHtml(c.username)}</div><div class="comment-text">${escapeHtml(c.text)}</div><div class="comment-date">${formatDate(c.createdAt)}</div></div></div>`; }).join('');
}
function addComment(postId, text) {
    if (!currentUser || !text.trim()) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const newComment = { id: Date.now().toString(), userId: currentUser.id, username: currentUser.username, text: text.trim(), createdAt: new Date().toISOString() };
    if (!post.comments) post.comments = [];
    post.comments.push(newComment);
    savePosts(); renderCommentsList(postId); document.getElementById('commentText').value = ''; renderFeed();
}

// ---------- POSTS WITH IMAGES ----------
let currentPostImageBase64 = null;
document.getElementById('postImageInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onload = ev => { currentPostImageBase64 = ev.target.result; document.getElementById('previewImg').src = currentPostImageBase64; document.getElementById('postImagePreview').style.display = 'block'; }; r.readAsDataURL(file); }
});
document.getElementById('removeImageBtn')?.addEventListener('click', () => { currentPostImageBase64 = null; document.getElementById('postImagePreview').style.display = 'none'; document.getElementById('postImageInput').value = ''; });
function createPost(text, image) {
    if (!currentUser) { showToast('Войдите', 'error'); return; }
    if (!text.trim() && !image) { showToast('Напишите текст или добавьте фото', 'error'); return; }
    if (text.length > 280) { showToast('Максимум 280 символов', 'error'); return; }
    const newPost = { id: Date.now().toString(), userId: currentUser.id, username: currentUser.username, text: text.trim(), image: image || null, likes: [], comments: [], createdAt: new Date().toISOString() };
    posts.unshift(newPost);
    savePosts(); updatePostCounts(); updateLastActive(currentUser.id); renderFeed();
    document.getElementById('postText').value = ''; document.getElementById('charCounter').innerText = '0/280'; currentPostImageBase64 = null; document.getElementById('postImagePreview').style.display = 'none'; document.getElementById('postImageInput').value = '';
    showToast('Пост опубликован!');
    if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
}
function deletePostById(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')) {
        posts = posts.filter(p => p.id !== postId);
        savePosts(); updatePostCounts(); renderFeed(); if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel(); showToast('Пост удалён');
    } else showToast('Нет прав', 'error');
}

// ---------- FILTER POSTS (SEARCH) ----------
function filterPostsBySearch() {
    if (!searchQuery.trim()) return posts;
    const query = searchQuery.toLowerCase();
    return posts.filter(post => 
        post.text.toLowerCase().includes(query) || 
        post.username.toLowerCase().includes(query)
    );
}
function renderFeed() {
    const feedDiv = document.getElementById('feed');
    if (!feedDiv) return;
    let filteredPosts = filterPostsBySearch();
    if (!filteredPosts.length) { feedDiv.innerHTML = '<div class="loading-spinner">Ничего не найдено 😔</div>'; return; }
    const sorted = [...filteredPosts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    feedDiv.innerHTML = sorted.map(post => {
        const author = users.find(u => u.id === post.userId);
        const avatar = getAvatarUrl(author);
        const isLiked = currentUser && post.likes && post.likes.includes(currentUser.id);
        const likeCount = post.likes ? post.likes.length : 0;
        const commentCount = post.comments ? post.comments.length : 0;
        const verified = author?.verified ? `<span class="verified-badge"><i class="fas fa-check-circle"></i> verified</span>` : '';
        return `<div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-header-left"><img class="post-avatar" src="${avatar}"><div class="post-author-info"><span class="post-author">@${escapeHtml(post.username)}${verified}</span><span class="post-date">${formatDate(post.createdAt)}</span></div></div>
                ${(currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')) ? `<button class="delete-post" data-id="${post.id}"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
            <div class="post-text">${escapeHtml(post.text)}</div>
            ${post.image ? `<div class="post-image"><img src="${post.image}"></div>` : ''}
            <div class="post-stats">
                <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${post.id}"><i class="fas fa-heart"></i> ${likeCount}</button>
                <button class="comment-btn" data-id="${post.id}"><i class="fas fa-comment"></i> ${commentCount}</button>
            </div>
        </div>`;
    }).join('');
    document.querySelectorAll('.delete-post').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); deletePostById(btn.dataset.id); }));
    document.querySelectorAll('.like-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); toggleLike(btn.dataset.id); }));
    document.querySelectorAll('.comment-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openCommentsModal(btn.dataset.id); }));
}

// ---------- PROFILE ----------
function updateHeaderAvatar() { if (currentUser) document.getElementById('headerAvatar').src = getAvatarUrl(currentUser); }
function openProfileSettings() { if (!currentUser) return; document.getElementById('profileUsername').value = currentUser.username; document.getElementById('profileEmail').value = currentUser.email; document.getElementById('profilePassword').value = ''; document.getElementById('profileAvatarPreview').src = getAvatarUrl(currentUser); openModal('profileModal'); }
let tempAvatarBase64 = null;
document.getElementById('profileAvatarInput')?.addEventListener('change', e => { const f = e.target.files[0]; if(f){ const r=new FileReader(); r.onload=ev=>{ document.getElementById('profileAvatarPreview').src=ev.target.result; tempAvatarBase64=ev.target.result; }; r.readAsDataURL(f); } });
function saveProfileSettings(newName, newEmail, newPass, newAvatar) {
    if (!currentUser) return;
    if (newName !== currentUser.username && users.find(u=>u.username===newName)) { showToast('Имя занято','error'); return false; }
    if (newEmail !== currentUser.email && users.find(u=>u.email===newEmail)) { showToast('Email занят','error'); return false; }
    if (!newName.trim()) { showToast('Имя не может быть пустым','error'); return false; }
    currentUser.username = newName; currentUser.email = newEmail; if (newPass) currentUser.password = newPass; if (newAvatar) currentUser.avatar = newAvatar;
    const idx = users.findIndex(u=>u.id===currentUser.id); if(idx!==-1) users[idx]=currentUser;
    saveUsers();
    posts.forEach(p=>{ if(p.userId===currentUser.id) p.username=currentUser.username; });
    savePosts();
    updateUIByAuth(); renderFeed(); if (document.getElementById('adminModal').style.display === 'flex') renderAdminPanel();
    showToast('Профиль обновлён'); closeModal('profileModal'); return true;
}

// ---------- AUTH ----------
function updateUIByAuth() {
    const authDiv = document.getElementById('authButtons'), userMenu = document.getElementById('userMenu'), postForm = document.getElementById('postFormContainer'), adminBtn = document.getElementById('adminPanelBtn');
    if (currentUser) {
        if(authDiv) authDiv.classList.add('hidden');
        if(userMenu) userMenu.classList.remove('hidden');
        const greeting = document.getElementById('userGreeting');
        if(greeting) greeting.textContent = `@${currentUser.username}`;
        if(postForm) postForm.classList.remove('hidden');
        updateHeaderAvatar();
        if (adminBtn) {
            if (currentUser.role === 'admin') adminBtn.classList.remove('hidden');
            else adminBtn.classList.add('hidden');
        }
    } else { 
        if(authDiv) authDiv.classList.remove('hidden');
        if(userMenu) userMenu.classList.add('hidden');
        if(postForm) postForm.classList.add('hidden');
    }
    renderFeed();
}
function login(username, password) {
    const user = users.find(u=>u.username===username && u.password===password);
    if (user) { currentUser = user; user.lastLogin = new Date().toISOString(); user.lastActive = user.lastLogin; saveUsers(); localStorage.setItem(STORAGE_CURRENT, user.id); updateUIByAuth(); closeAllModals(); showToast(`Добро пожаловать, ${user.username}!`); renderFeed(); }
    else showToast('Неверные данные', 'error');
}
function register(username, email, password) {
    if (users.find(u=>u.username===username)) { showToast('Имя занято','error'); return false; }
    if (users.find(u=>u.email===email)) { showToast('Email занят','error'); return false; }
    const now = new Date().toISOString();
    users.push({ id: Date.now().toString(), username, email, password, role: 'user', verified: false, avatar: null, createdAt: now, lastLogin: now, lastActive: now, postCount: 0 });
    saveUsers(); showToast('Регистрация успешна! Войдите.'); return true;
}
function logout() { currentUser = null; localStorage.removeItem(STORAGE_CURRENT); updateUIByAuth(); showToast('Вы вышли'); }

// ---------- ADMIN PANEL (with verification) ----------
function renderAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') return;
    updatePostCounts();
    const tbody = document.querySelector('#adminUsersTable tbody');
    if (tbody) {
        tbody.innerHTML = users.map(u => `<td>
            <td><img src="${getAvatarUrl(u)}" style="width:32px;height:32px;border-radius:50%;"></td>
            <td>@${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.role==='admin'?'👑 Админ':'👤 Пользователь'}</td>
            <td>${u.verified ? '<i class="fas fa-check-circle" style="color:#3b82f6;"></i> Да' : '<i class="fas fa-times-circle" style="color:#9ca3af;"></i> Нет'}</td>
            <td>${u.postCount||0}</td>
            <td>${u.lastLogin?formatDate(u.lastLogin):'—'}</td>
            <td>${u.lastActive?formatDate(u.lastActive):'—'}</td>
            <td>
                <button class="edit-user-btn" data-id="${u.id}">✏️ Ред.</button>
                ${u.role !== 'admin' ? `<button class="verify-user-btn" data-id="${u.id}">${u.verified ? '❌ Снять' : '✅ Вериф.'}</button>` : ''}
                ${u.role !== 'admin' ? `<button class="delete-user-btn" data-id="${u.id}">Удалить</button>` : ''}
              </td>
         `).join('');
        document.querySelectorAll('.delete-user-btn').forEach(btn=>btn.addEventListener('click',()=>{ if(confirm('Удалить пользователя и все его посты?')) deleteUserById(btn.dataset.id); }));
        document.querySelectorAll('.edit-user-btn').forEach(btn=>btn.addEventListener('click',()=>openAdminEditUser(btn.dataset.id)));
        document.querySelectorAll('.verify-user-btn').forEach(btn=>btn.addEventListener('click',()=>toggleUserVerification(btn.dataset.id)));
    }
    const postsTbody = document.querySelector('#adminPostsTable tbody');
    if (postsTbody) {
        const sorted = [...posts].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        postsTbody.innerHTML = sorted.map(p => `<tr>
            <td>${p.id.slice(-5)}</td>
            <td>@${escapeHtml(p.username)}</td>
            <td style="max-width:200px;">${escapeHtml(p.text)}</td>
            <td>${p.image?'📷':'-'}</td>
            <td>${p.likes ? p.likes.length : 0}</td>
            <td>${p.comments ? p.comments.length : 0}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td><button class="delete-post-admin" data-id="${p.id}"><i class="fas fa-trash"></i></button></td>
         `).join('');
        document.querySelectorAll('.delete-post-admin').forEach(btn=>btn.addEventListener('click',()=>{ if(confirm('Удалить пост?')) deletePostById(btn.dataset.id); }));
    }
}
function toggleUserVerification(userId) {
    const user = users.find(u => u.id === userId);
    if (user && user.role !== 'admin') {
        user.verified = !user.verified;
        saveUsers();
        renderAdminPanel();
        renderFeed();
        showToast(`Пользователь @${user.username} ${user.verified ? 'верифицирован' : 'лишён верификации'}`);
    }
}
function deleteUserById(id) { users = users.filter(u=>u.id!==id); posts = posts.filter(p=>p.userId!==id); saveUsers(); savePosts(); if (currentUser && currentUser.id===id) logout(); renderAdminPanel(); renderFeed(); showToast('Пользователь удалён'); }
function openAdminEditUser(userId) { const u=users.find(u=>u.id===userId); if(!u) return; document.getElementById('adminEditUserId').value=u.id; document.getElementById('adminEditUsername').value=u.username; document.getElementById('adminEditEmail').value=u.email; document.getElementById('adminEditPassword').value=''; document.getElementById('adminEditRole').value=u.role; openModal('adminEditUserModal'); }
function saveAdminEditUser() {
    const id = document.getElementById('adminEditUserId').value, u = users.find(u=>u.id===id); if(!u) return;
    const newName = document.getElementById('adminEditUsername').value.trim(), newEmail = document.getElementById('adminEditEmail').value.trim(), newPass = document.getElementById('adminEditPassword').value, newRole = document.getElementById('adminEditRole').value;
    if(!newName) { showToast('Имя не пустое','error'); return; }
    if(newName!==u.username && users.find(u=>u.username===newName)) { showToast('Имя занято','error'); return; }
    if(newEmail!==u.email && users.find(u=>u.email===newEmail)) { showToast('Email занят','error'); return; }
    u.username = newName; u.email = newEmail; if(newPass) u.password = newPass; u.role = newRole;
    saveUsers();
    posts.forEach(p=>{ if(p.userId===u.id) p.username = newName; });
    savePosts();
    if(currentUser && currentUser.id===id) { currentUser = u; localStorage.setItem(STORAGE_CURRENT, currentUser.id); updateUIByAuth(); }
    renderFeed(); renderAdminPanel(); closeModal('adminEditUserModal'); showToast(`Пользователь @${newName} обновлён`);
}

// ---------- THEME ----------
function initTheme() {
    try {
        const saved = localStorage.getItem('nbss_theme');
        if (saved === 'dark') {
            document.body.classList.add('dark');
            const icon = document.querySelector('#themeToggle i');
            if (icon) icon.className = 'fas fa-sun';
        } else {
            document.body.classList.remove('dark');
            const icon = document.querySelector('#themeToggle i');
            if (icon) icon.className = 'fas fa-moon';
        }
    } catch(e) {}
}
function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    if (isDark) {
        document.body.classList.remove('dark');
        localStorage.setItem('nbss_theme', 'light');
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = 'fas fa-moon';
    } else {
        document.body.classList.add('dark');
        localStorage.setItem('nbss_theme', 'dark');
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = 'fas fa-sun';
    }
}

// ---------- MODALS ----------
function openModal(id) { const el = document.getElementById(id); if(el) el.style.display = 'flex'; }
function closeModal(id) { const el = document.getElementById(id); if(el) el.style.display = 'none'; }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

// ---------- SEARCH SETUP ----------
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderFeed();
        });
    }
}

// ---------- EVENT BINDINGS ----------
function bindEvents() {
    const themeBtn = document.getElementById('themeToggle');
    if(themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const loginBtn = document.getElementById('loginBtn');
    if(loginBtn) loginBtn.addEventListener('click',()=>openModal('loginModal'));
    const registerBtn = document.getElementById('registerBtn');
    if(registerBtn) registerBtn.addEventListener('click',()=>openModal('registerModal'));
    document.querySelectorAll('.close-modal').forEach(btn=>btn.addEventListener('click',()=>{ const m=btn.closest('.modal'); if(m) m.style.display='none'; }));
    window.addEventListener('click',e=>{ if(e.target.classList.contains('modal')) e.target.style.display='none'; });
    const loginForm = document.getElementById('loginForm');
    if(loginForm) loginForm.addEventListener('submit',e=>{ e.preventDefault(); login(document.getElementById('loginUsername').value.trim(), document.getElementById('loginPassword').value); });
    const registerForm = document.getElementById('registerForm');
    if(registerForm) registerForm.addEventListener('submit',e=>{ e.preventDefault(); if(register(document.getElementById('regUsername').value.trim(), document.getElementById('regEmail').value.trim(), document.getElementById('regPassword').value)) { closeModal('registerModal'); openModal('loginModal'); } });
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', logout);
    const submitPostBtn = document.getElementById('submitPostBtn');
    if(submitPostBtn) submitPostBtn.addEventListener('click',()=>createPost(document.getElementById('postText').value, currentPostImageBase64));
    const postTextarea = document.getElementById('postText');
    if(postTextarea) postTextarea.addEventListener('input',()=>{ document.getElementById('charCounter').innerText = `${postTextarea.value.length}/280`; });
    const adminBtn = document.getElementById('adminPanelBtn');
    if(adminBtn) adminBtn.addEventListener('click',()=>{ if(currentUser?.role==='admin') { renderAdminPanel(); openModal('adminModal'); } else showToast('Доступ только админу','error'); });
    const profileBtn = document.getElementById('profileSettingsBtn');
    if(profileBtn) profileBtn.addEventListener('click', openProfileSettings);
    const profileForm = document.getElementById('profileForm');
    if(profileForm) profileForm.addEventListener('submit',e=>{ e.preventDefault(); saveProfileSettings(document.getElementById('profileUsername').value.trim(), document.getElementById('profileEmail').value.trim(), document.getElementById('profilePassword').value, tempAvatarBase64); tempAvatarBase64=null; });
    const adminEditForm = document.getElementById('adminEditUserForm');
    if(adminEditForm) adminEditForm.addEventListener('submit',e=>{ e.preventDefault(); saveAdminEditUser(); });
    const submitCommentBtn = document.getElementById('submitCommentBtn');
    if(submitCommentBtn) submitCommentBtn.addEventListener('click',()=>{ if(currentCommentPostId) addComment(currentCommentPostId, document.getElementById('commentText').value); });
    document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{ const tab=btn.dataset.tab; document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active')); document.getElementById(tab==='users'?'adminUsersTab':'adminPostsTab').classList.add('active'); }));
    setupSearch();
}

function startApp() { initData(); bindEvents(); updateUIByAuth(); initTheme(); if(currentUser) updateLastActive(currentUser.id); }
startApp();
