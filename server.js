const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Папки для данных
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Папки для загрузок
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');
const POSTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'posts');
[AVATARS_DIR, BANNERS_DIR, POSTS_IMAGES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Утилиты
function loadJSON(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

let users = loadJSON(USERS_FILE, {
  'MrSigma': {
    username: 'MrSigma',
    password: crypto.createHash('sha256').update('Mrbeast132!').digest('hex'),
    verified: true, admin: true, premium: true,
    avatar: '', banner: '',
    followers: [], following: []
  }
});
let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews: 0 });

if (users['MrSigma']) {
  users['MrSigma'].admin = true;
  users['MrSigma'].verified = true;
  users['MrSigma'].premium = true;
  saveJSON(USERS_FILE, users);
}

app.use((req, res, next) => { stats.pageviews++; saveJSON(STATS_FILE, stats); next(); });

const hash = pw => crypto.createHash('sha256').update(pw).digest('hex');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const token = header.split(' ')[1];
  const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  req.user = user;
  next();
}

// Multer для аватарок/баннеров/постов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'avatar') cb(null, AVATARS_DIR);
    else if (file.fieldname === 'banner') cb(null, BANNERS_DIR);
    else if (file.fieldname === 'image') cb(null, POSTS_IMAGES_DIR);
    else cb(new Error('Неизвестное поле'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.username}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Только JPEG/PNG/GIF'));
  }
});

// ========== API ==========
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните поля' });
  if (users[username]) return res.status(400).json({ error: 'Пользователь уже существует' });
  users[username] = {
    username, password: hash(password),
    verified: false, admin: false, premium: false,
    avatar: '', banner: '',
    followers: [], following: []
  };
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== hash(password)) return res.status(401).json({ error: 'Неверные данные' });
  const token = crypto.randomBytes(32).toString('hex');
  user.token = token;
  saveJSON(USERS_FILE, users);
  res.json({
    token,
    user: {
      username: user.username,
      verified: user.verified,
      admin: user.admin,
      premium: user.premium,
      avatar: user.avatar,
      banner: user.banner,
      followers: user.followers.length,
      following: user.following.length
    }
  });
});

app.get('/api/me', auth, (req, res) => {
  const user = users[req.user.username];
  res.json({
    username: user.username,
    verified: user.verified,
    admin: user.admin,
    premium: user.premium,
    avatar: user.avatar || '',
    banner: user.banner || '',
    followers: user.followers.length,
    following: user.following.length
  });
});

// Загрузка аватарки
app.post('/api/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/uploads/avatars/${req.file.filename}`;
  users[req.user.username].avatar = url;
  saveJSON(USERS_FILE, users);
  res.json({ ok: true, url });
});

// Загрузка баннера
app.post('/api/banner', auth, upload.single('banner'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/uploads/banners/${req.file.filename}`;
  users[req.user.username].banner = url;
  saveJSON(USERS_FILE, users);
  res.json({ ok: true, url });
});

// Посты с картинками
app.post('/api/posts', auth, upload.single('image'), (req, res) => {
  const { text } = req.body;
  const image = req.file ? `/uploads/posts/${req.file.filename}` : null;
  if (!text && !image) return res.status(400).json({ error: 'Пустой пост' });
  const post = {
    id: Date.now(),
    author: req.user.username,
    text: text || '',
    image,
    likes: [],
    reposts: [],
    timestamp: new Date().toISOString()
  };
  posts.unshift(post);
  saveJSON(POSTS_FILE, posts);
  res.json({
    ok: true,
    post: {
      ...post,
      authorVerified: req.user.verified,
      authorPremium: req.user.premium
    }
  });
});

app.get('/api/posts', (req, res) => {
  const enriched = posts.map(p => {
    const author = users[p.author] || {};
    return {
      ...p,
      authorVerified: author.verified || false,
      authorPremium: author.premium || false
    };
  });
  res.json(enriched);
});

// Подписки
app.post('/api/follow/:username', auth, (req, res) => {
  const target = req.params.username;
  if (!users[target]) return res.status(404).json({ error: 'Пользователь не найден' });
  if (target === req.user.username) return res.status(400).json({ error: 'Нельзя подписаться на себя' });

  const me = users[req.user.username];
  const them = users[target];

  if (!me.following.includes(target)) {
    me.following.push(target);
    them.followers.push(req.user.username);
  } else {
    me.following = me.following.filter(u => u !== target);
    them.followers = them.followers.filter(u => u !== req.user.username);
  }

  saveJSON(USERS_FILE, users);
  res.json({ ok: true, followers: them.followers.length, following: me.following.length });
});

// Публичный профиль
app.get('/api/user/:username', (req, res) => {
  const user = users[req.params.username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({
    username: user.username,
    verified: user.verified,
    premium: user.premium,
    avatar: user.avatar,
    banner: user.banner,
    followers: user.followers.length,
    following: user.following.length
  });
});

// Остальные маршруты (комментарии, лайки, перевод, админка, сообщения) – идентичны предыдущей версии.
// Я их не дублирую для краткости, но они должны присутствовать в вашем server.js.
// Добавьте их после этого блока.

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
