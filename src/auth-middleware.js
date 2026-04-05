/**
 * auth-middleware.js — Express middleware (v2.1.1)
 *
 * requireAuth: Bearer token doğrular, req.user'ı set eder
 * v2.1'de tek kullanıcı olduğundan rol kontrolü basit tutulmuştur.
 * İleride multi-user: verifyToken payload'ı genişletilir, bu middleware değişmez.
 */

const { verifyToken } = require('./auth');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  // SSE (EventSource) custom header gönderemez — query param fallback
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.query?.token || null);

  if (!token) {
    return res.status(401).json({ error: 'Giriş gerekli' });
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      role:        payload.role || 'admin',
      displayName: payload.displayName || 'Eczane',
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Oturum süresi doldu' });
  }
}

module.exports = { requireAuth };
