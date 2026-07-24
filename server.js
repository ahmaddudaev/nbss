const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'public/uploads/posts');
const SECRET = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'super_secret').digest();
const IV_LEN = 16;
const encrypt = text => { const iv = crypto.randomBytes(IV_LEN); const c = crypto.createCipheriv('aes-256-cbc', SECRET, iv); let e = c.update(text, 'utf8', 'hex'); e += c.final('hex'); return iv.toString('hex') + ':' + e; };
const decrypt = text => { if (!text) return null; const p = text.split(':'); if (p.length !== 2) return null; const d = crypto.createDecipheriv('aes-256-cbc', SECRET, Buffer.from(p[0], 'hex')); let r = d.update(p[1], 'hex', 'utf8'); r += d.final('utf8'); return r; };
const RECAPTCHA = { site: process.env.RECAPTCHA_SITE_KEY, secret: process.env.RECAPTCHA_SECRET };

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

// IP-бан
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const ban = bannedIPs.find(b => b.ip === ip);
  if (ban) {
    if (ban.until && new Date(ban.until) <= new Date()) {
      bannedIPs = bannedIPs.filter(b => b.ip !== ip);
      save(path.join(DATA, 'banned_ips.json'), bannedIPs);
    } else {
      return res.status(423).json({ banned: true, bannedUntil: ban.until || null, message: 'Ваш IP-адрес заблокирован' });
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

async function checkCaptcha(token) {
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `secret=${RECAPTCHA.secret}&response=${token}`
  });
  const data = await res.json();
  return data.success;
}

// API-маршруты: регистрация, вход, посты, админка и т.д. (оставьте их теми же, что в предыдущем полном server.js)
// ... (все маршруты, которые были ранее, включая ban-user, ban-ip, unban-ip, управление пользователями и кодами)

app.listen(PORT, () => console.log(`🚀 ${PORT}`));
