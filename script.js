const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {}; // кэш переводов

// ... (все предыдущие функции request, init, showPage, updateUIForAuth и т.д.) без изменений

// ========== РЕНДЕР ПОСТА (обновлён) ==========
function renderPost(p) {
  const premium = p.authorPremium === true;
  const verified = p.authorVerified === true;
  const postId = p.id;

  // Если перевод уже есть в кэше, используем его, иначе оригинальный текст
  const displayText = translatedPosts[postId] || p.text;

  return `
    <div class="post" data-id="${postId}" data-author="${p.author}">
      <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${premium ? 'premium-nick' : ''}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        <div class="post-text" id="text-${postId}">${displayText}</div>
        <div class="post-actions">
          <button class="like-btn">❤️ ${p.likes.length}</button>
          <button class="repost-btn">🔄 ${p.reposts.length}</button>
          <button class="comment-toggle">💬 Комментарии</button>
          <button class="translate-btn" data-post-id="${postId}">🌐 Перевести</button>
        </div>
        <div class="comments-section" style="display:none;"></div>
      </div>
    </div>`;
}

// ========== ОБРАБОТЧИК ПЕРЕВОДА ==========
async function translatePost(postId) {
  const textEl = document.getElementById(`text-${postId}`);
  if (!textEl) return;

  const originalText = textEl.dataset.original || textEl.textContent;
  textEl.dataset.original = originalText;

  // Если уже переведён – откатываем
  if (translatedPosts[postId]) {
    textEl.textContent = originalText;
    delete translatedPosts[postId];
    return;
  }

  // Показываем индикатор
  textEl.textContent = 'Перевод...';

  try {
    const targetLang = navigator.language || 'en';
    const data = await request('/translate', {
      method: 'POST',
      body: JSON.stringify({ text: originalText, target: targetLang })
    });
    textEl.textContent = data.translation;
    translatedPosts[postId] = data.translation; // кэшируем
  } catch (e) {
    textEl.textContent = originalText;  // в случае ошибки возвращаем оригинал
    alert('Не удалось перевести: ' + e.message);
  }
}

// ========== ПРИВЯЗКА СОБЫТИЙ (дополняем attachPostActions) ==========
function attachPostActions() {
  // ... (лайки, репосты, комментарии – без изменений)

  // Перевод
  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = function() {
      const postId = this.dataset.postId;
      translatePost(postId);
    };
  });
}
