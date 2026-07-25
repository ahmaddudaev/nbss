const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'public/uploads/posts');

// Шифрование AES-256
const SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'super_secret').digest();
const IV_LEN = 16;
const encrypt = text => {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};
const decrypt = text => {
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const load = (file, def = []) => { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : def } catch { return def } };
const save = (file, data) => { try { fs.writeFileSync(file, JSON.stringify(data, null, 2)) } catch {} };

[DATA, UPLOADS].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) });

// Загружаем пользователей
let users = load(path.join(DATA, 'users.json'), {});
let posts = load(path.join(DATA, 'posts.json'), []);
let events = load(path.join(DATA, 'events.json'), []);
let comments = load(path.join(DATA, 'comments.json'), []);
let codes = load(path.join(DATA, 'codes.json'), []);
let bannedIPs = load(path.join(DATA, 'banned_ips.json'), []);

// Инициализация владельца (всегда зашифрованный пароль)
if (!users['MrSigma'] || !users['MrSigma'].encryptedPassword) {
  users['MrSigma'] = {
    username: 'MrSigma',
    encryptedPassword: encrypt('Mrbeast132!'),
    role: 'owner',
    premium: true,
    verified: true,
    tokens: 1000,
    avatar: '',
    banner: '',
    followers: [],
    following: [],
    bannedUntil: null,
    lastIP: null
  };
}
// Очистка старых SHA-хешей
Object.values(users).forEach(u => {
  u.role = u.role || 'user';
  u.premium = u.premium || false;
  u.verified = u.verified || false;
  u.tokens = u.tokens || 0;
  if (u.password) delete u.password;
  if (!u.encryptedPassword) u.encryptedPassword = encrypt(''); // на случай миграции
});
save(path.join(DATA, 'users.json'), users);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d' }));
app.use(express.static(__dirname, { maxAge: '30d' }));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// IP-бан (опционально, можно оставить)
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const ban = bannedIPs.find(b => b.ip === ip);
  if (ban) {
    if (ban.until && new Date(ban.until) <= new Date()) {
      bannedIPs = bannedIPs.filter(b => b.ip !== ip);
      save(path.join(DATA, 'banned_ips.json'), bannedIPs);
    } else {
      return res.status(423).json({ banned: true, bannedUntil: ban.until || null });
    }
  }
  next();
});

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const user = Object.values(users).find(u => u.token === authHeader.split(' ')[1]);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date())
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  if (user.bannedUntil && new Date(user.bannedUntil) <= new Date()) {
    user.bannedUntil = null;
    save(path.join(DATA, 'users.json'), users);
  }
  req.user = user;
  next();
};

const requireRole = (min) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
  const levels = { owner:5, head_admin:4, admin:3, moderator:2, event_moderator:1, user:0 };
  if ((levels[req.user.role]||0) < (levels[min]||0)) return res.status(403).json({ error: 'Недостаточно прав' });
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.username}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Кэш постов
let cachedPosts = [];
let lastCache = 0;
const CACHE_TTL = 5000;

// API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  if (users[username]) return res.status(400).json({ error: 'Пользователь уже существует' });
  users[username] = {
    username,
    encryptedPassword: encrypt(password),
    role: 'user',
    premium: false,
    verified: true,
    tokens: 0,
    avatar: '',
    banner: '',
    followers: [],
    following: [],
    bannedUntil: null,
    lastIP: null
  };
  save(path.join(DATA, 'users.json'), users);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Неверный логин или пароль' });
  // Расшифровываем и сравниваем
  const decrypted = decrypt(user.encryptedPassword);
  if (decrypted !== password) return res.status(400).json({ error: 'Неверный логин или пароль' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date())
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  user.token = crypto.randomBytes(32).toString('hex');
  user.lastIP = req.ip;
  save(path.join(DATA, 'users.json'), users);
  const { encryptedPassword, token, ...safe } = user;
  res.json({ token: user.token, user: safe });
});

app.get('/api/me', auth, (req, res) => {
  const { encryptedPassword, token, ...safe } = req.user;
  res.json(safe);
});

app.get('/api/posts', (req, res) => {
  const now = Date.now();
  if (cachedPosts.length && (now - lastCache) < CACHE_TTL) return res.json(cachedPosts);
  const enriched = posts.map(p => ({
    ...p,
    authorRole: users[p.author]?.role,
    authorPremium: users[p.author]?.premium,
    authorVerified: users[p.author]?.verified
  }));
  cachedPosts = enriched;
  lastCache = now;
  res.json(enriched);
});

app.post('/api/posts', auth, upload.array('images', 4), (req, res) => {
  const post = {
    id: Date.now(),
    author: req.user.username,
    text: req.body.text || '',
    images: req.files?.map(f => '/uploads/posts/' + f.filename) || [],
    timestamp: new Date().toISOString(),
    likes: [],
    reposts: []
  };
  posts.unshift(post);
  save(path.join(DATA, 'posts.json'), posts);
  cachedPosts = [];
  res.json(post);
});

// Админские маршруты (бан пользователя)
function parseDuration(dur) {
  if (!dur) return 0;
  if (typeof dur === 'number') return dur * 60 * 1000;
  if (typeof dur === 'object' && dur.value && dur.unit) {
    const { value, unit } = dur;
    switch (unit) {
      case 'minutes': return value * 60 * 1000;
      case 'hours': return value * 3600 * 1000;
      case 'days': return value * 86400 * 1000;
      case 'weeks': return value * 7 * 86400 * 1000;
      case 'years': return value * 365 * 86400 * 1000;
      default: return 0;
    }
  }
  return 0;
}

app.post('/api/admin/ban-user', auth, requireRole('moderator'), (req, res) => {
  const { username, duration } = req.body;
  const user = users[username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  user.bannedUntil = duration ? new Date(Date.now() + parseDuration(duration)).toISOString() : null;
  save(path.join(DATA, 'users.json'), users);
  res.json({ success: true });
});

// Статистика
app.get('/api/stats', (req, res) => {
  res.json({
    users: Object.keys(users).length,
    posts: posts.length
  });
});

app.listen(PORT, () => console.log(`🚀 ${PORT}`));
