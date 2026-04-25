const express  = require('express');
const path     = require('path');
const fs       = require('fs');

const app       = express();
const PORT      = process.env.PORT || 3000;
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/events', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return res.json([]);
    res.json(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch {
    res.json([]);
  }
});

app.post('/api/events', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
