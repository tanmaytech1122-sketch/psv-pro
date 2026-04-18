'use strict';

// ── Load environment variables FIRST ─────────────────────────────────
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

const app  = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Log environment status
console.log(`🚀 Starting server in ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
console.log(`🤖 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);

// ── Security & middleware ─────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for simplicity
app.use(cors({ origin: isProd ? false : ['http://localhost:5000', 'http://localhost:5173'] }));
app.use(compression());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ─────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { ok: false, error: 'Too many requests' }
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
    ai: { configured: !!process.env.OPENROUTER_API_KEY }
  });
});

// ── Serve React build in production ──────────────────────────────
if (isProd) {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ 
    ok: false, 
    error: isProd ? 'Server error' : err.message 
  });
});

// ── Start server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✨ PSV Pro API  →  http://localhost:${PORT}/api`);
  console.log(`🏥 Health       →  http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Status    →  ${process.env.OPENROUTER_API_KEY ? '✅ Ready' : '⚠️ No API key (local mode)'}`);
  if (!isProd) console.log(`💻 Frontend    →  http://localhost:5173  (npm run dev:client)\n`);
});

module.exports = app;