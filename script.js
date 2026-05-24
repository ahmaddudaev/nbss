const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;

async function request(url, options = {}) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  // Не устанавливаем Content-Type для FormData
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

// Инициализация (как раньше)

// ... (функции showPage, updateUIForAuth, навигация, вход/регистрация/выход, темы – без изменений)

// ========== ЗАГРУЗКА КАРТИНКИ В ПОСТ ==========
const postImageInput = document.getElementById('postImageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
let selectedImage = null;

postImageInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImage = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreviewContainer.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }
});

removeImageBtn?.addEventListener('click', () => {
  selectedImage = null;
  postImageInput.value = '';
  imagePreviewContainer.style.display = 'none';
});

// ========== ПУБЛИКАЦИЯ (с картинкой) ==========
document.getElementById('publishPost').addEventListener('click', async () => {
  const text = document.getElementById('postInput').value.trim();
  if (!text && !selectedImage) return;

  const formData = new FormData();
  if (text) formData.append('text', text);
  if (selectedImage) formData.append('image', selectedImage);

  try {
    await request('/posts', { method: 'POST', body: formData });
    document.getElementById('postInput').value = '';
    selectedImage = null;
    postImageInput.value = '';
    imagePreviewContainer.style.display = 'none';
    loadPosts();
  } catch (e) { alert(e.message); }
});

// Отправка по Enter (без Shift)
document.getElementById('postInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('publishPost').click();
  }
});

// ========== ЛЕНТА (добавлено отображение картинок и модалка) ==========
function renderPost(p) {
  const premium = p.authorPremium === true;
  const verified = p.authorVerified === true;
  const imageHtml = p.image ? `<div class="post-image-wrapper"><img src="${p.image}" class="post-image" alt="Изображение" loading="lazy" onclick="openImageModal('${p.image}')"></div>` : '';
  return `
    <div class="post" data-id="${p.id}" data-author="${p.author}">
      <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${premium ? 'premium-nick' : ''}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        ${p.text ? `<div class="post-text" id="text-${p.id}">${p.text}</div>` : ''}
        ${imageHtml}
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes.length}</button>
          <button class="repost-btn">🔄 ${p.reposts.length}</button>
          <button class="comment-toggle">💬 Комментарии</button>
          <button class="translate-btn" data-post-id="${p.id}">🌐 Перевести</button>
        </div>
        <div class="comments-section" style="display:none;"></div>
      </div>
    </div>`;
}

// Модальное окно
function openImageModal(src) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  modal.style.display = 'flex';
  modalImg.src = src;
}
document.getElementById('closeModal')?.addEventListener('click', () => {
  document.getElementById('imageModal').style.display = 'none';
});
window.onclick = (event) => {
  if (event.target === document.getElementById('imageModal')) {
    document.getElementById('imageModal').style.display = 'none';
  }
};

// ========== ПРОФИЛЬ (кнопка Подписаться) ==========
async function loadUserProfile(username) {
  try {
    const user = await request(`/user/${username}`);
    const header = document.getElementById('profileHeader');
    header.innerHTML = `
      <h2 class="${user.premium ? 'premium-nick' : ''}">${user.username} ${user.verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</h2>
      <p>${user.premium ? '💎 НБСС+' : ''}</p>
      <p>Подписчики: ${user.followers} · Подписки: ${user.following}</p>
      <div class="profile-actions">
        <button class="btn primary send-message-btn" data-username="${user.username}">💬 Написать сообщение</button>
        <button class="btn outline follow-btn" data-username="${user.username}">
          ${currentUser && currentUser.following && currentUser.following.includes(username) ? 'Отписаться' : 'Подписаться'}
        </button>
      </div>
    `;
    // Обработчик подписки
    document.querySelector('.follow-btn')?.addEventListener('click', async () => {
      try {
        await request(`/follow/${username}`, { method: 'POST' });
        // Обновить текущего пользователя и интерфейс
        currentUser = await request('/me');
        loadUserProfile(username); // перерисовать кнопку
      } catch (e) { alert(e.message); }
    });

    // ... остальная загрузка постов
  } catch (e) { ... }
}

// В loadMyProfile() также обновить отображение подписчиков/подписок

// Остальные функции (лайки, комментарии, перевод, сообщения, админка) остаются без изменений, только дополнены новыми возможностями.
