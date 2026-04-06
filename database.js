const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'prode.db'));

// Habilitar WAL para mejor rendimiento concurrente
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_designated_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    match_id TEXT NOT NULL,
    home_score TEXT DEFAULT '',
    away_score TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(username, match_id),
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS real_results (
    match_id TEXT PRIMARY KEY,
    home_score TEXT DEFAULT '',
    away_score TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Funciones de usuario
const userQueries = {
  getAll: db.prepare('SELECT username FROM users ORDER BY id'),
  getByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  create: db.prepare('INSERT INTO users (username, password, is_designated_admin) VALUES (?, ?, ?)'),
  updatePassword: db.prepare('UPDATE users SET password = ? WHERE username = ?'),
  updateUsername: db.prepare('UPDATE users SET username = ? WHERE username = ?'),
  delete: db.prepare('DELETE FROM users WHERE username = ?'),
  countAll: db.prepare('SELECT COUNT(*) as count FROM users'),
  getAdmin: db.prepare('SELECT username FROM users WHERE is_designated_admin = 1 LIMIT 1'),
  setAdmin: db.prepare('UPDATE users SET is_designated_admin = 1 WHERE username = ?'),
  clearAdmin: db.prepare('UPDATE users SET is_designated_admin = 0'),
  deleteAll: db.prepare('DELETE FROM users'),
  updateUsernameAndPassword: db.prepare('UPDATE users SET username = ?, password = ? WHERE username = ?')
};

// Funciones de predicciones
const predQueries = {
  getByUser: db.prepare('SELECT match_id, home_score, away_score FROM predictions WHERE username = ?'),
  upsert: db.prepare(`
    INSERT INTO predictions (username, match_id, home_score, away_score, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(username, match_id)
    DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score, updated_at = datetime('now')
  `),
  deleteByUser: db.prepare('DELETE FROM predictions WHERE username = ?'),
  deleteByUserUnlocked: db.prepare('DELETE FROM predictions WHERE username = ? AND match_id = ?'),
  deleteAll: db.prepare('DELETE FROM predictions'),
  updateUsername: db.prepare('UPDATE predictions SET username = ? WHERE username = ?')
};

// Funciones de resultados reales
const resultQueries = {
  getAll: db.prepare('SELECT match_id, home_score, away_score FROM real_results'),
  upsert: db.prepare(`
    INSERT INTO real_results (match_id, home_score, away_score, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(match_id)
    DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score, updated_at = datetime('now')
  `),
  deleteAll: db.prepare('DELETE FROM real_results')
};

// Funciones de configuración
const configQueries = {
  get: db.prepare('SELECT value FROM config WHERE key = ?'),
  upsert: db.prepare(`
    INSERT INTO config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `),
  getAll: db.prepare('SELECT key, value FROM config')
};

module.exports = {
  db,
  userQueries,
  predQueries,
  resultQueries,
  configQueries
};
