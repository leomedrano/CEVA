// server.js  (versión corregida y mejorada)
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== LOWDB CONFIG ====================
const adapter = new JSONFile('db.json');
const defaultData = { storage: {} };   // ← Esto soluciona el error

const db = new Low(adapter, defaultData);

let dbReady = false;

async function initDB() {
  try {
    await db.read();
    // Si el archivo no existía, lowdb ya lo crea con defaultData
    if (!db.data) db.data = defaultData;
    await db.write();
    dbReady = true;
    console.log('✅ LowDB inicializado correctamente (db.json)');
  } catch (err) {
    console.error('❌ Error LowDB:', err.message);
    // Fallback en memoria si falla el disco (Render Free)
    db.data = defaultData;
    dbReady = true;
    console.log('⚠️ Usando base de datos en memoria (datos se pierden al reiniciar)');
  }
}

// ==================== API STORAGE ====================
app.get('/api/storage/:key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ value: null });
  await db.read();
  const key = decodeURIComponent(req.params.key);
  res.json({ value: db.data.storage[key] ?? null });
});

app.post('/api/storage/:key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ success: false });
  await db.read();
  const key = decodeURIComponent(req.params.key);
  db.data.storage[key] = req.body.value;
  try {
    await db.write();
  } catch (e) { /* silenciar errores de escritura en Render Free */ }
  res.json({ success: true });
});

app.delete('/api/storage/:key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ success: false });
  await db.read();
  const key = decodeURIComponent(req.params.key);
  delete db.data.storage[key];
  try {
    await db.write();
  } catch (e) {}
  res.json({ success: true });
});

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Prode Mundial 2026 corriendo en puerto ${PORT}`);
  });
}).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
