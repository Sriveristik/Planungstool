const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const session  = require('express-session');

const app            = express();
const PORT           = process.env.PORT || 3000;
const DATA_DIR       = path.join(__dirname, 'data');
const DATA_FILE      = path.join(DATA_DIR, 'events.json');
const PASSWORD       = process.env.APP_PASSWORD || 'Lila';
const SESSION_SECRET = process.env.SESSION_SECRET || 'planungstool-secret-key-2024';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 Tage
}));

/* ─── Login-Seite ────────────────────────────────────────────────────────────── */
const loginPage = (error = '') => `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kalender-Tool – Anmeldung</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e1e2e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .card {
      background: #fff;
      border-radius: 14px;
      padding: 40px 36px;
      width: 340px;
      max-width: 92vw;
      box-shadow: 0 10px 40px rgba(0,0,0,.4);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
    }
    .logo svg { width: 26px; height: 26px; color: #4f46e5; }
    .logo span { font-size: 19px; font-weight: 700; color: #1e293b; }
    h1 { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 20px; }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: .4px;
      margin-bottom: 6px;
    }
    input[type=password] {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 15px;
      color: #1e293b;
      outline: none;
      transition: border-color .15s, box-shadow .15s;
      font-family: inherit;
    }
    input[type=password]:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79,70,229,.12);
    }
    .error {
      color: #ef4444;
      font-size: 13px;
      margin-top: 8px;
      min-height: 18px;
    }
    button {
      width: 100%;
      margin-top: 20px;
      padding: 11px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s;
      font-family: inherit;
    }
    button:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <span>Kalender-Tool</span>
    </div>
    <h1>Bitte Passwort eingeben</h1>
    <form method="POST" action="/login">
      <label for="pwd">Passwort</label>
      <input type="password" id="pwd" name="password" autofocus autocomplete="current-password" />
      <div class="error">${error}</div>
      <button type="submit">Anmelden</button>
    </form>
  </div>
</body>
</html>`;

/* ─── Auth-Middleware ────────────────────────────────────────────────────────── */
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Nicht angemeldet' });
  res.send(loginPage());
}

/* ─── Login / Logout ─────────────────────────────────────────────────────────── */
app.post('/login', (req, res) => {
  if (req.body.password === PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  res.send(loginPage('Falsches Passwort. Bitte erneut versuchen.'));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ─── Geschützte Routen ──────────────────────────────────────────────────────── */
app.use(requireAuth);

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
