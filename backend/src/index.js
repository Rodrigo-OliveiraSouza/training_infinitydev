const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { migrate } = require('./db');
const { ensureLanguages } = require('./services/levels');
const { setupTerminalServer } = require('./terminal/server');
const config = require('./config');
const authRoutes = require('./routes/auth');
const languageRoutes = require('./routes/languages');
const levelRoutes = require('./routes/levels');
const leaderboardRoutes = require('./routes/leaderboard');
const progressRoutes = require('./routes/progress');
const adminRoutes = require('./routes/admin');
const rewardsRoutes = require('./routes/rewards');
const classRoutes = require('./routes/classes');
const teacherRoutes = require('./routes/teacher');
const healthRoutes = require('./routes/health');

async function start() {
  await migrate();
  ensureLanguages();

  const app = express();
  app.set('trust proxy', true);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '200kb' }));
  app.use(morgan('dev'));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/languages', languageRoutes);
  app.use('/api/levels', levelRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/rewards', rewardsRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/teacher', teacherRoutes);

  const frontendDir = path.join(__dirname, '..', '..', 'frontend');
  app.use(express.static(frontendDir));

  function sendPage(page) {
    return (req, res) => {
      res.sendFile(path.join(frontendDir, page));
    };
  }

  app.get('/', sendPage('index.html'));
  app.get('/login', sendPage('login.html'));
  app.get('/register', sendPage('register.html'));
  app.get('/choose-language', sendPage('choose-language.html'));
  app.get('/recover', sendPage('recover.html'));
  app.get('/map/:language', sendPage('map.html'));
  app.get('/map/class/:classId', sendPage('map.html'));
  app.get('/level/:id', sendPage('level.html'));
  app.get('/admin', sendPage('admin.html'));
  app.get('/teacher', sendPage('teacher.html'));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const server = http.createServer(app);
  setupTerminalServer(server);

  server.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

