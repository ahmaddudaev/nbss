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
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));

// Папки
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');
[AVATARS_DIR, BANNERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Хранилище
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

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
    verified: true,
    admin: true,
    premium: true,
    avatar: '',
    banner: ''
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

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'avatar') cb(null, AVATARS_DIR);
    else if (file.fieldname === 'banner') cb(null, BANNERS_DIR);
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
    const allowed = /jpeg|jpg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Только JPEG/PNG'));
  }
});

// API – пользователи
app.post('/api/register', (req, res) => { ... }); // без изменений
app.post('/api/login', (req, res) => { ... });
app.get('/api/me', auth, (req, res) => { ... });
app.get('/api/users/search', (req, res) => { ... });
app.get('/api/user/:username', (req, res) => { ... }); // для чужого профиля

// Посты и комментарии
app.get('/api/posts', (req, res) => { ... });
app.post('/api/posts', auth, (req, res) => { ... });
app.post('/api/posts/:id/like', auth, (req, res) => { ... });
app.post('/api/posts/:id/repost', auth, (req, res) => { ... });
app.get('/api/posts/:id/comments', (req, res) => { ... });
app.post('/api/posts/:id/comments', auth, (req, res) => { ... });

// События
app.get('/api/events', (req, res) => { ... });
app.post('/api/events', auth, (req, res) => { ... });

// Админка
app.get('/api/admin/users', auth, (req, res) => { ... });
app.post('/api/admin/user/:username', auth, (req, res) => { ... });

// Статистика
app.get('/api/stats', (req, res) => { ... });

// Загрузка аватар/баннер
app.post('/api/avatar', auth, upload.single('avatar'), (req, res) => { ... });
app.post('/api/banner', auth, upload.single('banner'), (req, res) => { ... });

// Личные сообщения
app.get('/api/dialogs', auth, (req, res) => {
  const user = req.user.username;
  const dialogs = new Map();
  messages.forEach(m => {
    if (m.from === user || m.to === user) {
      const partner = m.from === user ? m.to : m.from;
      if (!dialogs.has(partner) || m.timestamp > dialogs.get(partner).timestamp) {
        dialogs.set(partner, { username: partner, lastMessage: m.text, timestamp: m.timestamp });
      }
    }
  });
  const result = Array.from(dialogs.values()).sort((a,b) => b.timestamp - a.timestamp);
  result.forEach(d => {
    const u = users[d.username];
    if (u) { d.premium = u.premium || false; d.verified = u.verified || false; }
  });
  res.json(result);
});

app.get('/api/messages', auth, (req, res) => {
  const partner = req.query.with;
  if (!partner) return res.status(400).json({ error: 'Не указан собеседник' });
  const user = req.user.username;
  const conversation = messages.filter(m =>
    (m.from === user && m.to === partner) || (m.from === partner && m.to === user)
  ).sort((a,b) => a.timestamp - b.timestamp);
  res.json(conversation);
});

app.post('/api/messages', auth, (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'Заполните получателя и текст' });
  const msg = {
    id: Date.now(),
    from: req.user.username,
    to,
    text,
    timestamp: new Date().toISOString()
  };
  messages.push(msg);
  saveJSON(MESSAGES_FILE, messages);
  res.json({ ok: true, message: msg });
});

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
