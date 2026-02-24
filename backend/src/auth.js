const jwt = require('jsonwebtoken');
const config = require('./config');

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: config.tokenTtl }
  );
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Auth required' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role || 'user'
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin required' });
  }
  return next();
}

function requireTeacher(req, res, next) {
  if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Teacher required' });
  }
  return next();
}

module.exports = { signToken, requireAuth, requireAdmin, requireTeacher, extractToken };

