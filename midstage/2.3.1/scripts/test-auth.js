const { signToken } = require('../src/auth');

function createTestToken(displayName = 'Codex V2.2 Test') {
  return signToken({ role: 'admin', displayName });
}

function buildAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

module.exports = {
  createTestToken,
  buildAuthHeaders,
};
