const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const SECRET = "saas-secret";
const DB = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static('public'));

function readDB() {
    return JSON.parse(fs.readFileSync(DB));
}

function writeDB(data) {
    fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function getTenant(req) {
    return req.headers['x-tenant'] || "demo";
}

function auth(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: "Token inválido" });
    }
}

app.post('/api/register', (req, res) => {
    const { user, pass } = req.body;
    const tenant = getTenant(req);
    const db = readDB();

    if (!db.tenants[tenant]) {
        db.tenants[tenant] = { users: {}, results: {} };
    }

    db.tenants[tenant].users[user] = {
        pass,
        isAdmin: false,
        predictions: {}
    };

    writeDB(db);
    res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const tenant = getTenant(req);
    const db = readDB();

    const u = db.tenants[tenant]?.users[user];
    if (!u || u.pass !== pass) {
        return res.status(401).json({ error: "Login inválido" });
    }

    const token = jwt.sign({ user, tenant, isAdmin: u.isAdmin }, SECRET);

    res.json({
        token,
        predictions: u.predictions,
        isAdmin: u.isAdmin
    });
});

app.post('/api/save', auth, (req, res) => {
    const db = readDB();
    const { tenant, user } = req.user;

    db.tenants[tenant].users[user].predictions = req.body.predictions;
    writeDB(db);

    res.json({ ok: true });
});

app.get('/api/results', (req, res) => {
    const db = readDB();
    const tenant = getTenant(req);
    res.json(db.tenants[tenant]?.results || {});
});

app.post('/api/results', auth, (req, res) => {
    const { tenant, isAdmin } = req.user;
    if (!isAdmin) return res.status(403).json({ error: "No admin" });

    const db = readDB();
    db.tenants[tenant].results = req.body.results;

    writeDB(db);
    res.json({ ok: true });
});

app.get('/api/ranking', (req, res) => {
    const db = readDB();
    const tenant = getTenant(req);
    const t = db.tenants[tenant];

    if (!t) return res.json([]);

    const ranking = Object.entries(t.users).map(([user, u]) => {
        let pts = 0;

        Object.keys(t.results).forEach(id => {
            const r = t.results[id];
            const p = u.predictions[id];
            if (!p) return;

            if (p.home === r.home && p.away === r.away) pts += 3;
            else if (
                (p.home > p.away && r.home > r.away) ||
                (p.home < p.away && r.home < r.away) ||
                (p.home === p.away && r.home === r.away)
            ) pts += 1;
        });

        return { user, pts };
    });

    ranking.sort((a, b) => b.pts - a.pts);
    res.json(ranking);
});

app.listen(PORT, () => console.log("SAAS READY"));
