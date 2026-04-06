const express = require('express');
const cors = require('cors');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// LowDB (base de datos JSON simple y persistente)
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { storage: {} });

async function initDB() {
  await db.read();
  db.data ||= { storage: {} };
  await db.write();
  console.log('✅ Base de datos cargada');
}

app.get('/api/storage/:key', async (req, res) => {
  await db.read();
  const key = decodeURIComponent(req.params.key);
  const value = db.data.storage[key];
  res.json({ value: value !== undefined ? value : null });
});

app.post('/api/storage/:key', async (req, res) => {
  await db.read();
  const key = decodeURIComponent(req.params.key);
  db.data.storage[key] = req.body.value;
  await db.write();
  res.json({ success: true });
});

app.delete('/api/storage/:key', async (req, res) => {
  await db.read();
  const key = decodeURIComponent(req.params.key);
  delete db.data.storage[key];
  await db.write();
  res.json({ success: true });
});

// Sirve el frontend en todas las rutas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Prode Mundial 2026 corriendo en http://localhost:${PORT}`);
  });
}).catch(console.error);