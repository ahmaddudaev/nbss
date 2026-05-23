const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');  // для перевода

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.get('/server.js', (req, res) => res.status(404).json({ error: 'Not found' }));

// Папки и хранилище (без изменений)
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// ... (функции loadJSON, saveJSON, users, posts, events, comments, messages, stats) без изменений

// ========== ПЕРЕВОД ==========
app.post('/api/translate', async (req, res) => {
  const { text, target } = req.body;
  if (!text || !target) return res.status(400).json({ error: 'Не указан текст или язык' });

  // Используем неофициальный Google Translate API (работает без ключа)
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

  https.get(url, (resp) => {
    let data = '';
    resp.on('data', (chunk) => data += chunk);
    resp.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const translation = parsed[0]?.map(x => x[0]).join('');
        res.json({ translation: translation || text });
      } catch (e) {
        res.status(500).json({ error: 'Ошибка перевода' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: 'Сервис перевода недоступен' });
  });
});

// ... (все остальные маршруты: /register, /login, /me, /posts, /comments, /admin, /events, /stats, /messages, /dialogs, /avatar, /banner)
// Оставьте их без изменений, они уже даны ранее

app.listen(PORT, () => console.log(`🚀 НБСС запущен на порту ${PORT}`));
