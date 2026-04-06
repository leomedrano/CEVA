const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const predictionsRoutes = require('./routes/predictions');
const resultsRoutes = require('./routes/results');
const adminRoutes = require('./routes/admin');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚽ Prode Mundial 2026 corriendo en http://localhost:${PORT}`);
});
