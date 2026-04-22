/**
 * app-runtime.js
 * Auth/session/bootstrap runtime owner for V2.3.
 */
(function initV23AppRuntime(globalScope) {
  if (!globalScope) return;

  function getToken(tokenKey) {
    return sessionStorage.getItem(tokenKey);
  }

  function getStoredUser(userKey) {
    try {
      return JSON.parse(sessionStorage.getItem(userKey));
    } catch {
      return null;
    }
  }

  function setSession(tokenKey, userKey, token, user) {
    sessionStorage.setItem(tokenKey, token);
    sessionStorage.setItem(userKey, JSON.stringify(user));
  }

  function clearSession(tokenKey, userKey) {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(userKey);
  }

  function authFetch(url, options = {}, deps = {}) {
    const headers = { ...(options.headers || {}) };
    const token = deps.getToken ? deps.getToken() : '';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
  }

  async function fetchSetupStatus() {
    const res = await fetch('/api/auth/setup-status');
    return res.json();
  }

  async function login(password, deps = {}) {
    const { normalizeUserModel, setSession: setSessionFn } = deps;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Giris basarisiz');
    const user = typeof normalizeUserModel === 'function' ? normalizeUserModel(data.user) : (data.user || null);
    if (typeof setSessionFn === 'function') setSessionFn(data.token, user);
    return user;
  }

  async function setup(displayName, password, deps = {}) {
    const { normalizeUserModel, setSession: setSessionFn } = deps;
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kurulum basarisiz');
    const user = typeof normalizeUserModel === 'function' ? normalizeUserModel(data.user) : (data.user || null);
    if (typeof setSessionFn === 'function') setSessionFn(data.token, user);
    return user;
  }

  async function ensureAuth(runtime = {}, deps = {}) {
    const { state } = runtime;
    if (!state) return false;
    const {
      fetchSetupStatus: fetchSetupStatusFn,
      getToken: getTokenFn,
      authFetch: authFetchFn,
      clearSession: clearSessionFn,
      normalizeUserModel,
      getStoredUser: getStoredUserFn,
      renderLoginPage,
      switchMock,
    } = deps;

    const status = await (fetchSetupStatusFn || fetchSetupStatus)();
    if (status.needsSetup) {
      state.authMode = 'setup';
      if (typeof renderLoginPage === 'function') renderLoginPage();
      if (typeof switchMock === 'function') switchMock('login');
      return false;
    }

    const token = typeof getTokenFn === 'function' ? getTokenFn() : '';
    if (!token) {
      state.authMode = 'login';
      if (typeof renderLoginPage === 'function') renderLoginPage();
      if (typeof switchMock === 'function') switchMock('login');
      return false;
    }

    const res = await (authFetchFn || authFetch)('/api/auth/me');
    if (!res.ok) {
      if (typeof clearSessionFn === 'function') clearSessionFn();
      state.authMode = 'login';
      if (typeof renderLoginPage === 'function') renderLoginPage();
      if (typeof switchMock === 'function') switchMock('login');
      return false;
    }

    const data = await res.json();
    const storedUser = typeof getStoredUserFn === 'function' ? getStoredUserFn() : null;
    state.user = typeof normalizeUserModel === 'function'
      ? normalizeUserModel(data.user || storedUser)
      : (data.user || storedUser);
    return true;
  }

  async function loadAppMeta(runtime = {}, deps = {}) {
    const { state } = runtime;
    if (!state) return;
    const {
      electronAPI,
      renderSettingsPage,
    } = deps;
    const api = electronAPI || globalScope.electronAPI || null;
    try {
      if (api?.getAppVersion) {
        state.appVersion = await api.getAppVersion();
      }
    } catch {
      state.appVersion = '';
    }
    if (api?.onUpdateStatus) {
      api.onUpdateStatus((payload) => {
        state.updateStatus = payload?.phase || '';
        if (typeof renderSettingsPage === 'function') renderSettingsPage();
      });
    }
  }

  async function loadConfig(runtime = {}, deps = {}) {
    const { state } = runtime;
    if (!state) throw new Error('State yok');
    const { API_BASE, authFetch: authFetchFn, extractConfiguredDepotEntities, updateNavSummary } = deps;
    const res = await (authFetchFn || authFetch)(`${API_BASE}/api/config`);
    if (!res.ok) throw new Error('Config yuklenemedi');
    state.config = await res.json();
    state.depotEntities = typeof extractConfiguredDepotEntities === 'function'
      ? extractConfiguredDepotEntities(state.config)
      : [];
    if (typeof updateNavSummary === 'function') updateNavSummary();
    return state.config;
  }

  async function loadHistory(runtime = {}, deps = {}, limit = 20) {
    const { state } = runtime;
    if (!state) throw new Error('State yok');
    const { API_BASE, authFetch: authFetchFn } = deps;
    const res = await (authFetchFn || authFetch)(`${API_BASE}/api/history?limit=${limit}`);
    if (!res.ok) throw new Error('Gecmis yuklenemedi');
    state.history = await res.json();
    return state.history;
  }

  function configuredDepotIds(runtime = {}, deps = {}) {
    const { state } = runtime;
    if (!state) return [];
    if (state.depotEntities?.length) {
      return state.depotEntities
        .filter((entity) => typeof entity.isReadyForSearch === 'function' && entity.isReadyForSearch())
        .map((entity) => entity.id)
        .filter(Boolean);
    }
    const depots = state.config?.depots || {};
    const { depotMeta } = deps;
    return Object.keys(depots).filter((depotId) => {
      const entry = depots[depotId];
      if (entry && (entry.hasCredentials || entry.hasCookies || entry.hasToken)) return true;
      return false;
    }).filter((depotId) => !depotMeta || depotMeta[depotId] || depots[depotId]);
  }

  async function bootstrapApp(runtime = {}, deps = {}) {
    const {
      loadAppMeta: loadAppMetaFn,
      ensureAuth: ensureAuthFn,
      loadConfig: loadConfigFn,
      loadHistory: loadHistoryFn,
      updateNavSummary,
      switchMock,
    } = deps;
    await (loadAppMetaFn || loadAppMeta)(runtime, deps);
    const authed = await (ensureAuthFn || ensureAuth)(runtime, deps);
    if (!authed) return false;
    const safeLoadHistory = async () => {
      try {
        await (loadHistoryFn ? loadHistoryFn(20) : loadHistory(runtime, deps));
      } catch (e) {
        console.warn('[v2.3.1] History load failed (non-fatal):', e?.message || e);
      }
    };
    await Promise.all([
      loadConfigFn ? loadConfigFn() : loadConfig(runtime, deps),
      safeLoadHistory(),
    ]);
    if (typeof updateNavSummary === 'function') updateNavSummary();
    if (typeof switchMock === 'function') switchMock('home');
    return true;
  }

  globalScope.V23AppRuntime = {
    getToken,
    getStoredUser,
    setSession,
    clearSession,
    authFetch,
    fetchSetupStatus,
    login,
    setup,
    ensureAuth,
    loadAppMeta,
    loadConfig,
    loadHistory,
    configuredDepotIds,
    bootstrapApp,
  };
})(typeof window !== 'undefined' ? window : null);
