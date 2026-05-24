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

let users = loadJSON(USERS_FILE, {
  'MrSigma': {
    username: 'MrSigma',
    password: crypto.createHash('sha256').update('Mrbeast132!').digest('hex'),
    verified: true,
    admin: true,
    premium: true,
    avatar: '',
    banner: '',
    followers: [],
    following: []
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

// -------------------- API --------------------
app.post('/api/register', (req, res) => { ... }); // без изменений
app.post('/api/login', (req, res) => { ... });
app.get('/api/me', auth, (req, res) => { ... });
app.get('/api/users/search', (req, res) => { ... });
app.get('/api/user/:username', (req, res) => { ... });
app.post('/api/avatar', auth, upload.single('avatar'), (req, res) => { ... });
app.post('/api/banner', auth, upload.single('banner'), (req, res) => { ... });
app.post('/api/posts', auth, upload.single('image'), (req, res) => { ... });
app.get('/api/posts', (req, res) => { ... });
app.post('/api/posts/:id/like', auth, (req, res) => { ... });
app.post('/api/posts/:id/repost', auth, (req, res) => { ... });
app.get('/api/posts/:id/comments', (req, res) => { ... });
app.post('/api/posts/:id/comments', auth, (req, res) => { ... });
app.post('/api/translate', (req, res) => { ... });
app.get('/api/events', (req, res) => { ... });
app.post('/api/events', auth, (req, res) => { ... });
app.get('/api/admin/users', auth, (req, res) => { ... });
app.post('/api/admin/user/:username', auth, (req, res) => { ... });
app.get('/api/stats', (req, res) => { ... });
app.get('/api/dialogs', auth, (req, res) => { ... });
app.get('/api/messages', auth, (req, res) => { ... });
app.post('/api/messages', auth, (req, res) => { ... });
app.get('/fix-admin', (req, res) => { ... });

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
