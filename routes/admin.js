const express = require('express');
const router = express.Router();
const { userQueries, predQueries, resultQueries, configQueries, db } = require('../database');

// Obtener todos los usuarios con stats
router.get('/users', (req, res) => {
  try {
    const users = userQueries.getAll.all().map(u => u.username);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener predicciones de un usuario (admin view)
router.get('/users/:username/predictions', (req, res) => {
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

// Editar usuario
router.put('/users/:username', (req, res) => {
  try {
    const { newUsername, newPassword } = req.body;
    const oldUsername = req.params.username;

    if (!newUsername || newUsername.length < 2) {
      return res.status(400).json({ error: 'Nombre mínimo 2 caracteres' });
    }
    if (!newPassword || newPassword.length < 3) {
      return res.status(400).json({ error: 'Contraseña mínimo 3 caracteres' });
    }

    const existing = userQueries.getByUsername.get(oldUsername);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (newUsername !== oldUsername) {
      const conflict = userQueries.getByUsername.get(newUsername);
      if (conflict) {
        return res.status(409).json({ error: 'Nombre ya existe' });
      }
    }

    const update = db.transaction(() => {
      if (newUsername !== oldUsername) {
        // Actualizar predicciones primero (antes del cambio de username en users)
        predQueries.updateUsername.run(newUsername, oldUsername);
      }
      userQueries.updateUsernameAndPassword.run(newUsername, newPassword, oldUsername);
    });
    update();

    res.json({ ok: true, username: newUsername });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resetear predicciones de un usuario (solo las no bloqueadas)
router.post('/users/:username/reset', (req, res) => {
  try {
    const { matchIds } = req.body; // IDs de partidos a borrar
    if (!matchIds || !Array.isArray(matchIds)) {
      return res.status(400).json({ error: 'matchIds requerido' });
    }
    const del = db.transaction(() => {
      matchIds.forEach(mid => {
        predQueries.deleteByUserUnlocked.run(req.params.username, mid);
      });
    });
    del();
    res.json({ ok: true, deleted: matchIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar usuario
router.delete('/users/:username', (req, res) => {
  try {
    const del = db.transaction(() => {
      predQueries.deleteByUser.run(req.params.username);
      userQueries.delete.run(req.params.username);
    });
    del();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar usuario (admin)
router.post('/users', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || username.length < 2) {
      return res.status(400).json({ error: 'Mínimo 2 caracteres' });
    }
    if (!password || password.length < 3) {
      return res.status(400).json({ error: 'Contraseña mínimo 3 caracteres' });
    }
    const existing = userQueries.getByUsername.get(username);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe' });
    }
    userQueries.create.run(username, password, 0);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar todos los usuarios
router.delete('/users', (req, res) => {
  try {
    const del = db.transaction(() => {
      predQueries.deleteAll.run();
      userQueries.deleteAll.run();
    });
    del();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export completo
router.get('/export', (req, res) => {
  try {
    const users = userQueries.getAll.all().map(u => u.username);
    const allUserData = {};
    users.forEach(u => {
      const user = userQueries.getByUsername.get(u);
      allUserData[u] = { password: user.password, createdAt: user.created_at };
    });

    const allPredictions = {};
    users.forEach(u => {
      const rows = predQueries.getByUser.all(u);
      const preds = {};
      rows.forEach(r => { preds[r.match_id] = { home: r.home_score, away: r.away_score }; });
      allPredictions[u] = preds;
    });

    const resultRows = resultQueries.getAll.all();
    const results = {};
    resultRows.forEach(r => { results[r.match_id] = { home: r.home_score, away: r.away_score }; });

    const configRows = configQueries.getAll.all();
    const config = {};
    configRows.forEach(r => { config[r.key] = r.value; });

    const admin = userQueries.getAdmin.get();

    res.json({
      users,
      userData: allUserData,
      predictions: allPredictions,
      results,
      config,
      designatedAdmin: admin ? admin.username : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import completo
router.post('/import', (req, res) => {
  try {
    const data = req.body;
    const imp = db.transaction(() => {
      // Limpiar todo
      predQueries.deleteAll.run();
      resultQueries.deleteAll.run();
      userQueries.deleteAll.run();
      db.prepare('DELETE FROM config').run();

      // Usuarios
      if (data.users && Array.isArray(data.users)) {
        data.users.forEach(u => {
          const ud = (data.userData && data.userData[u]) || {};
          const isAdmin = data.designatedAdmin === u ? 1 : 0;
          userQueries.create.run(u, ud.password || '1234', isAdmin);
        });
      }

      // Predicciones
      if (data.predictions) {
        for (const [username, preds] of Object.entries(data.predictions)) {
          for (const [matchId, scores] of Object.entries(preds)) {
            predQueries.upsert.run(username, matchId, String(scores.home ?? ''), String(scores.away ?? ''));
          }
        }
      }

      // Resultados
      if (data.results) {
        for (const [matchId, scores] of Object.entries(data.results)) {
          resultQueries.upsert.run(matchId, String(scores.home ?? ''), String(scores.away ?? ''));
        }
      }

      // Config
      if (data.config) {
        for (const [key, value] of Object.entries(data.config)) {
          configQueries.upsert.run(key, String(value));
        }
      }
    });
    imp();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
