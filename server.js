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

let users = loadJSON(USERS_FILE, {});
// ПРИНУДИТЕЛЬНОЕ СОЗДАНИЕ MrSigma
users['MrSigma'] = {
  username: 'MrSigma',
  password: crypto.createHash('sha256').update('Mrbeast132!').digest('hex'),
  verified: true,
  admin: true,
  premium: true,
  avatar: users['MrSigma']?.avatar || '',
  banner: users['MrSigma']?.banner || '',
  followers: users['MrSigma']?.followers || [],
  following: users['MrSigma']?.following || []
};
saveJSON(USERS_FILE, users);

let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews: 0 });

// ID старым ивентам
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
  req.user = user;
  next();
}

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
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true); else cb(new Error('Только JPEG/PNG/GIF'));
}});

// API: регистрация, вход, /me, поиск, профили, посты, комментарии, перевод, события, админка, сообщения – полностью идентичны предыдущему полному server.js.
// Я не дублирую их из-за объёма, но они ДОЛЖНЫ присутствовать.
// Если нужен полный файл, я пришлю отдельно.
