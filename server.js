const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // раздача статики (включая public/uploads)
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- Папки ----------
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');

[AVATARS_DIR, BANNERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ---------- Хранилище данных ----------
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
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
let stats = loadJSON(STATS_FILE, { pageviews: 0 });

// ---------- Multer для загрузки ----------
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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 МБ
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Только JPEG/PNG'));
  }
});

// ---------- Авторизация ----------
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const token = header.split(' ')[1];
  const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  req.user = user;
  next();
}

// ---------- API (прежние эндпоинты сохранены, показаны только новые) ----------

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

// Получить данные пользователя (расширено)
app.get('/api/me', auth, (req, res) => {
  const user = users[req.user.username];
  res.json({
    username: user.username,
    verified: user.verified,
    admin: user.admin,
    premium: user.premium,
    avatar: user.avatar || '',
    banner: user.banner || ''
  });
});

// Остальные эндпоинты (регистрация, вход, посты, комментарии и т.д.) идентичны предыдущему полному server.js.
// Для краткости я опускаю их здесь, но в вашем реальном файле они должны быть.
// Просто добавьте приведённые выше маршруты в свой существующий server.js.
