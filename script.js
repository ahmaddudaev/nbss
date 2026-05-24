const API = '/api';
let token = localStorage.getItem('nbss_token') || null;
let currentUser = null;
let currentDialog = null;
const translatedPosts = {}; // кэш переводов

// ... (request, init, showPage, updateUIForAuth, навигация, вход, темы – без изменений)

// ========== ПУБЛИКАЦИЯ ==========
document.getElementById('publishPost').addEventListener('click', async () => {
  const text = document.getElementById('postInput').value.trim();
  if (!text) return;
  try {
    await request('/posts', { method: 'POST', body: JSON.stringify({ text }) });
    document.getElementById('postInput').value = '';
    loadPosts();
  } catch (e) { alert(e.message); }
});

// ========== ЛЕНТА (с переводом) ==========
async function loadPosts() {
  const container = document.getElementById('feedContainer');
  try {
    const posts = await request('/posts');
    container.innerHTML = posts.map(p => renderPost(p)).join('');
    attachPostActions();
  } catch (e) { container.innerHTML = '<p>Ошибка загрузки</p>'; }
}

function renderPost(p) {
  const premium = p.authorPremium === true;
  const verified = p.authorVerified === true;
  return `
    <div class="post" data-id="${p.id}" data-author="${p.author}">
      <div class="avatar">${p.author[0]?.toUpperCase() || '?'}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="username ${premium ? 'premium-nick' : ''}" style="cursor:pointer;">${p.author || 'Аноним'}${verified ? '<img src="verification.png" class="verified-icon" alt="✔">' : ''}</span>
          <span>· ${new Date(p.timestamp).toLocaleString()}</span>
        </div>
        <div class="post-text" id="text-${p.id}">${p.text}</div>
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

function attachPostActions() {
  document.querySelectorAll('.like-btn').forEach(b => b.onclick = async function() { /* без изменений */ });
  document.querySelectorAll('.repost-btn').forEach(b => b.onclick = async function() { /* без изменений */ });
  document.querySelectorAll('.comment-toggle').forEach(b => b.onclick = async function() { /* без изменений */ });

  // Перевод
  document.querySelectorAll('.translate-btn').forEach(btn => {
    btn.onclick = async function() {
      const postId = this.dataset.postId;
      const textEl = document.getElementById(`text-${postId}`);
      if (!textEl) return;

      const originalText = textEl.dataset.original || textEl.textContent;
      textEl.dataset.original = originalText;

      // Откат, если уже переведено
      if (translatedPosts[postId]) {
        textEl.textContent = originalText;
        delete translatedPosts[postId];
        return;
      }

      textEl.textContent = 'Перевод...';
      try {
        const targetLang = navigator.language || 'en';
        const data = await request('/translate', {
          method: 'POST',
          body: JSON.stringify({ text: originalText, target: targetLang })
        });
        textEl.textContent = data.translation;
        translatedPosts[postId] = data.translation;
      } catch (e) {
        textEl.textContent = originalText;
        alert('Не удалось перевести: ' + e.message);
      }
    };
  });
}

// ... (остальные функции: комментарии, профили, сообщения, админка, поиск – они полностью совпадают с последней полной версией script.js)
