const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));

// Папки
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');
const POSTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'posts');
[AVATARS_DIR, BANNERS_DIR, POSTS_IMAGES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function loadJSON(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

// Роли
const ROLES = {
  OWNER: 'owner',
  HEAD_ADMIN: 'head_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  EVENT_MODERATOR: 'event_moderator',
  USER: 'user'
};

const ROLE_HIERARCHY = {
  [ROLES.OWNER]: 5,
  [ROLES.HEAD_ADMIN]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.MODERATOR]: 2,
  [ROLES.EVENT_MODERATOR]: 1,
  [ROLES.USER]: 0
};

let users = loadJSON(USERS_FILE, {});
const ownerPassword = crypto.createHash('sha256').update('Mrbeast132!').digest('hex');
users['MrSigma'] = {
  username: 'MrSigma',
  password: ownerPassword,
  role: ROLES.OWNER,
  premium: true,
  verified: true,
  avatar: users['MrSigma']?.avatar || '',
  banner: users['MrSigma']?.banner || '',
  followers: users['MrSigma']?.followers || [],
  following: users['MrSigma']?.following || [],
  bannedUntil: null
};
Object.values(users).forEach(u => {
  if (!u.role) u.role = ROLES.USER;
  if (!u.premium) u.premium = false;
  if (!u.verified) u.verified = false;
  if (!u.bannedUntil) u.bannedUntil = null;
});
saveJSON(USERS_FILE, users);

let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews: 0 });

events.forEach((e, i) => { if (!e.id) e.id = Date.now() + i; });
if (events.some(e => !e.id)) saveJSON(EVENTS_FILE, events);

app.use((req, res, next) => { stats.pageviews++; saveJSON(STATS_FILE, stats); next(); });

const hash = pw => crypto.createHash('sha256').update(pw).digest('hex');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const token = header.split(' ')[1];
  const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) <= new Date()) {
    user.bannedUntil = null;
    saveJSON(USERS_FILE, users);
  }
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  }
  req.user = user;
  next();
}

function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, POSTS_IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.username}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------- API ----------
app.post('/api/register', (req, res) => { /* ... */ });
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== hash(password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  }
  const token = crypto.randomBytes(32).toString('hex');
  user.token = token;
  saveJSON(USERS_FILE, users);
  res.json({
    token,
    user: {
      username: user.username,
      role: user.role,
      premium: user.premium,
      verified: user.verified,
      avatar: user.avatar,
      banner: user.banner,
      followers: (user.followers || []).length,
      following: (user.following || []).length
    }
  });
});

app.get('/api/me', auth, (req, res) => { /* ... */ });
app.get('/api/users/search', (req, res) => { /* ... */ });
app.get('/api/user/:username', (req, res) => { /* ... */ });

app.post('/api/posts', auth, upload.array('images', 10), (req, res) => {
  const { text } = req.body;
  const files = req.files;
  const images = files ? files.map(f => `/uploads/posts/${f.filename}`) : [];
  if (!text && images.length === 0) return res.status(400).json({ error: 'Пустой пост' });
  const post = {
    id: Date.now(),
    author: req.user.username,
    text: text || '',
    images,
    likes: [],
    reposts: [],
    timestamp: new Date().toISOString()
  };
  posts.unshift(post);
  saveJSON(POSTS_FILE, posts);
  res.json({
    ok: true,
    post: { ...post, authorRole: req.user.role, authorVerified: req.user.verified, authorPremium: req.user.premium }
  });
});

app.get('/api/posts', (req, res) => { /* ... */ });
app.delete('/api/posts/:id', auth, (req, res) => { /* ... */ });
app.post('/api/posts/:id/like', auth, (req, res) => { /* ... */ });
app.post('/api/posts/:id/repost', auth, (req, res) => { /* ... */ });

app.get('/api/posts/:id/comments', (req, res) => { /* ... */ });
app.post('/api/posts/:id/comments', auth, (req, res) => { /* ... */ });
app.delete('/api/comments/:id', auth, (req, res) => { /* ... */ });

app.post('/api/translate', (req, res) => { /* ... */ });

app.get('/api/events', (req, res) => res.json(events));
app.post('/api/events', auth, requireRole(ROLES.EVENT_MODERATOR), (req, res) => { /* ... */ });
app.delete('/api/events/:id', auth, requireRole(ROLES.EVENT_MODERATOR), (req, res) => { /* ... */ });

app.get('/api/admin/users', auth, requireRole(ROLES.MODERATOR), (req, res) => { /* ... */ });
app.post('/api/admin/user/:username', auth, (req, res) => { /* ... */ });

app.get('/api/stats', (req, res) => {
  res.json({
    users: Object.keys(users).length,
    posts: posts.length,
    comments: comments.length,
    pageviews: stats.pageviews,
    online: Math.floor(Math.random() * 5) + 1
  });
});

app.get('/api/dialogs', auth, (req, res) => { /* ... */ });
app.get('/api/messages', auth, (req, res) => { /* ... */ });
app.post('/api/messages', auth, (req, res) => { /* ... */ });

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
