const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== ШИФРОВАНИЕ ПАРОЛЕЙ ======
const ENCRYPTION_KEY = crypto.createHash('sha256').update('NBSS_SUPER_SECRET_KEY_2025!').digest();
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
// ===============================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
const BANNERS_DIR = path.join(UPLOADS_DIR, 'banners');
const POSTS_IMAGES_DIR = path.join(UPLOADS_DIR, 'posts');
[AVATARS_DIR, BANNERS_DIR, POSTS_IMAGES_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function loadJSON(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) {}
  return def;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch(e) {}
}

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

let users = loadJSON(USERS_FILE, {});

// Инициализация владельца
if (!users['MrSigma'] || !users['MrSigma'].encryptedPassword) {
  const ownerPass = 'Mrbeast132!';
  users['MrSigma'] = {
    username: 'MrSigma',
    encryptedPassword: encrypt(ownerPass),
    role: ROLES.OWNER,
    premium: true,
    verified: true,
    tokens: 1000,
    avatar: users['MrSigma']?.avatar || '',
    banner: users['MrSigma']?.banner || '',
    followers: users['MrSigma']?.followers || [],
    following: users['MrSigma']?.following || [],
    bannedUntil: null
  };
}

// Миграция существующих пользователей
Object.values(users).forEach(u => {
  if (!u.role) u.role = ROLES.USER;
  if (!u.premium) u.premium = false;
  if (!u.verified) u.verified = false;
  if (!u.bannedUntil) u.bannedUntil = null;
  if (u.tokens === undefined) u.tokens = 0;
  // Удаляем старые SHA-256 хеши
  if (u.password) delete u.password;
  // Если encryptedPassword отсутствует, оставляем его undefined (не присваиваем пустой пароль!)
  // Пользователь не сможет войти, но пароль не будет утерян.
});
saveJSON(USERS_FILE, users);

let posts = loadJSON(POSTS_FILE, []);
let events = loadJSON(EVENTS_FILE, []);
let comments = loadJSON(COMMENTS_FILE, []);
let stats = loadJSON(STATS_FILE, { pageviews: 0 });
let codes = loadJSON(CODES_FILE, []);

events.forEach((e, i) => { if (!e.id) e.id = Date.now() + i; });
if (events.some(e => !e.id)) saveJSON(EVENTS_FILE, events);

app.use((req, res, next) => {
  stats.pageviews++;
  saveJSON(STATS_FILE, stats);
  next();
});

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const token = header.split(' ')[1];
  const user = Object.values(users).find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Неверный токен' });
  if (user.bannedUntil && new Date(user.bannedUntil) <= new Date()) {
    user.bannedUntil = null;
    saveJSON(USERS_FILE, users);
  }
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date())
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  req.user = user;
  next();
}

function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    const uLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const rLevel = ROLE_HIERARCHY[minRole] || 0;
    if (uLevel < rLevel) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, POSTS_IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.username}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ===================== API =====================
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  if (/\s/.test(username)) return res.status(400).json({ error: 'Логин не должен содержать пробелы' });
  if (username.length < 3) return res.status(400).json({ error: 'Минимум 3 символа' });
  if (users[username]) return res.status(400).json({ error: 'Пользователь уже существует' });
  users[username] = {
    username,
    encryptedPassword: encrypt(password),
    role: ROLES.USER,
    premium: false,
    verified: false,
    tokens: 0,
    avatar: '',
    banner: '',
    followers: [],
    following: [],
    bannedUntil: null
  };
  saveJSON(USERS_FILE, users);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны' });
  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Неверный логин или пароль' });
  // Если у пользователя нет encryptedPassword, вход невозможен
  if (!user.encryptedPassword) return res.status(400).json({ error: 'Неверный логин или пароль' });
  const decrypted = decrypt(user.encryptedPassword);
  if (decrypted !== password) return res.status(400).json({ error: 'Неверный логин или пароль' });
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date())
    return res.status(423).json({ banned: true, bannedUntil: user.bannedUntil });
  const token = crypto.randomBytes(32).toString('hex');
  user.token = token;
  saveJSON(USERS_FILE, users);
  const { encryptedPassword, token: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get('/api/me', auth, (req, res) => {
  const { encryptedPassword, token, ...safeUser } = req.user;
  res.json(safeUser);
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

app.get('/api/user/:username', (req, res) => {
  const user = users[req.params.username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const { encryptedPassword, token, ...safeUser } = user;
  res.json(safeUser);
});

app.get('/api/posts', (req, res) => {
  const enriched = posts.map(p => ({
    ...p,
    authorRole: users[p.author]?.role || 'user',
    authorPremium: users[p.author]?.premium || false,
    authorVerified: users[p.author]?.verified || false
  }));
  res.json(enriched);
});

app.post('/api/posts', auth, upload.array('images', 4), (req, res) => {
  const text = req.body.text || '';
  const images = req.files?.map(f => '/uploads/posts/' + f.filename) || [];
  const post = {
    id: Date.now(),
    author: req.user.username,
    text,
    images,
    timestamp: new Date().toISOString(),
    likes: [],
    reposts: []
  };
  posts.unshift(post);
  saveJSON(POSTS_FILE, posts);
  res.json(post);
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  const isAuthor = post.author === req.user.username;
  const isModerator = ROLE_HIERARCHY[req.user.role] >= ROLE_HIERARCHY[ROLES.MODERATOR];
  if (!isAuthor && !isModerator) return res.status(403).json({ error: 'Недостаточно прав' });
  posts = posts.filter(p => p.id != req.params.id);
  saveJSON(POSTS_FILE, posts);
  res.json({ success: true });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  if (post.author === req.user.username) return res.status(400).json({ error: 'Нельзя лайкать свой пост' });
  if (!post.likes.includes(req.user.username)) {
    post.likes.push(req.user.username);
    saveJSON(POSTS_FILE, posts);
  }
  res.json({ likes: post.likes.length });
});

app.post('/api/posts/:id/repost', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  if (post.author === req.user.username) return res.status(400).json({ error: 'Нельзя репостить свой пост' });
  if (!post.reposts.includes(req.user.username)) {
    post.reposts.push(req.user.username);
    saveJSON(POSTS_FILE, posts);
  }
  res.json({ reposts: post.reposts.length });
});

app.get('/api/posts/:id/comments', (req, res) => {
  const postComments = comments.filter(c => c.postId == req.params.id);
  const enriched = postComments.map(c => ({
    ...c,
    authorRole: users[c.author]?.role || 'user',
    authorPremium: users[c.author]?.premium || false,
    authorVerified: users[c.author]?.verified || false
  }));
  res.json(enriched);
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  const text = req.body.text?.trim();
  if (!text) return res.status(400).json({ error: 'Комментарий не может быть пустым' });
  const comment = {
    id: Date.now(),
    postId: post.id,
    author: req.user.username,
    text,
    timestamp: new Date().toISOString()
  };
  comments.push(comment);
  saveJSON(COMMENTS_FILE, comments);
  res.json(comment);
});

app.delete('/api/comments/:id', auth, (req, res) => {
  const comment = comments.find(c => c.id == req.params.id);
  if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
  const isAuthor = comment.author === req.user.username;
  const isModerator = ROLE_HIERARCHY[req.user.role] >= ROLE_HIERARCHY[ROLES.MODERATOR];
  if (!isAuthor && !isModerator) return res.status(403).json({ error: 'Недостаточно прав' });
  comments = comments.filter(c => c.id != req.params.id);
  saveJSON(COMMENTS_FILE, comments);
  res.json({ success: true });
});

app.get('/api/events', (req, res) => res.json(events));
app.post('/api/events', auth, requireRole(ROLES.EVENT_MODERATOR), (req, res) => {
  const { title, desc } = req.body;
  if (!title) return res.status(400).json({ error: 'Название обязательно' });
  const event = { id: Date.now(), title, desc: desc || '' };
  events.push(event);
  saveJSON(EVENTS_FILE, events);
  res.json(event);
});
app.delete('/api/events/:id', auth, requireRole(ROLES.EVENT_MODERATOR), (req, res) => {
  events = events.filter(e => e.id != req.params.id);
  saveJSON(EVENTS_FILE, events);
  res.json({ success: true });
});

app.get('/api/admin/users', auth, requireRole(ROLES.MODERATOR), (req, res) => {
  const list = Object.values(users).map(({ encryptedPassword, token, ...u }) => u);
  res.json(list);
});

app.post('/api/admin/user/:username', auth, requireRole(ROLES.MODERATOR), (req, res) => {
  const target = users[req.params.username];
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (target.username === 'MrSigma' && req.user.username !== 'MrSigma')
    return res.status(403).json({ error: 'Нельзя редактировать владельца' });
  const editorLevel = ROLE_HIERARCHY[req.user.role] || 0;
  const targetLevel = ROLE_HIERARCHY[target.role] || 0;
  if (editorLevel <= targetLevel && req.user.username !== target.username)
    return res.status(403).json({ error: 'Недостаточно прав' });

  const changes = req.body;
  if (changes.role) {
    if (ROLE_HIERARCHY[changes.role] === undefined) return res.status(400).json({ error: 'Неверная роль' });
    target.role = changes.role;
  }
  if (typeof changes.verified === 'boolean') target.verified = changes.verified;
  if (typeof changes.premium === 'boolean') target.premium = changes.premium;
  if (changes.banUntil !== undefined) target.bannedUntil = changes.banUntil ? new Date(changes.banUntil).toISOString() : null;
  if (changes.delete === true) {
    delete users[target.username];
    saveJSON(USERS_FILE, users);
    return res.json({ success: true, deleted: true });
  }
  saveJSON(USERS_FILE, users);
  const { encryptedPassword, token, ...safeUser } = target;
  res.json(safeUser);
});

// ----- ПРОСМОТР ПАРОЛЯ (только owner) -----
app.get('/api/admin/user/:username/password', auth, requireRole(ROLES.OWNER), (req, res) => {
  if (req.params.username === 'MrSigma') {
    return res.status(403).json({ error: 'Нельзя посмотреть пароль владельца' });
  }
  const target = users[req.params.username];
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (!target.encryptedPassword) {
    return res.status(404).json({ error: 'Пароль не найден (возможно, был утерян при обновлении)' });
  }
  const decrypted = decrypt(target.encryptedPassword);
  if (decrypted === null || decrypted === '') {
    return res.status(404).json({ error: 'Пароль не найден (возможно, был утерян при обновлении)' });
  }
  res.json({ password: decrypted });
});

// ====== ПРОМОКОДЫ ======
app.post('/api/admin/create-code', auth, requireRole(ROLES.HEAD_ADMIN), (req, res) => {
  const { code, reward, amount, maxUses } = req.body;
  if (!code || !reward) return res.status(400).json({ error: 'Код и тип награды обязательны' });
  if (reward === 'tokens' && !amount) return res.status(400).json({ error: 'Укажите количество токенов' });

  codes.push({
    code,
    reward,
    amount: reward === 'tokens' ? amount : undefined,
    maxUses: maxUses || 0,
    usedBy: [],
    createdBy: req.user.username,
    createdAt: new Date().toISOString()
  });
  saveJSON(CODES_FILE, codes);
  res.json({ success: true });
});

app.get('/api/admin/codes', auth, requireRole(ROLES.MODERATOR), (req, res) => {
  res.json(codes);
});

app.delete('/api/admin/codes/:code', auth, requireRole(ROLES.HEAD_ADMIN), (req, res) => {
  const idx = codes.findIndex(c => c.code === req.params.code);
  if (idx === -1) return res.status(404).json({ error: 'Код не найден' });
  codes.splice(idx, 1);
  saveJSON(CODES_FILE, codes);
  res.json({ success: true });
});

app.post('/api/redeem-code', auth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите код' });

  const promo = codes.find(c => c.code === code && !c.usedBy?.includes(req.user.username));
  if (!promo) return res.status(404).json({ error: 'Код не найден или уже использован' });

  if (promo.maxUses > 0 && promo.usedBy.length >= promo.maxUses) {
    return res.status(400).json({ error: 'Лимит использований кода исчерпан' });
  }

  if (promo.reward === 'tokens') {
    req.user.tokens = (req.user.tokens || 0) + promo.amount;
  } else if (promo.reward === 'premium') {
    req.user.premium = true;
    req.user.premiumUntil = promo.premiumUntil || null;
  }

  if (!promo.usedBy) promo.usedBy = [];
  promo.usedBy.push(req.user.username);
  saveJSON(CODES_FILE, codes);
  saveJSON(USERS_FILE, users);

  const { encryptedPassword, token, ...safeUser } = req.user;
  res.json({ success: true, message: 'Код активирован!', user: safeUser });
});

app.post('/api/buy-premium', auth, (req, res) => {
  const PRICE = 1000;
  if (req.user.premium) return res.status(400).json({ error: 'У вас уже есть НБСС+' });
  if ((req.user.tokens || 0) < PRICE) return res.status(400).json({ error: 'Недостаточно токенов. Нужно ' + PRICE });

  req.user.tokens -= PRICE;
  req.user.premium = true;
  req.user.premiumUntil = null;
  saveJSON(USERS_FILE, users);

  const { encryptedPassword, token, ...safeUser } = req.user;
  res.json({ success: true, message: 'НБСС+ активирован!', user: safeUser });
});

app.get('/api/stats', (req, res) => {
  res.json({
    pageviews: stats.pageviews,
    users: Object.keys(users).length,
    posts: posts.length
  });
});

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
