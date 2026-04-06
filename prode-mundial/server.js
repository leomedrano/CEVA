const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                users: db.getUsers(),
                realResults: db.getRealResults(),
                config: db.getConfig(),
                designatedAdmin: db.getDesignatedAdmin(),
                allPredictions: db.getAllPredictions()
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.json({ success: false, error: 'Faltan datos' });
        const user = db.getUser(username);
        if (!user) return res.json({ success: false, error: 'Usuario no encontrado' });
        if (user.password !== password) return res.json({ success: false, error: 'Contraseña incorrecta' });
        res.json({ success: true, username: user.username });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || username.length < 2) return res.json({ success: false, error: 'Usuario mínimo 2 caracteres' });
        if (!password || password.length < 3) return res.json({ success: false, error: 'Contraseña mínimo 3 caracteres' });
        const users = db.getUsers();
        const isFirst = users.length === 0;
        const result = db.createUser(username, password);
        if (!result.success) return res.json(result);
        if (isFirst) db.setDesignatedAdmin(username);
        res.json({ success: true, username, isFirstUser: isFirst });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/users', (req, res) => {
    try { res.json({ success: true, users: db.getUsers() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
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
    try { db.deleteUser(req.params.username); res.json({ success: true }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/users', (req, res) => {
    try { db.deleteAllUsers(); res.json({ success: true }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/users/add', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || username.length < 2) return res.json({ success: false, error: 'Nombre mínimo 2 caracteres' });
        if (!password || password.length < 3) return res.json({ success: false, error: 'Contraseña mínimo 3 caracteres' });
        res.json(db.createUser(username, password));
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/predictions/:username', (req, res) => {
    try { res.json({ success: true, predictions: db.getPredictions(req.params.username) }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
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

app.post('/api/predictions/:username/reset', (req, res) => {
    try {
        db.resetPredictions(req.params.username, req.body.matchIds);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/results', (req, res) => {
    try { res.json({ success: true, results: db.getRealResults() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/results', (req, res) => {
    try { db.saveRealResults(req.body.results); res.json({ success: true }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/results', (req, res) => {
    try { db.clearRealResults(); res.json({ success: true }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/config', (req, res) => {
    try { res.json({ success: true, config: db.getConfig() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/config', (req, res) => {
    try { db.saveConfig(req.body); res.json({ success: true }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/config/reset', (req, res) => {
    try { db.resetConfig(); res.json({ success: true, config: db.getConfig() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/export', (req, res) => {
    try { res.json({ success: true, data: db.exportAll() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/import', (req, res) => {
    try { db.importAll(req.body); res.json({ success: true }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('===========================================');
    console.log('  ⚽ Prode Mundial 2026 - Servidor Activo');
    console.log('  URL: http://localhost:' + PORT);
    console.log('  Admin pass: admin2026');
    console.log('===========================================');
    console.log('');
});
