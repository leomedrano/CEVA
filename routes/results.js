const express = require('express');
const router = express.Router();
const { resultQueries, db } = require('../database');

// Obtener todos los resultados reales
router.get('/', (req, res) => {
  try {
    const rows = resultQueries.getAll.all();
    const results = {};
    rows.forEach(r => {
      results[r.match_id] = { home: r.home_score, away: r.away_score };
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar resultados (admin)
router.post('/', (req, res) => {
  try {
    const { results } = req.body;
    if (!results || typeof results !== 'object') {
      return res.status(400).json({ error: 'results requerido' });
    }
    const upsert = db.transaction(() => {
      for (const [matchId, scores] of Object.entries(results)) {
        resultQueries.upsert.run(
          matchId,
          String(scores.home ?? ''),
          String(scores.away ?? '')
        );
      }
    });
    upsert();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrar todos los resultados
router.delete('/', (req, res) => {
  try {
    resultQueries.deleteAll.run();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
