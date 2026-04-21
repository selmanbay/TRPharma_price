/**
 * auth-middleware.js
 *
 * requireAuth: Bearer token dogrular, req.user bilgisini set eder.
 * Query-string token kabul edilmez; tum auth header uzerinden gitmelidir.
 */

const { verifyToken } = require('./auth');

function buildUserFromPayload(payload) {
  return {
    userId: payload.userId || null,
    role: payload.role || 'admin',
    displayName: payload.displayName || 'Eczane',
  };
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Giris gerekli' });
  }

  try {
    const payload = verifyToken(token);
    req.user = buildUserFromPayload(payload);
    return next();
  } catch {
    return res.status(401).json({ error: 'Oturum suresi doldu' });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Bu islem icin admin yetkisi gerekli' });
    }
    return next();
  });
}

module.exports = { requireAuth, requireAdmin };
