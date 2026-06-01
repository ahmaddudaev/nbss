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
[AVATARS_DIR, BANNERS_DIR, POSTS_IMAGES_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

function loadJSON(file, def = {}) { try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {} return def; }
function saveJSON(file, data) { try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {} }

const ROLES = { OWNER:'owner', HEAD_ADMIN:'head_admin', ADMIN:'admin', MODERATOR:'moderator', EVENT_MODERATOR:'event_moderator', USER:'user' };
const ROLE_HIERARCHY = { [ROLES.OWNER]:5, [ROLES.HEAD_ADMIN]:4, [ROLES.ADMIN]:3, [ROLES.MODERATOR]:2, [ROLES.EVENT_MODERATOR]:1, [ROLES.USER]:0 };

let users = loadJSON(USERS_FILE, {});
users['MrSigma'] = { username:'MrSigma', password: crypto.createHash('sha256').update('Mrbeast132!').digest('hex'), role: ROLES.OWNER, premium:true, verified:true, avatar: users['MrSigma']?.avatar || '', banner: users['MrSigma']?.banner || '', followers: users['MrSigma']?.followers || [], following: users['MrSigma']?.following || [], bannedUntil: null };
Object.values(users).forEach(u => { if (!u.role) u.role = ROLES.USER; if (!u.premium) u.premium = false; if (!u.verified) u.verified = false; if (!u.bannedUntil) u.bannedUntil = null; });
saveJSON(USERS_FILE, users);

let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews:0 });
events.forEach((e,i) => { if (!e.id) e.id = Date.now()+i; });
if (events.some(e => !e.id)) saveJSON(EVENTS_FILE, events);

app.use((req,res,next) => { stats.pageviews++; saveJSON(STATS_FILE, stats); next(); });
const hash = pw => crypto.createHash('sha256').update(pw).digest('hex');

function auth(req, res, next) {
  const header = req.headers.authorization; if (!header?.startsWith('Bearer ')) return res.status(401).json({ error:'Требуется авторизация' });
  const token = header.split(' ')[1]; const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error:'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) <= new Date()) { user.bannedUntil = null; saveJSON(USERS_FILE, users); }
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) return res.status(423).json({ banned:true, bannedUntil:user.bannedUntil });
  req.user = user; next();
}

function requireRole(minRole) { return (req,res,next) => { if (!req.user) return res.status(401).json({ error:'Требуется авторизация' }); const userLevel = ROLE_HIERARCHY[req.user.role] || 0; const required = ROLE_HIERARCHY[minRole] || 0; if (userLevel < required) return res.status(403).json({ error:'Недостаточно прав' }); next(); }; }

const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, POSTS_IMAGES_DIR),
  filename: (req,file,cb) => { const ext = path.extname(file.originalname); cb(null, `${req.user.username}_${Date.now()}${ext}`); }
});
const upload = multer({ storage, limits:{ fileSize:5*1024*1024 } });  // 5MB, без фильтра – принимаем любые форматы

// API: register, login, /me, /users/search, /user/:username – без изменений (полные, как в последнем ответе)
// API: posts (POST с upload.array('images',10), GET, DELETE, like, repost), comments (GET, POST, DELETE), translate, events (GET, POST, DELETE), admin/users, admin/user/:username, stats, dialogs, messages – все без изменений.
// Приводим только ключевые эндпоинты для краткости, но в вашем файле они должны быть полностью.
app.post('/api/posts', auth, upload.array('images', 10), (req, res) => {
  const { text } = req.body; const files = req.files; const images = files ? files.map(f => `/uploads/posts/${f.filename}`) : [];
  if (!text && images.length === 0) return res.status(400).json({ error:'Пустой пост' });
  const post = { id:Date.now(), author:req.user.username, text: text || '', images, likes:[], reposts:[], timestamp:new Date().toISOString() };
  posts.unshift(post); saveJSON(POSTS_FILE, posts);
  res.json({ ok:true, post:{ ...post, authorRole:req.user.role, authorVerified:req.user.verified, authorPremium:req.user.premium } });
});
app.get('/api/posts', (req, res) => {
  const enriched = posts.map(p => { const author = users[p.author] || {}; return { ...p, authorRole:author.role||ROLES.USER, authorVerified:author.verified||false, authorPremium:author.premium||false }; });
  res.json(enriched);
});
// ... (остальные эндпоинты полностью копируются из предыдущего полного server.js)
app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
