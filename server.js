const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

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

// Гарантируем права MrSigma при старте
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
    premium: false,
    avatar: '',
    banner: '',
    followers: [],
    following: []
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
      premium: user.premium,
      avatar: user.avatar,
      banner: user.banner,
      followers: user.followers ? user.followers.length : 0,
      following: user.following ? user.following.length : 0
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
    followers: user.followers ? user.followers.length : 0,
    following: user.following ? user.following.length : 0
  });
});

// ... остальные маршруты (посты, комментарии, перевод, события, админка, сообщения) оставьте без изменений из предыдущего полного server.js
// Они должны присутствовать здесь.

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
