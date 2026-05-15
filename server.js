const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Раздача статических файлов из корня
app.use(express.static(__dirname));
app.get('/server.js', (req, res) => res.status(404).send('Not found'));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

function loadJSON(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(e); }
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error(e); }
}

let users = loadJSON(USERS_FILE, {
  'MrSigma': {
    username: 'MrSigma',
    password: crypto.createHash('sha256').update('Mrbeast132!').digest('hex'),
    verified: true,
    admin: true,
    premium: true
  }
});
let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews: 0 });

// Автоматически восстанавливаем права MrSigma при каждом запуске
if (users['MrSigma']) {
  users['MrSigma'].admin = true;
  users['MrSigma'].verified = true;
  users['MrSigma'].premium = true;
  saveJSON(USERS_FILE, users);
}

app.use((req, res, next) => {
  stats.pageviews = (stats.pageviews || 0) + 1;
  saveJSON(STATS_FILE, stats);
  next();
});

function hash(pw) { return crypto.createHash('sha256').update(pw).digest('hex'); }

// Middleware авторизации
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const token = header.split(' ')[1];
  const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  req.user = user;
  next();
}

// ---------- API ----------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (users[username]) return res.status(400).json({ error: 'Пользователь уже существует' });
  users[username] = {
    username,
    password: hash(password),
    verified: false,
    admin: false,
    premium: false
  };
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== hash(password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  user.token = token;
  saveJSON(USERS_FILE, users);
  res.json({
    token,
    user: {
      username: user.username,
      verified: user.verified,
      admin: user.admin,
      premium: user.premium
    }
  });
});

// Новый endpoint – получить данные о себе
app.get('/api/me', auth, (req, res) => {
  res.json({
    username: req.user.username,
    verified: req.user.verified,
    admin: req.user.admin,
    premium: req.user.premium
  });
});

app.get('/api/posts', (req, res) => res.json(posts));

app.post('/api/posts', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Текст поста пуст' });
  const post = {
    id: Date.now(),
    author: req.user.username,
    text,
    likes: [],
    reposts: [],
    timestamp: new Date().toISOString()
  };
  posts.unshift(post);
  saveJSON(POSTS_FILE, posts);
  res.json({ ok: true, post });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  const username = req.user.username;
  if (post.likes.includes(username)) {
    post.likes = post.likes.filter(u => u !== username);
  } else {
    post.likes.push(username);
  }
  saveJSON(POSTS_FILE, posts);
  res.json({ ok: true, likes: post.likes.length });
});

app.post('/api/posts/:id/repost', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  const username = req.user.username;
  if (!post.reposts.includes(username)) {
    post.reposts.push(username);
  }
  saveJSON(POSTS_FILE, posts);
  res.json({ ok: true, reposts: post.reposts.length });
});

app.get('/api/events', (req, res) => res.json(events));

app.post('/api/events', auth, (req, res) => {
  if (!req.user.admin) return res.status(403).json({ error: 'Нет прав' });
  const { title, desc } = req.body;
  if (!title) return res.status(400).json({ error: 'Укажите название' });
  events.push({ title, desc });
  saveJSON(EVENTS_FILE, events);
  res.json({ ok: true });
});

app.get('/api/admin/users', auth, (req, res) => {
  if (!req.user.admin) return res.status(403).json({ error: 'Нет прав' });
  res.json(Object.values(users).map(u => ({
    username: u.username,
    verified: u.verified,
    admin: u.admin,
    premium: u.premium
  })));
});

app.post('/api/admin/user/:username', auth, (req, res) => {
  if (!req.user.admin) return res.status(403).json({ error: 'Нет прав' });
  const target = req.params.username;
  if (!users[target]) return res.status(404).json({ error: 'Пользователь не найден' });
  const { verified, admin, premium, delete: del } = req.body;
  if (del) {
    if (target === 'MrSigma') return res.status(400).json({ error: 'Нельзя удалить основателя' });
    delete users[target];
  } else {
    if (verified !== undefined) users[target].verified = verified;
    if (admin !== undefined) {
      if (target === 'MrSigma' && !admin) return res.status(400).json({ error: 'Нельзя разжаловать основателя' });
      users[target].admin = admin;
    }
    if (premium !== undefined) users[target].premium = premium;
  }
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  res.json({
    users: Object.keys(users).length,
    posts: posts.length,
    pageviews: stats.pageviews,
    online: Math.floor(Math.random() * 5) + 1
  });
});

// Публичный fix-admin (запасной)
app.get('/fix-admin', (req, res) => {
  if (users['MrSigma']) {
    users['MrSigma'].admin = true;
    users['MrSigma'].verified = true;
    users['MrSigma'].premium = true;
    saveJSON(USERS_FILE, users);
    res.send('✅ MrSigma теперь админ!');
  } else {
    res.send('❌ Пользователь не найден');
  }
});

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
