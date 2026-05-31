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

// Папки
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const BANS_FILE = path.join(DATA_DIR, 'bans.json');
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

// ========== РОЛИ ==========
const ROLES = {
  OWNER: 'owner',
  HEAD_ADMIN: 'head_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  EVENT_MODERATOR: 'event_moderator',
  USER: 'user'
};

const ROLE_HIERARCHY = {
  [ROLES.OWNER]: 5,
  [ROLES.HEAD_ADMIN]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.MODERATOR]: 2,
  [ROLES.EVENT_MODERATOR]: 1,
  [ROLES.USER]: 0
};

// Инициализация пользователей
let users = loadJSON(USERS_FILE, {});
// Принудительно создаём Владельца
const ownerPassword = crypto.createHash('sha256').update('Mrbeast132!').digest('hex');
users['MrSigma'] = {
  username: 'MrSigma',
  password: ownerPassword,
  role: ROLES.OWNER,
  premium: true,
  verified: true,
  avatar: users['MrSigma']?.avatar || '',
  banner: users['MrSigma']?.banner || '',
  followers: users['MrSigma']?.followers || [],
  following: users['MrSigma']?.following || [],
  bannedUntil: null
};
// Добавляем роль всем старым пользователям, если её нет
Object.values(users).forEach(u => {
  if (!u.role) u.role = ROLES.USER;
  if (!u.premium) u.premium = false;
  if (!u.verified) u.verified = false;
  if (!u.bannedUntil) u.bannedUntil = null;
});
saveJSON(USERS_FILE, users);

let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);
let bans = loadJSON(BANS_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews: 0 });

// ID старым ивентам
events.forEach((e, i) => { if (!e.id) e.id = Date.now() + i; });
if (events.some(e => !e.id)) saveJSON(EVENTS_FILE, events);

app.use((req, res, next) => { stats.pageviews++; saveJSON(STATS_FILE, stats); next(); });

const hash = pw => crypto.createHash('sha256').update(pw).digest('hex');

// Middleware авторизации
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const token = header.split(' ')[1];
  const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return res.status(403).json({ error: 'Ваш аккаунт забанен до ' + new Date(user.bannedUntil).toLocaleString() });
  }
  req.user = user;
  next();
}

// Middleware проверки роли (минимальный уровень)
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
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

// ---------- API ----------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (/\s/.test(username)) return res.status(400).json({ error: 'Логин не должен содержать пробелы' });
  if (users[username]) return res.status(400).json({ error: 'Пользователь уже существует' });
  users[username] = {
    username,
    password: hash(password),
    role: ROLES.USER,
    premium: false,
    verified: false,
    avatar: '',
    banner: '',
    followers: [],
    following: [],
    bannedUntil: null
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
      role: user.role,
      premium: user.premium,
      verified: user.verified,
      avatar: user.avatar,
      banner: user.banner,
      followers: (user.followers || []).length,
      following: (user.following || []).length
    }
  });
});

app.get('/api/me', auth, (req, res) => {
  const user = users[req.user.username];
  res.json({
    username: user.username,
    role: user.role,
    premium: user.premium,
    verified: user.verified,
    avatar: user.avatar || '',
    banner: user.banner || '',
    followers: (user.followers || []).length,
    following: (user.following || []).length
  });
});

app.get('/api/users/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json([]);
  const result = Object.values(users)
    .filter(u => u.username.toLowerCase().includes(q))
    .map(u => ({ username: u.username, role: u.role, verified: u.verified, premium: u.premium }));
  res.json(result);
});

app.get('/api/user/:username', (req, res) => {
  const user = users[req.params.username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({
    username: user.username,
    role: user.role,
    premium: user.premium,
    verified: user.verified,
    avatar: user.avatar,
    banner: user.banner,
    followers: (user.followers || []).length,
    following: (user.following || []).length
  });
});

app.post('/api/posts', auth, upload.single('image'), (req, res) => {
  const { text } = req.body;
  const image = req.file ? `/uploads/posts/${req.file.filename}` : null;
  if (!text && !image) return res.status(400).json({ error: 'Пустой пост' });
  const post = {
    id: Date.now(),
    author: req.user.username,
    text: text || '',
    image,
    likes: [],
    reposts: [],
    timestamp: new Date().toISOString()
  };
  posts.unshift(post);
  saveJSON(POSTS_FILE, posts);
  res.json({
    ok: true,
    post: { ...post, authorRole: req.user.role, authorVerified: req.user.verified, authorPremium: req.user.premium }
  });
});

app.get('/api/posts', (req, res) => {
  const enriched = posts.map(p => {
    const author = users[p.author] || {};
    return {
      ...p,
      authorRole: author.role || ROLES.USER,
      authorVerified: author.verified || false,
      authorPremium: author.premium || false
    };
  });
  res.json(enriched);
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  const isOwnerOrAdmin = [ROLES.OWNER, ROLES.HEAD_ADMIN, ROLES.ADMIN, ROLES.MODERATOR].includes(req.user.role);
  if (!isOwnerOrAdmin && req.user.username !== post.author) {
    return res.status(403).json({ error: 'Нет прав на удаление' });
  }
  comments = comments.filter(c => c.postId != req.params.id);
  posts = posts.filter(p => p.id != req.params.id);
  saveJSON(POSTS_FILE, posts);
  saveJSON(COMMENTS_FILE, comments);
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  if (req.user.username === post.author) return res.status(400).json({ error: 'Нельзя лайкать свои посты' });
  const idx = post.likes.indexOf(req.user.username);
  if (idx >= 0) post.likes.splice(idx, 1);
  else post.likes.push(req.user.username);
  saveJSON(POSTS_FILE, posts);
  res.json({ ok: true });
});

app.post('/api/posts/:id/repost', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  if (req.user.username === post.author) return res.status(400).json({ error: 'Нельзя репостить свои посты' });
  if (!post.reposts.includes(req.user.username)) post.reposts.push(req.user.username);
  saveJSON(POSTS_FILE, posts);
  res.json({ ok: true });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const postComments = comments.filter(c => c.postId == req.params.id);
  const enriched = postComments.map(c => {
    const author = users[c.author] || {};
    return { ...c, authorRole: author.role || ROLES.USER, authorVerified: author.verified || false, authorPremium: author.premium || false };
  });
  res.json(enriched);
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Пустой комментарий' });
  const comment = {
    id: Date.now(),
    postId: Number(req.params.id),
    author: req.user.username,
    text,
    timestamp: new Date().toISOString()
  };
  comments.unshift(comment);
  saveJSON(COMMENTS_FILE, comments);
  res.json({ ok: true, comment: { ...comment, authorRole: req.user.role, authorVerified: req.user.verified, authorPremium: req.user.premium } });
});

app.delete('/api/comments/:id', auth, (req, res) => {
  const comment = comments.find(c => c.id == req.params.id);
  if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
  const post = posts.find(p => p.id == comment.postId);
  const canDelete = req.user.username === comment.author ||
    (post && req.user.username === post.author) ||
    [ROLES.OWNER, ROLES.HEAD_ADMIN, ROLES.ADMIN, ROLES.MODERATOR].includes(req.user.role);
  if (!canDelete) return res.status(403).json({ error: 'Нет прав на удаление комментария' });
  comments = comments.filter(c => c.id != req.params.id);
  saveJSON(COMMENTS_FILE, comments);
  res.json({ ok: true });
});

app.post('/api/translate', (req, res) => {
  const { text, target } = req.body;
  if (!text || !target) return res.status(400).json({ error: 'Не указан текст или язык' });
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  https.get(url, (resp) => {
    let data = '';
    resp.on('data', (chunk) => data += chunk);
    resp.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const translation = parsed[0]?.map(x => x[0]).join('');
        res.json({ translation: translation || text });
      } catch (e) { res.status(500).json({ error: 'Ошибка перевода' }); }
    });
  }).on('error', () => res.status(500).json({ error: 'Сервис перевода недоступен' }));
});

app.get('/api/events', (req, res) => res.json(events));
app.post('/api/events', auth, requireRole(ROLES.EVENT_MODERATOR), (req, res) => {
  const { title, desc } = req.body;
  if (!title) return res.status(400).json({ error: 'Укажите название' });
  const event = { id: Date.now(), title, desc };
  events.push(event);
  saveJSON(EVENTS_FILE, events);
  res.json({ ok: true, event });
});
app.delete('/api/events/:id', auth, requireRole(ROLES.EVENT_MODERATOR), (req, res) => {
  const idx = events.findIndex(e => e.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Ивент не найден' });
  events.splice(idx, 1);
  saveJSON(EVENTS_FILE, events);
  res.json({ ok: true });
});

app.get('/api/admin/users', auth, requireRole(ROLES.MODERATOR), (req, res) => {
  res.json(Object.values(users).map(u => ({
    username: u.username,
    role: u.role,
    verified: u.verified,
    premium: u.premium
  })));
});

app.post('/api/admin/user/:username', auth, (req, res) => {
  const targetUser = users[req.params.username];
  if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });
  const { verified, premium, role, banUntil, delete: del } = req.body;
  const currentUser = req.user;

  if (del) {
    if (targetUser.username === 'MrSigma') return res.status(400).json({ error: 'Нельзя удалить основателя' });
    if (ROLE_HIERARCHY[targetUser.role] >= ROLE_HIERARCHY[currentUser.role]) return res.status(403).json({ error: 'Нельзя удалить равного или выше' });
    delete users[targetUser.username];
    posts = posts.filter(p => p.author !== targetUser.username);
    comments = comments.filter(c => c.author !== targetUser.username);
    messages = messages.filter(m => m.from !== targetUser.username && m.to !== targetUser.username);
    saveJSON(USERS_FILE, users);
    saveJSON(POSTS_FILE, posts);
    saveJSON(COMMENTS_FILE, comments);
    saveJSON(MESSAGES_FILE, messages);
    return res.json({ ok: true });
  }

  if (role !== undefined) {
    if (targetUser.username === 'MrSigma' && role !== ROLES.OWNER) return res.status(400).json({ error: 'Нельзя изменить роль основателя' });
    if (ROLE_HIERARCHY[targetUser.role] >= ROLE_HIERARCHY[currentUser.role]) return res.status(403).json({ error: 'Нельзя изменить роль равного или выше' });
    if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[currentUser.role]) return res.status(403).json({ error: 'Нельзя назначить роль выше своей' });
    targetUser.role = role;
  }
  if (verified !== undefined) targetUser.verified = verified;
  if (premium !== undefined) targetUser.premium = premium;
  if (banUntil !== undefined) {
    if (ROLE_HIERARCHY[targetUser.role] >= ROLE_HIERARCHY[currentUser.role]) return res.status(403).json({ error: 'Нельзя забанить равного или выше' });
    targetUser.bannedUntil = banUntil;
  }

  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  res.json({
    users: Object.keys(users).length,
    posts: posts.length,
    comments: comments.length,
    pageviews: stats.pageviews,
    online: Math.floor(Math.random() * 5) + 1
  });
});

// Сообщения
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
  const result = Array.from(dialogs.values()).sort((a, b) => b.timestamp - a.timestamp);
  result.forEach(d => {
    const u = users[d.username];
    if (u) { d.role = u.role; d.premium = u.premium; d.verified = u.verified; }
  });
  res.json(result);
});

app.get('/api/messages', auth, (req, res) => {
  const partner = req.query.with;
  if (!partner) return res.status(400).json({ error: 'Не указан собеседник' });
  const user = req.user.username;
  const conversation = messages
    .filter(m => (m.from === user && m.to === partner) || (m.from === partner && m.to === user))
    .sort((a, b) => a.timestamp - b.timestamp);
  res.json(conversation);
});

app.post('/api/messages', auth, (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'Заполните получателя и текст' });
  const msg = { id: Date.now(), from: req.user.username, to, text, timestamp: new Date().toISOString() };
  messages.push(msg);
  saveJSON(MESSAGES_FILE, messages);
  res.json({ ok: true, message: msg });
});

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
