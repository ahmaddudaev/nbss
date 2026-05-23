const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));

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
  'MrSigma': { username:'MrSigma', password: crypto.createHash('sha256').update('Mrbeast132!').digest('hex'), verified:true, admin:true, premium:true, avatar:'', banner:'' }
});
let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews:0 });

// ... (весь остальной код, включая /register, /login, /me, /posts, /comments, /admin, /stats) ...
// Добавляем новые маршруты:

// Получить публичную информацию о пользователе
app.get('/api/user/:username', (req, res) => {
  const user = users[req.params.username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ username: user.username, verified: user.verified, premium: user.premium, avatar: user.avatar, banner: user.banner });
});

// Список диалогов
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
  // Добавим premium/verified
  result.forEach(d => {
    const u = users[d.username];
    if (u) {
      d.premium = u.premium || false;
      d.verified = u.verified || false;
    }
  });
  res.json(result);
});

// История сообщений с пользователем
app.get('/api/messages', auth, (req, res) => {
  const partner = req.query.with;
  if (!partner) return res.status(400).json({ error: 'Не указан собеседник' });
  const user = req.user.username;
  const conversation = messages.filter(m =>
    (m.from === user && m.to === partner) || (m.from === partner && m.to === user)
  ).sort((a,b) => a.timestamp - b.timestamp);
  res.json(conversation);
});

// Отправить сообщение
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

// При удалении пользователя также удаляем его сообщения (добавить в /admin/user/:username)
// В обработчике del добавить:
// messages = messages.filter(m => m.from !== target && m.to !== target);
// saveJSON(MESSAGES_FILE, messages);
