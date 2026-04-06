const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

console.log('DATABASE_URL presente:', !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    console.log('🔄 Intentando conectar a PostgreSQL...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('✅ PostgreSQL conectado correctamente - Tabla storage lista');
  } catch (err) {
    console.error('❌ ERROR AL CONECTAR A POSTGRESQL:', err.message);
    console.error('Revisa que DATABASE_URL sea la EXTERNAL URL completa');
  }
}

// Resto de las rutas API (igual que antes)
app.get('/api/storage/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const result = await pool.query('SELECT value FROM storage WHERE key = $1', [key]);
    const value = result.rows[0] ? JSON.parse(result.rows[0].value) : null;
    res.json({ value });
  } catch (err) {
    console.error('GET error:', err.message);
    res.json({ value: null });
  }
});

app.post('/api/storage/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const valueStr = JSON.stringify(req.body.value);
    await pool.query(
      'INSERT INTO storage (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, valueStr]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST error:', err.message);
    res.json({ success: false });
  }
});

app.delete('/api/storage/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    await pool.query('DELETE FROM storage WHERE key = $1', [key]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.json({ success: false });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  });
}).catch(err => console.error('Error fatal:', err));
