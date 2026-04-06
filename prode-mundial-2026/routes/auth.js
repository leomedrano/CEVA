const express = require('express');
const router = express.Router();
const { userQueries, db } = require('../database');

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const user = userQueries.getByUsername.get(username);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (user.password !== password) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    res.json({
      username: user.username,
      isDesignatedAdmin: user.is_designated_admin === 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registro
router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || username.length < 2) {
      return res.status(400).json({ error: 'Usuario mínimo 2 caracteres' });
    }
    if (!password || password.length < 3) {
      return res.status(400).json({ error: 'Contraseña mínimo 3 caracteres' });
    }
    const existing = userQueries.getByUsername.get(username);
    if (existing) {
      return res.status(409).json({ error: 'Usuario ya existe' });
    }
    const count = userQueries.countAll.get().count;
    const isFirst = count === 0 ? 1 : 0;
    userQueries.create.run(username, password, isFirst);
    res.json({
      username,
      isDesignatedAdmin: isFirst === 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verificar sesión
router.get('/check/:username', (req, res) => {
  try {
    const user = userQueries.getByUsername.get(req.params.username);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({
      username: user.username,
      isDesignatedAdmin: user.is_designated_admin === 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
