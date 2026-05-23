// Загрузка аватарки
async function setupAvatarUpload() {
  const avatarContainer = document.getElementById('profileAvatar');
  const avatarImg = document.getElementById('avatarImg');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const avatarInput = document.getElementById('avatarInput');

  avatarContainer.addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        avatarImg.src = data.url + '?t=' + Date.now();
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        alert(data.error || 'Ошибка загрузки');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  });
}

// Загрузка баннера
async function setupBannerUpload() {
  const bannerContainer = document.getElementById('profileBanner');
  const bannerImg = document.getElementById('bannerImg');
  const bannerInput = document.getElementById('bannerInput');
  const bannerHint = document.getElementById('bannerHint');

  bannerContainer.addEventListener('click', () => bannerInput.click());

  bannerInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('banner', file);
    try {
      const res = await fetch('/api/banner', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        bannerImg.src = data.url + '?t=' + Date.now();
        bannerImg.style.display = 'block';
        bannerHint.style.display = 'none';
      } else {
        alert(data.error || 'Ошибка загрузки');
      }
    } catch (err) {
      alert('Ошибка сети');
    }
  });
}

// Вызовите эти функции после авторизации или при загрузке профиля
// В функции loadProfile() добавьте:
async function loadProfile() {
  if (!currentUser) return;
  const user = currentUser; // данные уже содержат avatar и banner благодаря /api/me

  // Отображение аватарки
  const avatarImg = document.getElementById('avatarImg');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  if (user.avatar) {
    avatarImg.src = user.avatar;
    avatarImg.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  }

  // Отображение баннера
  const bannerImg = document.getElementById('bannerImg');
  const bannerHint = document.getElementById('bannerHint');
  if (user.banner) {
    bannerImg.src = user.banner;
    bannerImg.style.display = 'block';
    bannerHint.style.display = 'none';
  } else {
    bannerImg.style.display = 'none';
    bannerHint.style.display = 'block';
  }

  document.getElementById('profileName').textContent = user.username;
  document.getElementById('profileName').className = user.premium ? 'premium-nick' : '';
  document.getElementById('profileStatus').innerHTML =
    (user.verified ? '<img src="verification.png" class="verified-icon" alt="✔"> Верифицирован ' : '') +
    (user.premium ? '💎 НБСС+' : '');

  // ... загрузка постов ...
}

// Инициализация загрузчиков при старте
document.addEventListener('DOMContentLoaded', () => {
  setupAvatarUpload();
  setupBannerUpload();
});
