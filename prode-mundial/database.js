const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'prode.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS predictions (
        username TEXT NOT NULL,
        match_id TEXT NOT NULL,
        home_score TEXT DEFAULT '',
        away_score TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (username, match_id),
        FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS real_results (
        match_id TEXT PRIMARY KEY,
        home_score TEXT DEFAULT '',
        away_score TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);

const defaultConfig = {
    companyName: 'Mi Empresa',
    companyLogo: '',
    primaryColor: '#1a472a',
    primaryLight: '#2d6a4f',
    primaryDark: '#0d2818',
    accentColor: '#d4a017',
    accentLight: '#f0c040'
};

const existingConfig = db.prepare('SELECT COUNT(*) as count FROM config').get();
if (existingConfig.count === 0) {
    const insertConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaultConfig)) {
        insertConfig.run(key, value);
    }
}

const dbFunctions = {
    getUsers() {
        return db.prepare('SELECT username FROM users ORDER BY created_at ASC').all().map(r => r.username);
    },
    getUser(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },
    createUser(username, password) {
        try {
            db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, password);
            return { success: true };
        } catch (e) {
            if (e.message.includes('UNIQUE')) return { success: false, error: 'Usuario ya existe' };
            throw e;
        }
    },
    updateUser(oldUsername, newUsername, password) {
        const transaction = db.transaction(() => {
            if (oldUsername !== newUsername) {
                const existing = db.prepare('SELECT username FROM users WHERE username = ?').get(newUsername);
                if (existing) return { success: false, error: 'Nombre ya existe' };
                db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(newUsername, password);
                db.prepare('UPDATE predictions SET username = ? WHERE username = ?').run(newUsername, oldUsername);
                db.prepare('DELETE FROM users WHERE username = ?').run(oldUsername);
                const admin = db.prepare("SELECT value FROM app_settings WHERE key = 'designated_admin'").get();
                if (admin && admin.value === oldUsername) {
                    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('designated_admin', ?)").run(newUsername);
                }
            } else {
                if (password) {
                    db.prepare('UPDATE users SET password = ? WHERE username = ?').run(password, oldUsername);
                }
            }
            return { success: true };
        });
        return transaction();
    },
    deleteUser(username) {
        db.transaction(() => {
            db.prepare('DELETE FROM predictions WHERE username = ?').run(username);
            db.prepare('DELETE FROM users WHERE username = ?').run(username);
        })();
    },
    deleteAllUsers() {
        db.transaction(() => {
            db.prepare('DELETE FROM predictions').run();
            db.prepare('DELETE FROM users').run();
            db.prepare("DELETE FROM app_settings WHERE key = 'designated_admin'").run();
        })();
    },
    getPredictions(username) {
        const rows = db.prepare('SELECT match_id, home_score, away_score FROM predictions WHERE username = ?').all(username);
        const result = {};
        rows.forEach(r => { result[r.match_id] = { home: r.home_score, away: r.away_score }; });
        return result;
    },
    getAllPredictions() {
        const rows = db.prepare('SELECT username, match_id, home_score, away_score FROM predictions').all();
        const result = {};
        rows.forEach(r => {
            if (!result[r.username]) result[r.username] = {};
            result[r.username][r.match_id] = { home: r.home_score, away: r.away_score };
        });
        return result;
    },
    savePrediction(username, matchId, home, away) {
        db.prepare("INSERT OR REPLACE INTO predictions (username, match_id, home_score, away_score, updated_at) VALUES (?, ?, ?, ?, datetime('now'))").run(username, matchId, home, away);
    },
    resetPredictions(username, matchIds) {
        const del = db.prepare('DELETE FROM predictions WHERE username = ? AND match_id = ?');
        db.transaction(() => { matchIds.forEach(id => del.run(username, id)); })();
    },
    getRealResults() {
        const rows = db.prepare('SELECT match_id, home_score, away_score FROM real_results').all();
        const result = {};
        rows.forEach(r => { result[r.match_id] = { home: r.home_score, away: r.away_score }; });
        return result;
    },
    saveRealResults(results) {
        const insert = db.prepare('INSERT OR REPLACE INTO real_results (match_id, home_score, away_score) VALUES (?, ?, ?)');
        db.transaction(() => {
            for (const [matchId, scores] of Object.entries(results)) {
                if (scores.home !== '' || scores.away !== '') {
                    insert.run(matchId, scores.home || '', scores.away || '');
                } else {
                    db.prepare('DELETE FROM real_results WHERE match_id = ?').run(matchId);
                }
            }
        })();
    },
    clearRealResults() {
        db.prepare('DELETE FROM real_results').run();
    },
    getConfig() {
        const rows = db.prepare('SELECT key, value FROM config').all();
        const result = {};
        rows.forEach(r => { result[r.key] = r.value; });
        return {
            companyName: result.companyName || defaultConfig.companyName,
            companyLogo: result.companyLogo || '',
            primaryColor: result.primaryColor || defaultConfig.primaryColor,
            primaryLight: result.primaryLight || defaultConfig.primaryLight,
            primaryDark: result.primaryDark || defaultConfig.primaryDark,
            accentColor: result.accentColor || defaultConfig.accentColor,
            accentLight: result.accentLight || defaultConfig.accentLight
        };
    },
    saveConfig(config) {
        const insert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        db.transaction(() => {
            for (const [key, value] of Object.entries(config)) {
                insert.run(key, value || '');
            }
        })();
    },
    resetConfig() {
        const insert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        db.transaction(() => {
            for (const [key, value] of Object.entries(defaultConfig)) {
                insert.run(key, value);
            }
        })();
    },
    getDesignatedAdmin() {
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'designated_admin'").get();
        return row ? row.value : null;
    },
    setDesignatedAdmin(username) {
        db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('designated_admin', ?)").run(username);
    },
    exportAll() {
        return {
            users: db.prepare('SELECT * FROM users').all(),
            predictions: db.prepare('SELECT * FROM predictions').all(),
            real_results: db.prepare('SELECT * FROM real_results').all(),
            config: db.prepare('SELECT * FROM config').all(),
            app_settings: db.prepare('SELECT * FROM app_settings').all()
        };
    },
    importAll(data) {
        db.transaction(() => {
            db.prepare('DELETE FROM predictions').run();
            db.prepare('DELETE FROM users').run();
            db.prepare('DELETE FROM real_results').run();
            db.prepare('DELETE FROM config').run();
            db.prepare('DELETE FROM app_settings').run();
            if (data.users) {
                const ins = db.prepare('INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)');
                data.users.forEach(u => ins.run(u.username, u.password, u.created_at || new Date().toISOString()));
            }
            if (data.predictions) {
                const ins = db.prepare('INSERT INTO predictions (username, match_id, home_score, away_score, updated_at) VALUES (?, ?, ?, ?, ?)');
                data.predictions.forEach(p => ins.run(p.username, p.match_id, p.home_score || '', p.away_score || '', p.updated_at || new Date().toISOString()));
            }
            if (data.real_results) {
                const ins = db.prepare('INSERT INTO real_results (match_id, home_score, away_score) VALUES (?, ?, ?)');
                data.real_results.forEach(r => ins.run(r.match_id, r.home_score || '', r.away_score || ''));
            }
            if (data.config) {
                const ins = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)');
                data.config.forEach(c => ins.run(c.key, c.value || ''));
            }
            if (data.app_settings) {
                const ins = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)');
                data.app_settings.forEach(s => ins.run(s.key, s.value || ''));
            }
        })();
    }
};

module.exports = dbFunctions;
