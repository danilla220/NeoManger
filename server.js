const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = new Database('messenger.db');

// Инициализация таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production'; // 🔒 Замените в production

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Авторизация WebSocket-соединения
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = decoded;
    next();
  });
});

// REST API: Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.json({ message: 'Пользователь создан' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Имя занято' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// REST API: Вход
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Неверные данные' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// REST API: История сообщений
app.get('/api/messages', (req, res) => {
  const msgs = db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all();
  res.json(msgs);
});

// WebSocket: Обработка сообщений
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username}`);
  
  socket.on('send_message', (content) => {
    if (!content || typeof content !== 'string') return;
    const stmt = db.prepare('INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)');
    stmt.run(socket.user.id, socket.user.username, content.trim());
    const newMsg = stmt.get(content.trim()); // В реальности лучше вернуть из SELECT
    io.emit('new_message', {
      id: newMsg.lastInsertRowid || Date.now(),
      username: socket.user.username,
      content: content.trim(),
      created_at: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => console.log('User disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
