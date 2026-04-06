const express = require('express');
const router = express.Router();
const { configQueries, db } = require('../database');

const DEFAULT_CONFIG = {
  companyName: 'Mi Empresa',
  companyLogo: '',
  primaryColor: '#1a472a',
  primaryLight: '#2d6a4f',
  primaryDark: '#0d2818',
  accentColor: '#d4a017',
  accentLight: '#f0c040'
};

// Obtener configuración
router.get('/', (req, res) => {
  try {
    const rows = configQueries.getAll.all();
    const config = { ...DEFAULT_CONFIG };
    rows.forEach(r => {
      config[r.key] = r.value;
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar configuración
router.post('/', (req, res) => {
  try {
    const config = req.body;
    const save = db.transaction(() => {
      for (const [key, value] of Object.entries(config)) {
        configQueries.upsert.run(key, String(value));
      }
    });
    save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset a defaults
router.delete('/', (req, res) => {
  try {
    const save = db.transaction(() => {
      db.prepare('DELETE FROM config').run();
      for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
        configQueries.upsert.run(key, value);
      }
    });
    save();
    res.json(DEFAULT_CONFIG);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
