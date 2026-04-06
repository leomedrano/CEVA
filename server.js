const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== LOWDB MEJORADO ====================
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const adapter = new JSONFile('db.json');
const db = new Low(adapter);

let dbReady = false;

async function initDB() {
  try {
    await db.read();
    db.data ||= { storage: {} };
    await db.write();
    dbReady = true;
    console.log('✅ LowDB inicializado correctamente');
  } catch (err) {
    console.error('❌ Error al inicializar db.json:', err.message);
    // Fallback en memoria si falla el disco
    db.data = { storage: {} };
    dbReady = true;
    console.log('⚠️ Usando base de datos en memoria (datos se perderán al reiniciar)');
  }
}

// API Storage
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
  await db.write().catch(() => {}); // silenciar errores de escritura
  res.json({ success: true });
});

app.delete('/api/storage/:key', async (req, res) => {
  if (!dbReady) return res.status(503).json({ success: false });
  await db.read();
  const key = decodeURIComponent(req.params.key);
  delete db.data.storage[key];
  await db.write().catch(() => {});
  res.json({ success: true });
});

// Ruta principal
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar
initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📍 Modo: ${dbReady ? 'LowDB (disco)' : 'Fallback memoria'}`);
  });
}).catch(err => {
  console.error('Error fatal al iniciar:', err);
});
