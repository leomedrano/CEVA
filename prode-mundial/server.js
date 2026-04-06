const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// API ROUTES
// ============================================================

// --- Estado inicial (carga todo de una vez) ---
app.get('/api/state', (req, res) => {
    try {
        const users = db.getUsers();
        const realResults = db.getRealResults();
        const config = db.getConfig();
        const designatedAdmin = db.getDesignatedAdmin();
        const allPredictions = db.getAllPredictions();

        res.json({
            success: true,
            data: {
                users,
                realResults,
                config,
                designatedAdmin,
                allPredictions
            }
        });
    } catch (e) {
        console.error('GET /api/state error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Autenticación ---
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.json({ success: false, error: 'Faltan datos' });
        }
        const user = db.getUser(username);
        if (!user) {
            return res.json({ success: false, error: 'Usuario no encontrado' });
        }
        if (user.password !== password) {
            return res.json({ success: false, error: 'Contraseña incorrecta' });
        }
        res.json({ success: true, username: user.username });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || username.length < 2) {
            return res.json({ success: false, error: 'Usuario mínimo 2 caracteres' });
        }
        if (!password || password.length < 3) {
            return res.json({ success: false, error: 'Contraseña mínimo 3 caracteres' });
        }

        const users = db.getUsers();
        const isFirst = users.length === 0;

        const result = db.createUser(username, password);
        if (!result.success) {
            return res.json(result);
        }

        if (isFirst) {
            db.setDesignatedAdmin(username);
        }

        res.json({
            success: true,
            username,
            isFirstUser: isFirst
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Usuarios ---
app.get('/api/users', (req, res) => {
    try {
        res.json({ success: true, users: db.getUsers() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/users/:username', (req, res) => {
    try {
        const { newUsername, password } = req.body;
        const result = db.updateUser(req.params.username, newUsername || req.params.username, password);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/users/:username', (req, res) => {
    try {
        db.deleteUser(req.params.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/users', (req, res) => {
    try {
        db.deleteAllUsers();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/users/add', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || username.length < 2) {
            return res.json({ success: false, error: 'Nombre mínimo 2 caracteres' });
        }
        if (!password || password.length < 3) {
            return res.json({ success: false, error: 'Contraseña mínimo 3 caracteres' });
        }
        const result = db.createUser(username, password);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Predicciones ---
app.get('/api/predictions/:username', (req, res) => {
    try {
        res.json({ success: true, predictions: db.getPredictions(req.params.username) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/predictions/:username', (req, res) => {
    try {
        const { matchId, home, away } = req.body;
        db.savePrediction(req.params.username, matchId, home || '', away || '');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/predictions/:username/bulk', (req, res) => {
    try {
        const { predictions } = req.body;
        db.savePredictions(req.params.username, predictions);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/predictions/:username/reset', (req, res) => {
    try {
        const { matchIds } = req.body;
        db.resetPredictions(req.params.username, matchIds);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Resultados Reales ---
app.get('/api/results', (req, res) => {
    try {
        res.json({ success: true, results: db.getRealResults() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/results', (req, res) => {
    try {
        const { results } = req.body;
        db.saveRealResults(results);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/results', (req, res) => {
    try {
        db.clearRealResults();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Configuración ---
app.get('/api/config', (req, res) => {
    try {
        res.json({ success: true, config: db.getConfig() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/config', (req, res) => {
    try {
        db.saveConfig(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/config/reset', (req, res) => {
    try {
        db.resetConfig();
        res.json({ success: true, config: db.getConfig() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Admin ---
app.get('/api/admin/designated', (req, res) => {
    try {
        res.json({ success: true, admin: db.getDesignatedAdmin() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/admin/designated', (req, res) => {
    try {
        db.setDesignatedAdmin(req.body.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Export/Import ---
app.get('/api/export', (req, res) => {
    try {
        res.json({ success: true, data: db.exportAll() });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/import', (req, res) => {
    try {
        db.importAll(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Ranking (calculado en servidor para consistencia) ---
app.get('/api/ranking', (req, res) => {
    try {
        const users = db.getUsers();
        const allPreds = db.getAllPredictions();
        const reals = db.getRealResults();

        const ranking = users.map(username => {
            const preds = allPreds[username] || {};
            let total = 0, exact = 0, winner = 0, miss = 0, pending = 0, predicted = 0;

            // Necesitamos la lista de partidos — la mandamos desde el cliente
            // o la tenemos hardcodeada. Para simplificar, iteramos las predicciones
            // y resultados disponibles
            for (const matchId of Object.keys(reals)) {
                const r = reals[matchId];
                const p = preds[matchId];

                if (!r || r.home === '' || r.away === '') continue;

                const rh = parseInt(r.home), ra = parseInt(r.away);
                if (isNaN(rh) || isNaN(ra)) continue;

                if (!p || p.home === '' || p.away === '') {
                    miss++;
                    continue;
                }

                predicted++;
                const ph = parseInt(p.home), pa = parseInt(p.away);
                if (isNaN(ph) || isNaN(pa)) { miss++; continue; }

                if (ph === rh && pa === ra) { exact++; total += 3; }
                else if (Math.sign(ph - pa) === Math.sign(rh - ra)) { winner++; total += 1; }
                else { miss++; }
            }

            // Contar predicciones totales (incluyendo partidos sin resultado)
            let totalPredicted = 0;
            for (const mid of Object.keys(preds)) {
                if (preds[mid] && preds[mid].home !== '' && preds[mid].away !== '') totalPredicted++;
            }

            return { name: username, total, exact, winner, miss, pending, predicted: totalPredicted };
        }).sort((a, b) => b.total - a.total || b.exact - a.exact || b.winner - a.winner || a.name.localeCompare(b.name));

        res.json({ success: true, ranking });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Catch-all: servir index.html para cualquier ruta no-API
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   ⚽ Prode Mundial 2026 - Servidor Activo   ║
║                                              ║
║   URL Local:  http://localhost:${PORT}          ║
║   Red Local:  http://<tu-ip>:${PORT}           ║
║                                              ║
║   Admin pass: admin2026                      ║
╚══════════════════════════════════════════════╝
    `);
});
