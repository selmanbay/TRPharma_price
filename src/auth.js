/**
 * auth.js — Tek kullanıcı auth yardımcıları (v2.1.1)
 *
 * Veri:  data/auth.json  → { setupComplete, displayName, passwordHash, role }
 * Secret: data/.secret   → JWT imzalama anahtarı (ilk çalıştırmada oluşturulur)
 *
 * İleride multi-user: auth.json → users.json'a migrate edilir, bu API korunur.
 */

const fs   = require('fs');
const path = require('path');
const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { getDataFilePath } = require('./config-store');

const AUTH_FILE   = () => getDataFilePath('auth.json');
const SECRET_FILE = () => getDataFilePath('.secret');

const JWT_EXPIRY    = '8h';
const BCRYPT_ROUNDS = 10;

// ── Secret ──────────────────────────────────────────────────────────────────

function getSecret() {
  const secretPath = SECRET_FILE();
  const secretDir  = path.dirname(secretPath);

  if (!fs.existsSync(secretDir)) {
    fs.mkdirSync(secretDir, { recursive: true });
  }

  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf-8').trim();
  }

  const secret = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(secretPath, secret, 'utf-8');
  return secret;
}

// ── Auth dosyası ─────────────────────────────────────────────────────────────

const AUTH_DEFAULTS = {
  setupComplete: false,
  displayName:   'Eczane',
  passwordHash:  null,
  role:          'admin',
};

function loadAuth() {
  const authPath = AUTH_FILE();
  const authDir  = path.dirname(authPath);

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  if (!fs.existsSync(authPath)) {
    return { ...AUTH_DEFAULTS };
  }

  try {
    return { ...AUTH_DEFAULTS, ...JSON.parse(fs.readFileSync(authPath, 'utf-8')) };
  } catch {
    return { ...AUTH_DEFAULTS };
  }
}

function saveAuth(data) {
  const authPath = AUTH_FILE();
  const authDir  = path.dirname(authPath);

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  fs.writeFileSync(authPath, JSON.stringify(data, null, 2), 'utf-8');
}

function isSetupComplete() {
  return loadAuth().setupComplete === true;
}

// ── Şifre ────────────────────────────────────────────────────────────────────

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

async function checkPassword(plaintext, hash) {
  if (!hash) return false;
  return bcrypt.compare(plaintext, hash);
}

// ── JWT ──────────────────────────────────────────────────────────────────────

function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret()); // hata fırlatır
}

// ── Setup ────────────────────────────────────────────────────────────────────

/**
 * İlk kurulum: displayName + password → auth.json'a kaydeder
 * Zaten kurulmuşsa hata fırlatır.
 */
async function setupUser({ displayName, password }) {
  if (isSetupComplete()) {
    throw new Error('Kurulum zaten tamamlandı');
  }

  if (!password || password.length < 4) {
    throw new Error('Şifre en az 4 karakter olmalı');
  }

  const passwordHash = await hashPassword(password);
  const auth = {
    setupComplete: true,
    displayName:   displayName || 'Eczane',
    passwordHash,
    role:          'admin',
  };
  saveAuth(auth);
  return auth;
}

/**
 * Giriş: şifre → doğruysa JWT token + kullanıcı objesi döner
 */
async function loginUser(password) {
  const auth = loadAuth();

  if (!auth.setupComplete) {
    throw new Error('Kurulum tamamlanmamış');
  }

  const ok = await checkPassword(password, auth.passwordHash);
  if (!ok) {
    throw new Error('Hatalı şifre');
  }

  const payload = {
    role:        auth.role,
    displayName: auth.displayName,
  };

  const token = signToken(payload);
  const user  = { role: auth.role, displayName: auth.displayName };

  // lastLoginAt güncelle
  auth.lastLoginAt = new Date().toISOString();
  saveAuth(auth);

  return { token, user };
}

module.exports = {
  loadAuth,
  saveAuth,
  isSetupComplete,
  hashPassword,
  checkPassword,
  signToken,
  verifyToken,
  setupUser,
  loginUser,
};
