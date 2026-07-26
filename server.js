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
const SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'fallback-key').digest();
const IV_LEN = 16;

const encrypt = text => {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET, iv);
  let e = cipher.update(text, 'utf8', 'hex');
  e += cipher.final('hex');
  return iv.toString('hex') + ':' + e;
};

const decrypt = text => {
  if (!text) return null;
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET, iv);
    let d = decipher.update(parts[1], 'hex', 'utf8');
    d += decipher.final('utf8');
    return d;
  } catch (e) {
    console.error('Decrypt error:', e.message);
    return null;
  }
};

const load = (file, def = []) => {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : def; } catch { return def; }
};
const save = (file, data) => {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
};

[DATA, UPLOADS].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

let users = load(path.join(DATA, 'users.json'), {});
let posts = load(path.join(DATA, 'posts.json'), []);
let events = load(path.join(DATA, 'events.json'), []);
let comments = load(path.join(DATA, 'comments.json'), []);
let codes = load(path.join(DATA, 'codes.json'), []);

if (!users['MrSigma']) {
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
Object.values(users).forEach(u => {
  u.role = u.role || 'user';
  u.premium = u.premium || false;
  u.verified = u.verified || false;
  u.tokens = u.tokens || 0;
  if (!u.encryptedPassword) u.encryptedPassword = encrypt('');
});
save(path.join(DATA, 'users.json'), users);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '30d' }));
app.use(express.static(__dirname, { maxAge: '30d' }));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const user = Object.values(users).find(u => u.token === authHeader.split(' ')[1]);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  if (user.bannedUntil && new Date(user.bannedUntil) <= new Date()) { user.bannedUntil = null; save(path.join(DATA, 'users.json'), users); }
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
  filename: (req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `${req.user.username}_${Date.now()}${ext}`); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Кэш постов
let cachedPosts = [];
let lastCache = 0;
const CACHE_TTL = 5000;

// ===================== API =====================
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
  const decrypted = decrypt(user.encryptedPassword);
  if (decrypted === null || decrypted !== password) {
    return res.status(400).json({ error: 'Неверный логин или пароль' });
  }
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date())
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  user.token = crypto.randomBytes(32).toString('hex');
  user.lastIP = req.ip;
  save(path.join(DATA, 'users.json'), users);
  const { encryptedPassword, token, ...safe } = user;
  res.json({ token: user.token, user: safe });
});

app.get('/api/me', auth, (req, res) => { const { encryptedPassword, token, ...safe } = req.user; res.json(safe); });

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

// ---------- Админка ----------
app.get('/api/stats', (req, res) => {
  res.json({
    users: Object.keys(users).length,
    posts: posts.length
  });
});

app.get('/api/admin/users', auth, requireRole('moderator'), (req, res) => {
  const list = Object.values(users).map(({ encryptedPassword, token, ...u }) => u);
  res.json(list);
});

app.get('/api/users/search', (req, res) => {
  const q = req.query.q?.toLowerCase() || '';
  if (!q) return res.json([]);
  const results = Object.values(users)
    .filter(u => u.username.toLowerCase().includes(q))
    .map(({ encryptedPassword, token, ...u }) => u)
    .slice(0, 10);
  res.json(results);
});

app.post('/api/admin/ban-user', auth, requireRole('moderator'), (req, res) => {
  const { username, duration } = req.body;
  const user = users[username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const parseDuration = (dur) => {
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
  };
  user.bannedUntil = duration ? new Date(Date.now() + parseDuration(duration)).toISOString() : null;
  save(path.join(DATA, 'users.json'), users);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 ${PORT}`));
