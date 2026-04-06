const express = require('express');
const router = express.Router();
const { predQueries, db } = require('../database');

// Obtener predicciones de un usuario
router.get('/:username', (req, res) => {
  try {
    const rows = predQueries.getByUser.all(req.params.username);
    const predictions = {};
    rows.forEach(r => {
      predictions[r.match_id] = { home: r.home_score, away: r.away_score };
    });
    res.json(predictions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar una predicción
router.post('/:username', (req, res) => {
  try {
    const { matchId, home, away } = req.body;
    if (!matchId) {
      return res.status(400).json({ error: 'matchId requerido' });
    }
    predQueries.upsert.run(req.params.username, matchId, String(home ?? ''), String(away ?? ''));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar múltiples predicciones
router.post('/:username/bulk', (req, res) => {
  try {
    const { predictions } = req.body;
    if (!predictions || typeof predictions !== 'object') {
      return res.status(400).json({ error: 'predictions requerido' });
    }
    const upsert = db.transaction(() => {
      for (const [matchId, scores] of Object.entries(predictions)) {
        predQueries.upsert.run(
          req.params.username,
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

module.exports = router;
