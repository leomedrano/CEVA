const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== POSTGRESQL ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }   // Necesario en Render Free
});

// Crear tabla si no existe
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('✅ Tabla storage creada o ya existe en PostgreSQL');
  } catch (err) {
    console.error('❌ Error al crear tabla:', err.message);
  }
}

// API Storage con PostgreSQL
app.get('/api/storage/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const result = await pool.query('SELECT value FROM storage WHERE key = $1', [key]);
    const value = result.rows[0] ? JSON.parse(result.rows[0].value) : null;
    res.json({ value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ value: null });
  }
});

app.post('/api/storage/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const value = JSON.stringify(req.body.value);
    await pool.query(
      'INSERT INTO storage (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.delete('/api/storage/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    await pool.query('DELETE FROM storage WHERE key = $1', [key]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar
initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Prode Mundial 2026 con PostgreSQL en puerto ${PORT}`);
  });
}).catch(err => {
  console.error('Error fatal:', err);
});
