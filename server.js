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
const SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'super_secret').digest();
const IV_LEN = 16;
const encrypt = text => { const iv = crypto.randomBytes(IV_LEN); const c = crypto.createCipheriv('aes-256-cbc', SECRET, iv); let e = c.update(text, 'utf8', 'hex'); e += c.final('hex'); return iv.toString('hex') + ':' + e; };
const decrypt = text => { if (!text) return null; const p = text.split(':'); if (p.length !== 2) return null; const d = crypto.createDecipheriv('aes-256-cbc', SECRET, Buffer.from(p[0], 'hex')); let r = d.update(p[1], 'hex', 'utf8'); r += d.final('utf8'); return r; };

const load = (file, def = []) => { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : def } catch { return def } };
const save = (file, data) => { try { fs.writeFileSync(file, JSON.stringify(data, null, 2)) } catch {} };

[DATA, UPLOADS].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) });

let users = load(path.join(DATA, 'users.json'), {});
let posts = load(path.join(DATA, 'posts.json'), []);
let events = load(path.join(DATA, 'events.json'), []);
let comments = load(path.join(DATA, 'comments.json'), []);
let codes = load(path.join(DATA, 'codes.json'), []);
let bannedIPs = load(path.join(DATA, 'banned_ips.json'), []);

if (!users['MrSigma']) {
  users['MrSigma'] = { username: 'MrSigma', encryptedPassword: encrypt('Mrbeast132!'), role: 'owner', premium: true, verified: true, tokens: 1000, avatar: '', banner: '', followers: [], following: [], bannedUntil: null, lastIP: null };
}
Object.values(users).forEach(u => {
  u.role = u.role || 'user'; u.premium = u.premium || false; u.verified = u.verified || false; u.tokens = u.tokens || 0;
  if (!u.encryptedPassword) u.encryptedPassword = encrypt('');
});
save(path.join(DATA, 'users.json'), users);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// IP-бан проверка
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
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const user = Object.values(users).find(u => u.token === auth.split(' ')[1]);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  if (user.bannedUntil && new Date(user.bannedUntil) <= new Date()) { user.bannedUntil = null; save(path.join(DATA, 'users.json'), users); }
  req.user = user;
  next();
};

const role = (min) => (req, res, next) => {
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

// Cloudflare Turnstile проверка
async function checkTurnstile(token) {
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET, response: token })
  });
  const data = await res.json();
  return data.success;
}

// === API ===
app.post('/api/register', async (req, res) => {
  const { username, password, turnstileToken } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  if (users[username]) return res.status(400).json({ error: 'Пользователь уже существует' });
  if (!(await checkTurnstile(turnstileToken))) return res.status(400).json({ error: 'Ошибка проверки Turnstile' });
  users[username] = { username, encryptedPassword: encrypt(password), role: 'user', premium: false, verified: true, tokens: 0, avatar:'', banner:'', followers:[], following:[], bannedUntil:null, lastIP: null };
  save(path.join(DATA, 'users.json'), users);
  res.json({ success: true, message: 'Аккаунт создан' });
});

app.post('/api/login', async (req, res) => {
  const { username, password, turnstileToken } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  if (!(await checkTurnstile(turnstileToken))) return res.status(400).json({ error: 'Ошибка проверки Turnstile' });
  const user = users[username];
  if (!user || decrypt(user.encryptedPassword) !== password) return res.status(400).json({ error: 'Неверный логин или пароль' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  user.token = crypto.randomBytes(32).toString('hex');
  user.lastIP = req.ip;
  save(path.join(DATA, 'users.json'), users);
  const { encryptedPassword, token, ...safe } = user;
  res.json({ token: user.token, user: safe });
});

app.get('/api/me', auth, (req, res) => { const { encryptedPassword, token, ...safe } = req.user; res.json(safe); });

app.get('/api/posts', (req, res) => res.json(posts.map(p => ({ ...p, authorRole: users[p.author]?.role, authorPremium: users[p.author]?.premium, authorVerified: users[p.author]?.verified }))));
app.post('/api/posts', auth, upload.array('images', 4), (req, res) => {
  const post = { id: Date.now(), author: req.user.username, text: req.body.text || '', images: req.files?.map(f => '/uploads/posts/' + f.filename) || [], timestamp: new Date().toISOString(), likes: [], reposts: [] };
  posts.unshift(post); save(path.join(DATA, 'posts.json'), posts); res.json(post);
});

// Гибкая длительность бана
function parseDuration(dur) {
  if (!dur) return 0;
  if (typeof dur === 'number') return dur * 60 * 1000; // минуты
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

app.post('/api/admin/ban-user', auth, role('moderator'), (req, res) => {
  const { username, duration } = req.body;
  const user = users[username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  user.bannedUntil = duration ? new Date(Date.now() + parseDuration(duration)).toISOString() : null;
  save(path.join(DATA, 'users.json'), users);
  res.json({ success: true });
});

app.post('/api/admin/ban-ip', auth, role('moderator'), (req, res) => {
  const { username, duration } = req.body;
  const user = users[username];
  if (!user?.lastIP) return res.status(400).json({ error: 'Нет IP' });
  bannedIPs = bannedIPs.filter(b => b.ip !== user.lastIP);
  bannedIPs.push({ ip: user.lastIP, until: duration ? new Date(Date.now() + parseDuration(duration)).toISOString() : null });
  save(path.join(DATA, 'banned_ips.json'), bannedIPs);
  res.json({ success: true });
});

app.post('/api/admin/unban-ip', auth, role('moderator'), (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP не указан' });
  bannedIPs = bannedIPs.filter(b => b.ip !== ip);
  save(path.join(DATA, 'banned_ips.json'), bannedIPs);
  res.json({ success: true });
});

app.get('/api/admin/banned-ips', auth, role('moderator'), (req, res) => res.json(bannedIPs));

// Дополнительные маршруты (статистика, коды) могут быть добавлены позже по тому же шаблону

app.listen(PORT, () => console.log(`🚀 ${PORT}`));
