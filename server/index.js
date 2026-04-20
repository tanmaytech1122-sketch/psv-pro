'use strict';

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const compression= require('compression');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const sizingRouter   = require('./routes/sizing');
const projectsRouter = require('./routes/projects');
const aiChatRouter   = require('./routes/aiChat');

const app    = express();
const PORT   = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

console.log(`🚀 PSV Pro v4.0 — ${isProd ? 'production' : 'development'} mode`);
console.log(`   GEMINI_API_KEY   : ${process.env.GEMINI_API_KEY   ? '✅' : '❌ missing'}`);
console.log(`   OPENROUTER_KEY   : ${process.env.OPENROUTER_API_KEY ? '✅' : '⚠️  not set (optional)'}`);

// ── Security & middleware ─────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: isProd ? false : ['http://localhost:5000', 'http://localhost:5173'] }));
app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ─────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { ok: false, error: 'Too many requests' },
}));

// ── API routes ────────────────────────────────────────────────────
app.use('/api/size',     sizingRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/ai-chat',  aiChatRouter);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const PSVApi = require('./engines/psv-engine');
  const suite  = PSVApi.runValidationSuite();
  res.json({
    ok: true,
    version: '4.0.0',
    engine: { tests: suite.pass + '/' + suite.total, pass: suite.fail === 0 },
    uptime: process.uptime().toFixed(0) + 's',
    ai: { configured: !!process.env.GEMINI_API_KEY },
  });
});

// ── Serve React build in production ──────────────────────────────
if (isProd) {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Global error handler ──────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({
    ok: false,
    error: isProd ? 'Internal server error' : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n   API  →  http://localhost:${PORT}/api`);
  if (!isProd) console.log(`   UI   →  http://localhost:5000  (Vite dev server)\n`);
});

module.exports = app;