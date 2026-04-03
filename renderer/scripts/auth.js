/**
 * auth.js — Frontend auth modülü (v2.1.1)
 *
 * sessionStorage kullanır → window kapanınca token silinir (vardiya güvenliği).
 * Tüm API çağrıları authFetch() üzerinden yapılmalı.
 */

const TOKEN_KEY = 'eczane.auth.token';
const USER_KEY  = 'eczane.auth.user';

function applyAuthCopy() {
  const setText = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  };
  const setPlaceholder = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.placeholder = text;
  };

  setText('#loginOverlay .auth-brand p', 'İlaç Fiyat Karşılaştırma Sistemi');
  setText('#loginOverlay .auth-form-box h2', 'Sisteme Giriş');
  setText('#loginOverlay .auth-subtitle', 'Devam etmek için şifrenizi girin.');
  setText('label[for="loginPassword"]', 'Şifre');
  setPlaceholder('#loginPassword', 'Şifrenizi girin');
  setText('#loginBtn', 'Giriş Yap');

  setText('#setupOverlay .auth-brand p', 'Uygulamayı ilk kez kullanıyorsunuz. Bir şifre belirleyin.');
  setText('#setupOverlay .auth-status-badge span', 'İlk Kurulum');
  setText('#setupOverlay .auth-form-box h2', 'Hoş Geldiniz');
  setText('#setupOverlay .auth-subtitle', 'Eczanenizin adını ve giriş şifresini belirleyin.');
  setText('label[for="setupDisplayName"]', 'Eczane Adı');
  setText('label[for="setupPassword"]', 'Şifre');
  setText('label[for="setupPassword2"]', 'Şifre Tekrar');
  setPlaceholder('#setupDisplayName', 'Eczane adınız');
  setPlaceholder('#setupPassword', 'En az 4 karakter');
  setPlaceholder('#setupPassword2', 'Şifreyi tekrar girin');
  setText('#setupBtn', 'Kurulumu Tamamla');
}

// ── Session ──────────────────────────────────────────────────────────────────

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * fetch wrapper: Authorization header'ı otomatik ekler.
 * Varsayılan 15 sn timeout — sunucu yanıt vermezse loading takılmaz.
 * app.js'deki tüm fetch çağrıları bunu kullanmalı.
 */
const AUTH_FETCH_TIMEOUT_MS = 15000;

function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  // Caller'ın kendi signal'i varsa onu kullan; yoksa timeout oluştur
  if (options.signal) {
    return fetch(url, { ...options, headers });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);

  return fetch(url, { ...options, headers, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Istek zaman asimina ugradi (' + url + ')');
        timeoutErr.type = 'timeout';
        throw timeoutErr;
      }
      err.type = err.type || 'network';
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

// ── Login / Setup ─────────────────────────────────────────────────────────────

async function login(password) {
  const res  = await fetch('/api/auth/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Giriş başarısız');
  setSession(data.token, data.user);
  return data.user;
}

async function setup(displayName, password) {
  const res  = await fetch('/api/auth/setup', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ displayName, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kurulum başarısız');
  setSession(data.token, data.user);
  return data.user;
}

function logout() {
  clearSession();
  location.reload();
}

// ── Auth Guard ────────────────────────────────────────────────────────────────

/**
 * Uygulama init'inde çağrılır.
 * - needsSetup → setup overlay göster, false döner
 * - token yok / geçersiz → login overlay göster, false döner
 * - token geçerli → true döner, initApp devam eder
 */
async function requireAuthOrRedirect() {
  // 1. Kurulum kontrolü
  try {
    const statusRes = await fetch('/api/auth/setup-status');
    const status    = await statusRes.json();
    if (status.needsSetup) {
      showAuthOverlay('setup');
      return false;
    }
  } catch {
    // Sunucu henüz hazır değil — login overlay göster
    showAuthOverlay('login');
    return false;
  }

  // 2. Token kontrolü
  const token = getToken();
  if (!token) {
    showAuthOverlay('login');
    return false;
  }

  // 3. Token sunucuda geçerli mi?
  try {
    const meRes = await authFetch('/api/auth/me');
    if (!meRes.ok) {
      clearSession();
      showAuthOverlay('login');
      return false;
    }
  } catch {
    clearSession();
    showAuthOverlay('login');
    return false;
  }

  return true;
}

// ── Overlay Kontrol ───────────────────────────────────────────────────────────

function showAuthOverlay(mode) {
  const loginOverlay = document.getElementById('loginOverlay');
  const setupOverlay = document.getElementById('setupOverlay');

  if (mode === 'setup') {
    if (loginOverlay) loginOverlay.classList.add('hidden');
    if (setupOverlay) setupOverlay.classList.remove('hidden');
  } else {
    if (setupOverlay) setupOverlay.classList.add('hidden');
    if (loginOverlay) loginOverlay.classList.remove('hidden');
  }
}

function hideAuthOverlays() {
  const loginOverlay = document.getElementById('loginOverlay');
  const setupOverlay = document.getElementById('setupOverlay');
  if (loginOverlay) loginOverlay.classList.add('hidden');
  if (setupOverlay) setupOverlay.classList.add('hidden');
}

// ── Overlay Event Listeners ───────────────────────────────────────────────────

function initAuthListeners() {
  // Login formu
  const loginForm    = document.getElementById('loginForm');
  const loginError   = document.getElementById('loginError');
  const loginBtn     = document.getElementById('loginBtn');
  const loginPwInput = document.getElementById('loginPassword');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = loginPwInput?.value || '';
      if (loginError) loginError.classList.remove('visible');
      if (loginBtn)   loginBtn.disabled = true;

      try {
        const user = await login(password);
        hideAuthOverlays();
        // Kullanıcı adını güncelle
        const nameEl = document.querySelector('.profile-name');
        if (nameEl) nameEl.textContent = user.displayName || 'Eczane';
        // App init'i tekrar tetikle
        if (typeof initApp === 'function') initApp();
      } catch (err) {
        if (loginError) {
          loginError.textContent = err.message;
          loginError.classList.add('visible');
        }
      } finally {
        if (loginBtn) loginBtn.disabled = false;
      }
    });
  }

  // Setup formu
  const setupForm    = document.getElementById('setupForm');
  const setupError   = document.getElementById('setupError');
  const setupBtn     = document.getElementById('setupBtn');

  if (setupForm) {
    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const displayName = document.getElementById('setupDisplayName')?.value?.trim() || 'Eczane';
      const password    = document.getElementById('setupPassword')?.value || '';
      const password2   = document.getElementById('setupPassword2')?.value || '';

      if (setupError) setupError.classList.remove('visible');

      if (password !== password2) {
        if (setupError) {
          setupError.textContent = 'Şifreler eşleşmiyor';
          setupError.classList.add('visible');
        }
        return;
      }
      if (password.length < 4) {
        if (setupError) {
          setupError.textContent = 'Şifre en az 4 karakter olmalı';
          setupError.classList.add('visible');
        }
        return;
      }

      if (setupBtn) setupBtn.disabled = true;

      try {
        const user = await setup(displayName, password);
        hideAuthOverlays();
        const nameEl = document.querySelector('.profile-name');
        if (nameEl) nameEl.textContent = user.displayName || 'Eczane';
        if (typeof initApp === 'function') initApp();
      } catch (err) {
        if (setupError) {
          setupError.textContent = err.message;
          setupError.classList.add('visible');
        }
      } finally {
        if (setupBtn) setupBtn.disabled = false;
      }
    });
  }

  // Enter tuşu desteği
  if (loginPwInput) {
    loginPwInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginForm?.dispatchEvent(new Event('submit'));
    });
  }
}

// DOM hazır olduğunda listener'ları kur
document.addEventListener('DOMContentLoaded', () => {
  applyAuthCopy();
  initAuthListeners();
});
