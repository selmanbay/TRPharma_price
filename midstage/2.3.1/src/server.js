const express = require('express');
const path = require('path');
const DepotManager = require('./depot-manager');
const SearchEngine = require('./search-engine');
const SelcukDepot = require('./depots/selcuk');
const NevzatDepot = require('./depots/nevzat');
const AnadoluPharmaDepot = require('./depots/anadolu-pharma');
const AnadoluItriyatDepot = require('./depots/anadolu-itriyat');
const AllianceDepot = require('./depots/alliance');
const SentezDepot = require('./depots/sentez');
const fs = require('fs');
const { ensureConfigFile, ensureDataFile, getConfigPath, getDataFilePath } = require('./config-store');
const { isSetupComplete, setupUser, loginUser, loadAuth } = require('./auth');
const { requireAuth, requireAdmin } = require('./auth-middleware');
const {
  activateAccount,
  listAccounts,
  getActiveAccount,
  getDepotConfigForUser,
  saveDepotConnection,
  deleteDepotConnection,
  replaceDepotConfigForUser,
} = require('./account-store');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const testSessionStore = new Map();
const clientLogStore = new Map();
let activeTestSessionId = null;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'renderer')));

// Depot manager + Search engine
const manager = new DepotManager();
const searchEngine = new SearchEngine();

const CONFIG_PATH = getConfigPath();
const DEMO_PANEL_PATH = getDataFilePath('demo-panel.json');
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 8;
const authRateLimitStore = new Map();
const PASSWORD_MASK = '********';

// Config dosyası yolu

// Depot sınıfları haritası
const DEPOT_CLASSES = {
  selcuk: { cls: SelcukDepot, name: 'Selçuk Ecza', authType: 'cookie', url: 'https://webdepo.selcukecza.com.tr/Siparis/hizlisiparis.aspx' },
  nevzat: { cls: NevzatDepot, name: 'Nevzat Ecza', authType: 'cookie', url: 'http://webdepo.nevzatecza.com.tr/Siparis/hizlisiparis.aspx' },
  'anadolu-pharma': { cls: AnadoluPharmaDepot, name: 'Anadolu Pharma', authType: 'token', url: 'https://b2b.anadolupharma.com' },
  'anadolu-itriyat': { cls: AnadoluItriyatDepot, name: 'Anadolu İtriyat', authType: 'cookie', url: 'https://b4b.anadoluitriyat.com' },
  alliance: { cls: AllianceDepot, name: 'Alliance Healthcare', authType: 'cookie', url: 'https://esiparisv2.alliance-healthcare.com.tr' },
  sentez: { cls: SentezDepot, name: 'Sentez B2B', authType: 'cookie', url: 'https://www.sentezb2b.com/tr-TR/Site/Liste?tip=Arama&arama={query}&s=a' },
};

function getCurrentUserId() {
  const auth = loadAuth();
  if (auth?.setupComplete && auth.userId) {
    activateAccount({
      userId: auth.userId,
      displayName: auth.displayName || 'Eczane',
      role: auth.role || 'admin',
    });
    return auth.userId;
  }
  return getActiveAccount()?.user?.userId || null;
}

// Config yükle
function loadConfig() {
  const userId = getCurrentUserId();
  return { depots: userId ? getDepotConfigForUser(userId) : {} };
}

// Config kaydet
function saveConfig(config) {
  const userId = getCurrentUserId();
  if (!userId) return;
  replaceDepotConfigForUser(userId, config?.depots || {});
}

function getAuthRateLimitKey(req) {
  return `${req.ip || 'local'}:${req.path}`;
}

function getRateLimitState(req) {
  const key = getAuthRateLimitKey(req);
  const now = Date.now();
  const current = authRateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 0, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS };
    authRateLimitStore.set(key, next);
    return next;
  }
  return current;
}

function isAuthRateLimited(req) {
  const state = getRateLimitState(req);
  return state.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS;
}

function recordAuthFailure(req) {
  const state = getRateLimitState(req);
  state.count += 1;
  authRateLimitStore.set(getAuthRateLimitKey(req), state);
}

function clearAuthFailures(req) {
  authRateLimitStore.delete(getAuthRateLimitKey(req));
}

function isSecretCredentialField(fieldName) {
  const key = String(fieldName || '').toLowerCase();
  return key === 'sifre' || key === 'password' || key === 'parola';
}

function applyCredentialMask(credentials = {}) {
  const masked = {};
  for (const [key, value] of Object.entries(credentials || {})) {
    if (isSecretCredentialField(key)) {
      masked[key] = value ? PASSWORD_MASK : '';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function mergeCredentialInput(savedCreds = {}, incomingCreds = {}) {
  const merged = { ...savedCreds };
  for (const [key, value] of Object.entries(incomingCreds || {})) {
    const nextValue = String(value ?? '');
    if (isSecretCredentialField(key) && nextValue === PASSWORD_MASK) {
      continue;
    }
    if (!nextValue.trim() && savedCreds[key]) {
      merged[key] = savedCreds[key];
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function ensureDemoPanelFile() {
  ensureDataFile('demo-panel.json', {
    selectedRole: 'admin',
    updatedAt: null,
  });
}

function loadDemoPanelState() {
  ensureDemoPanelFile();
  try {
    return JSON.parse(fs.readFileSync(DEMO_PANEL_PATH, 'utf-8'));
  } catch {
    return { selectedRole: 'admin', updatedAt: null };
  }
}

function saveDemoPanelState(nextState) {
  ensureDemoPanelFile();
  fs.writeFileSync(DEMO_PANEL_PATH, JSON.stringify(nextState, null, 2), 'utf-8');
}

function normalizeDepotName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '')
    .toLowerCase();
}

function getDepotAliases(depotId) {
  const depotInfo = DEPOT_CLASSES[depotId];
  const aliasesByDepot = {
    selcuk: ['Selçuk Ecza', 'Selcuk Ecza', 'Selçuk Ecza', 'Selçuk Ecza'],
    nevzat: ['Nevzat Ecza'],
    'anadolu-pharma': ['Anadolu Pharma'],
    'anadolu-itriyat': ['Anadolu İtriyat', 'Anadolu Itriyat', 'Anadolu İtriyat', 'Anadolu İtriyat'],
    alliance: ['Alliance Healthcare'],
    sentez: ['Sentez B2B'],
  };
  return [...new Set([...(aliasesByDepot[depotId] || []), depotInfo?.name].filter(Boolean))];
}

function findDepotInstance(depotId) {
  const aliases = new Set(getDepotAliases(depotId).map(normalizeDepotName));
  return manager.depots.find((depot) => aliases.has(normalizeDepotName(depot.name))) || null;
}

function sanitizeTestSession(session) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    scenario: session.scenario || '',
    note: session.note || '',
    relayClientLogs: Boolean(session.relayClientLogs),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function getClientLogs(sessionId) {
  return clientLogStore.get(sessionId) || [];
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'eczane-app-v2.2',
    mode: 'current-modular-baseline',
    timestamp: Date.now(),
    activeDepots: manager.depots.length,
  });
});

// Başlangıçta config'den depot'ları yükle + Search Engine provider kayıtları
function initDepots() {
  const config = loadConfig();
  manager.depots = [];
  searchEngine.clear();

  for (const [depotId, depotInfo] of Object.entries(DEPOT_CLASSES)) {
    const depotConfig = config.depots[depotId];
    if (depotConfig) {
      const depot = new depotInfo.cls(depotConfig.credentials || {});
      if (depotInfo.authType === 'cookie' && depotConfig.cookies) {
        depot.setCookies(depotConfig.cookies);
      }
      if (depotInfo.authType === 'token' && depotConfig.token) {
        depot.setToken(depotConfig.token, depotConfig.ciSession || null);
      }
      manager.addDepot(depot);

      // Search Engine: her depo bir provider olarak kayıt olur
      searchEngine.register(depotId, {
        name: depotInfo.name,
        searchFn: (query) => depot.search(query),
      });
      searchEngine.activate(depotId);

      console.log(`[+] ${depotInfo.name} yüklendi`);
    }
  }
}

function getConfiguredDepotById(depotId) {
  if (!DEPOT_CLASSES[depotId]) return null;
  return findDepotInstance(depotId);
}

function requireUserId(req, res) {
  const userId = req.user?.userId || getCurrentUserId();
  if (!userId) {
    res.status(401).json({ success: false, error: 'Kullanici oturumu bulunamadi' });
    return null;
  }
  return userId;
}

async function refreshDepotSession(depot, options = {}) {
  if (!depot) {
    return { success: false, refreshed: false, error: 'Depot bulunamadi' };
  }

  if (typeof depot.ensureSession === 'function') {
    return await depot.ensureSession(options);
  }

  if (typeof depot.login === 'function') {
    const result = await depot.login();
    return {
      success: !!result?.success,
      refreshed: true,
      error: result?.error || null,
    };
  }

  return { success: true, refreshed: false };
}

// â”€â”€ Auth Routes (public) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/auth/setup-status', (req, res) => {
  res.json({ needsSetup: !isSetupComplete() });
});

app.post('/api/auth/setup', async (req, res) => {
  if (isAuthRateLimited(req)) {
    return res.status(429).json({ success: false, error: 'Cok fazla deneme yapildi. Biraz sonra tekrar deneyin.' });
  }
  try {
    const { displayName, password } = req.body;
    const auth = await setupUser({ displayName, password });
    const { token, user } = await loginUser(password);
    initDepots();
    clearAuthFailures(req);
    res.json({ success: true, token, user });
  } catch (err) {
    recordAuthFailure(req);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (isAuthRateLimited(req)) {
    return res.status(429).json({ success: false, error: 'Cok fazla deneme yapildi. Biraz sonra tekrar deneyin.' });
  }
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Şifre gerekli' });
    const { token, user } = await loginUser(password);
    initDepots();
    clearAuthFailures(req);
    res.json({ success: true, token, user });
  } catch (err) {
    recordAuthFailure(req);
    res.status(401).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// â”€â”€ API Routes â”€â”€

function runAutocompleteSearch(depot, query) {
  if (depot && typeof depot.autocompleteSearch === 'function') {
    return depot.autocompleteSearch(query);
  }
  return depot.search(query);
}

// Autocomplete — Selçuk'tan isim+barkod, diğer depolardan yedek barkod
app.get('/api/autocomplete', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  const selcukDepot = findDepotInstance('selcuk');
  let primaryResults = null;
  let source = '';
  let allResults = [];

  // Önce hızlı yol: Selçuk varsa sadece ondan suggestion üret
  if (selcukDepot) {
    try {
      const selcukResult = await runAutocompleteSearch(selcukDepot, q);
      allResults = [selcukResult];
      if (selcukResult?.results?.length) {
        primaryResults = selcukResult.results;
        source = selcukResult.depot || 'Selçuk Ecza';
      }
    } catch (_) {
      allResults = [];
    }
  }

  // Selçuk sonuç vermezse fallback: tüm aktif depolar
  if (!primaryResults || primaryResults.length === 0) {
    const promises = manager.depots.map(d =>
      runAutocompleteSearch(d, q).catch(() => ({ depot: d.name, results: [] }))
    );
    allResults = await Promise.all(promises);

    const selcukResult = allResults.find(r => normalizeDepotName(r.depot) === normalizeDepotName('Selçuk Ecza') && r.results?.length > 0);
    primaryResults = selcukResult?.results;
    source = selcukResult?.depot;

    if (!primaryResults || primaryResults.length === 0) {
      for (const r of allResults) {
        if (r.results && r.results.length > 0) {
          primaryResults = r.results;
          source = r.depot;
          break;
        }
      }
    }
  }

  if (!primaryResults || primaryResults.length === 0) {
    return res.json({ suggestions: [] });
  }

  const isSelcuk = normalizeDepotName(source) === normalizeDepotName('Selçuk Ecza');

  // Diğer depolardan gelen barkodları yedek olarak topla
  const barcodeMap = {};
  for (const r of allResults) {
    for (const item of (r.results || [])) {
      const code = String(item.kodu || '').trim();
      if (code.startsWith('8') && code.length >= 13) {
        const normAd = (item.ad || '').toUpperCase().replace(/[\s.]+/g, ' ').trim();
        barcodeMap[normAd] = code;
      }
    }
  }

  // İlk 10 sonuç için barkod getir
  const top10 = primaryResults.slice(0, 10);

  let suggestions;
  if (isSelcuk && selcukDepot && typeof selcukDepot.getProductDetail === 'function') {
    // Selçuk detay API'sinden paralel barkod çek
    const detailPromises = top10.map(r =>
      selcukDepot.getProductDetail(r.kodu, r.ilacTip).catch(() => null)
    );
    const details = await Promise.all(detailPromises);

    suggestions = top10.map((r, i) => {
      let barcode = details[i]?.barkod || null;
      // Selçuk detaydan gelemediyse diğer depolardan dene
      if (!barcode) {
        const normAd = (r.ad || '').toUpperCase().replace(/[\s.]+/g, ' ').trim();
        barcode = barcodeMap[normAd] || null;
        if (!barcode) {
          const words = normAd.split(' ').slice(0, 3).join(' ');
          for (const [key, val] of Object.entries(barcodeMap)) {
            if (key.startsWith(words)) { barcode = val; break; }
          }
        }
      }
      return { ad: r.ad, kodu: r.kodu, fiyat: r.fiyat, barcode };
    });
  } else {
    // Selçuk değilse, kodu 8 ile başlıyorsa barkod, yoksa barcodeMap'ten
    suggestions = top10.map(r => {
      const code = String(r.kodu || '').trim();
      let barcode = code.startsWith('8') && code.length >= 13 ? code : null;
      if (!barcode) {
        const normAd = (r.ad || '').toUpperCase().replace(/[\s.]+/g, ' ').trim();
        barcode = barcodeMap[normAd] || null;
      }
      return { ad: r.ad, kodu: r.kodu, fiyat: r.fiyat, barcode };
    });
  }

  res.json({ source, suggestions });
});

// Barkod ile tüm depolardan arama (Eski Monolithic Method)
app.get('/api/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Arama terimi gerekli (?q=...)' });
  }

  if (manager.depots.length === 0) {
    return res.status(400).json({ error: 'Hic depot ayarlanmamis. Once Ayarlar sayfasindan depot ekleyin.' });
  }

  try {
    const result = await manager.searchAndCompare(q);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tek bir depodan asenkron arama (Yeni Hızlı Method)
app.get('/api/search-depot', requireAuth, async (req, res) => {
  const { q, depotId } = req.query;
  if (!q || !depotId) return res.status(400).json({ error: 'Sorgu param eksik' });

  // İlgili depot instance'ını bul
  const config = loadConfig();
  let targetDepot = null;
  if (config.depots[depotId]) {
    targetDepot = findDepotInstance(depotId);
  }

  if (!targetDepot) return res.status(404).json({ error: 'Depot ayarli degil', results: [] });

  try {
    const rawResult = await targetDepot.search(q);
    const isBarcodeQuery = /^\d{13,}$/.test(q);
    const filtered = [];

    for (const product of rawResult.results) {
      if (!product.stokVar || (product.stok === 0 && product.stokGosterilsin)) continue;
      
      if (isBarcodeQuery) {
        const code = String(product.kodu || '').trim();
        if (code.startsWith('8') && code.length >= 13) {
          if (code !== q) continue;
        } else {
          product.kodu = q; // Gorsel tutarlilik
        }
      }
      
      filtered.push({
        ...product,
        depot: targetDepot.name,
      });
    }

    const depotInfo = DEPOT_CLASSES[depotId];
    let depotUrl = depotInfo ? depotInfo.url : '';
    if (depotUrl.includes('{query}')) depotUrl = depotUrl.replace('{query}', encodeURIComponent(q));
    res.json({ depot: targetDepot.name, depotUrl, error: rawResult.error, results: filtered });
  } catch (err) {
    res.json({ depot: targetDepot ? targetDepot.name : depotId, error: err.message, results: [] });
  }
});

// â”€â”€ Search Engine SSE Stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tum aktif depolari paralel sorgular, sonuclari geldikce SSE event olarak stream eder.
// Not: auth query-string token ile degil Authorization header ile yapilmalidir.
app.get('/api/search-smart', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'query gerekli' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const write = (payload) => {
    if (closed) return;
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* client kapandı */ }
  };

  searchEngine.search(q, {
    onResult(providerId, results, depotUrl) {
      const depotInfo = DEPOT_CLASSES[providerId];
      let url = depotInfo?.url || '';
      if (url.includes('{query}')) url = url.replace('{query}', encodeURIComponent(q));

      write({
        type: 'results',
        depotId: providerId,
        depot: depotInfo?.name || providerId,
        depotUrl: depotUrl || url,
        results: results.map(r => ({ ...r, depot: depotInfo?.name || providerId })),
      });
    },
    onError(providerId, err) {
      write({
        type: 'error',
        depotId: providerId,
        depot: DEPOT_CLASSES[providerId]?.name || providerId,
        error: err?.message || String(err),
      });
    },
    onDone() {
      write({ type: 'done' });
      if (!closed) res.end();
    },
  });
});

app.post('/api/quote-option', requireAuth, async (req, res) => {
  const { depotId, item, option, targetQty } = req.body || {};
  if (!depotId || !item) {
    return res.status(400).json({ success: false, error: 'depotId ve item gerekli' });
  }

  const targetDepot = getConfiguredDepotById(depotId);
  if (!targetDepot) {
    return res.status(404).json({ success: false, error: 'Depot ayarli degil' });
  }

  if (typeof targetDepot.quoteOption !== 'function') {
    return res.json({ success: true, quote: null });
  }

  try {
    const quote = await targetDepot.quoteOption(item, option || {}, targetQty || 1);
    res.json({ success: true, quote });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Depot ayarlarını getir (şifreleri gizle)
app.get('/api/config', requireAuth, (req, res) => {
  const config = loadConfig();
  const safe = { depots: {}, availableDepots: {} };

  // Mevcut ayarlanmış depolar
  for (const [key, val] of Object.entries(config.depots)) {
    // Åifreyi hariç tut, diğer credential'ları döndür
    const creds = applyCredentialMask(val.credentials || {});
    safe.depots[key] = {
      enabled: true,
      hasCredentials: Object.values(val.credentials || {}).some((entry) => String(entry || '').trim()),
      hasCookies: !!val.cookies,
      hasToken: !!val.token,
      credentials: creds,
      hasSavedPassword: Boolean(val.credentials?.sifre || val.credentials?.password),
    };
  }

  // Tüm mevcut depolar (ayarlanmamışlar dahil)
  for (const [key, info] of Object.entries(DEPOT_CLASSES)) {
    safe.availableDepots[key] = {
      name: info.name,
      authType: info.authType,
      configured: !!config.depots[key],
    };
  }

  res.json(safe);
});

app.get('/api/demo/panel', requireAdmin, (req, res) => {
  const demoState = loadDemoPanelState();
  const activeAccount = getActiveAccount();
  const accountSummaries = listAccounts().map((account) => ({
    userId: account?.user?.userId || '',
    displayName: account?.user?.displayName || 'Eczane',
    role: account?.user?.role || 'admin',
    depotCount: Object.keys(account?.depots || {}).length,
  }));

  res.json({
    success: true,
    selectedRole: demoState.selectedRole || 'admin',
    updatedAt: demoState.updatedAt || null,
    currentUser: req.user,
    activeAccount: activeAccount ? {
      userId: activeAccount.user?.userId || '',
      displayName: activeAccount.user?.displayName || 'Eczane',
      role: activeAccount.user?.role || 'admin',
      depotCount: Object.keys(activeAccount.depots || {}).length,
    } : null,
    profiles: [
      {
        id: 'admin',
        label: 'Admin Panel',
        description: 'Depo baglantilari, tanilar, test arayuzu ve tum ayarlar gorunur.',
        capabilities: ['Depo yonetimi', 'Test login', 'Tanı loglari', 'Update kontrolu'],
      },
      {
        id: 'staff',
        label: 'User Panel',
        description: 'Arama, plan ve gecmis odakli daha sade bir panel demodur.',
        capabilities: ['Arama', 'Siparis plani', 'Gecmis', 'Sade gorunum'],
      },
    ],
    accounts: accountSummaries,
  });
});

app.post('/api/demo/panel', requireAdmin, (req, res) => {
  const requestedRole = String(req.body?.selectedRole || '').trim();
  const selectedRole = requestedRole === 'staff' ? 'staff' : 'admin';
  const nextState = {
    selectedRole,
    updatedAt: new Date().toISOString(),
  };
  saveDemoPanelState(nextState);
  res.json({ success: true, ...nextState });
});

app.post('/api/test/session/start', requireAdmin, (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim() || `v22-${Date.now()}`;
  const existing = testSessionStore.get(sessionId);
  const next = {
    sessionId,
    scenario: String(req.body?.scenario || '').trim(),
    note: String(req.body?.note || '').trim(),
    relayClientLogs: req.body?.relayClientLogs !== false,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  testSessionStore.set(sessionId, next);
  activeTestSessionId = sessionId;
  if (!clientLogStore.has(sessionId)) clientLogStore.set(sessionId, []);

  res.json({
    ok: true,
    sessionId,
    session: sanitizeTestSession(next),
  });
});

app.get('/api/test/session/current', requireAdmin, (req, res) => {
  const session = activeTestSessionId ? testSessionStore.get(activeTestSessionId) : null;
  res.json({
    ok: true,
    sessionId: activeTestSessionId,
    session: sanitizeTestSession(session),
    logCount: activeTestSessionId ? getClientLogs(activeTestSessionId).length : 0,
  });
});

app.post('/api/test/client-log', requireAdmin, (req, res) => {
  const requestedSessionId = String(req.body?.sessionId || activeTestSessionId || '').trim();
  if (!requestedSessionId) {
    res.status(400).json({ ok: false, error: 'sessionId gerekli' });
    return;
  }

  if (!testSessionStore.has(requestedSessionId)) {
    testSessionStore.set(requestedSessionId, {
      sessionId: requestedSessionId,
      scenario: '',
      note: '',
      relayClientLogs: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  const entry = {
    id: `${requestedSessionId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sessionId: requestedSessionId,
    source: String(req.body?.source || 'renderer'),
    type: String(req.body?.type || 'diagnostic'),
    message: String(req.body?.message || ''),
    meta: req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {},
    timestamp: Number(req.body?.timestamp) || Date.now(),
    receivedAt: Date.now(),
  };

  const logs = getClientLogs(requestedSessionId);
  logs.unshift(entry);
  if (logs.length > 500) logs.length = 500;
  clientLogStore.set(requestedSessionId, logs);
  activeTestSessionId = requestedSessionId;

  const session = testSessionStore.get(requestedSessionId);
  if (session) {
    session.updatedAt = Date.now();
    testSessionStore.set(requestedSessionId, session);
  }

  res.json({ ok: true, entry });
});

app.get('/api/test/client-log', requireAdmin, (req, res) => {
  const sessionId = String(req.query?.sessionId || activeTestSessionId || '').trim();
  res.json({
    ok: true,
    sessionId,
    logs: sessionId ? getClientLogs(sessionId) : [],
  });
});

app.delete('/api/test/client-log', requireAdmin, (req, res) => {
  const sessionId = String(req.query?.sessionId || activeTestSessionId || '').trim();
  if (!sessionId) {
    res.status(400).json({ ok: false, error: 'sessionId gerekli' });
    return;
  }

  clientLogStore.set(sessionId, []);
  res.json({
    ok: true,
    sessionId,
    cleared: true,
  });
});

app.post('/api/depots/keep-alive', requireAdmin, async (req, res) => {
  const forceRefresh = Boolean(req.body?.forceRefresh);
  const maxAgeMs = Number(req.body?.maxAgeMs) || (20 * 60 * 1000);
  const results = {};

  await Promise.all(
    Object.keys(DEPOT_CLASSES).map(async (depotId) => {
      const depot = getConfiguredDepotById(depotId);
      if (!depot) {
        results[depotId] = { configured: false, success: false, refreshed: false };
        return;
      }

      try {
        const session = await refreshDepotSession(depot, { forceRefresh, maxAgeMs });
        results[depotId] = {
          configured: true,
          success: !!session?.success,
          refreshed: !!session?.refreshed,
          error: session?.error || null,
        };
      } catch (error) {
        results[depotId] = {
          configured: true,
          success: false,
          refreshed: false,
          error: error?.message || 'Keep-alive hatasi',
        };
      }
    })
  );

  res.json({
    success: true,
    results,
    timestamp: Date.now(),
  });
});

// Depot ayarlarını kaydet
app.post('/api/config/depot', requireAdmin, (req, res) => {
  const { depotId, credentials, cookies, token } = req.body;

  if (!depotId) {
    return res.status(400).json({ error: 'depotId gerekli' });
  }

  const userId = requireUserId(req, res);
  if (!userId) return;
  const config = loadConfig();
  if (!config.depots) config.depots = {};

  // Mevcut credentials ile merge et — boş gönderilen alanlar eski değeri korusun
  const savedCreds = config.depots[depotId]?.credentials || {};
  const mergedCredentials = mergeCredentialInput(savedCreds, credentials || {});

  const nextConnection = {
    credentials: mergedCredentials,
    cookies: cookies || config.depots[depotId]?.cookies || null,
    token: token || config.depots[depotId]?.token || null,
    ciSession: config.depots[depotId]?.ciSession || null,
  };
  config.depots[depotId] = nextConnection;

  saveDepotConnection(userId, depotId, nextConnection);
  initDepots();

  res.json({ success: true });
});

// Depot sil
app.delete('/api/config/depot/:depotId', requireAdmin, (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  deleteDepotConnection(userId, req.params.depotId);
  initDepots();
  res.json({ success: true });
});

// Login test — credential'larla login denemesi yap
app.post('/api/test-login', requireAdmin, async (req, res) => {
  try {
  const { depotId, credentials } = req.body;
  const userId = requireUserId(req, res);
  if (!userId) return;

  const depotInfo = DEPOT_CLASSES[depotId];
  if (!depotInfo) {
    return res.status(400).json({ success: false, error: 'Bilinmeyen depot' });
  }

  // Åifre girilmediyse config'deki mevcut şifreyi kullan
  const config = loadConfig();
  const runtimeDepot = manager.depots.find(d => d.name === depotInfo.name);
  const runtimeCreds = runtimeDepot?.credentials || {};
  const savedCreds = {
    ...runtimeCreds,
    ...(config.depots?.[depotId]?.credentials || {}),
  };
  const mergedCredentials = mergeCredentialInput(savedCreds, credentials || {});

  const hasProvidedCredentials = Object.values(credentials || {}).some(value => String(value || '').trim());
  if (!hasProvidedCredentials && runtimeDepot) {
    const runtimeResult = await runtimeDepot.login();
    if (runtimeResult.success) {
      if (!config.depots) config.depots = {};
      config.depots[depotId] = {
        credentials: runtimeDepot.credentials || savedCreds,
        cookies: runtimeDepot.cookies || config.depots?.[depotId]?.cookies || null,
        token: runtimeDepot.token || config.depots?.[depotId]?.token || null,
        ciSession: runtimeDepot.ciSession || config.depots?.[depotId]?.ciSession || null,
      };
      saveDepotConnection(userId, depotId, config.depots[depotId]);
      initDepots();
    }
    return res.json(runtimeResult);
  }

  const depot = new depotInfo.cls(mergedCredentials);
  const savedDepotConfig = config.depots?.[depotId] || {};
  if (depotInfo.authType === 'cookie' && savedDepotConfig.cookies && typeof depot.setCookies === 'function') {
    depot.setCookies(savedDepotConfig.cookies);
  }
  if (depotInfo.authType === 'token' && savedDepotConfig.token && typeof depot.setToken === 'function') {
    depot.setToken(savedDepotConfig.token, savedDepotConfig.ciSession || null);
  }
  const result = await depot.login();

  if (result.success) {
    if (!config.depots) config.depots = {};
    config.depots[depotId] = {
      credentials: mergedCredentials,
      cookies: depot.cookies || null,
      token: depot.token || null,
      ciSession: depot.ciSession || null,
    };
    saveDepotConnection(userId, depotId, config.depots[depotId]);
    initDepots();
  }

  res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: `Login testi hatasi: ${err.message}` });
  }
});

// â”€â”€ Alım Geçmişi â”€â”€
const HISTORY_PATH = getDataFilePath('history.json');

function loadHistory() {
  try {
    ensureDataFile('history.json', []);
    if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  } catch (e) {}
  return [];
}

function saveHistory(data) {
  ensureDataFile('history.json', []);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
}

const CLIENT_STATE_PATH = getDataFilePath('client-state.json');

function loadClientStateStore() {
  try {
    ensureDataFile('client-state.json', {});
    if (fs.existsSync(CLIENT_STATE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CLIENT_STATE_PATH, 'utf-8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch (e) {}
  return {};
}

function saveClientStateStore(data) {
  ensureDataFile('client-state.json', {});
  fs.writeFileSync(CLIENT_STATE_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/client-state', requireAuth, (req, res) => {
  const userId = req.user?.userId || getCurrentUserId() || 'local';
  const store = loadClientStateStore();
  const entry = store[userId] || {};
  res.json({
    orderPlan: Array.isArray(entry.orderPlan) ? entry.orderPlan : [],
    approvalQueue: Array.isArray(entry.approvalQueue) ? entry.approvalQueue : [],
  });
});

app.put('/api/client-state', requireAuth, (req, res) => {
  const userId = req.user?.userId || getCurrentUserId() || 'local';
  const store = loadClientStateStore();
  store[userId] = {
    orderPlan: Array.isArray(req.body?.orderPlan) ? req.body.orderPlan : [],
    approvalQueue: Array.isArray(req.body?.approvalQueue) ? req.body.approvalQueue : [],
    updatedAt: new Date().toISOString(),
  };
  saveClientStateStore(store);
  res.json({ success: true });
});

app.get('/api/history', requireAuth, (req, res) => {
  const userId = req.user?.userId || getCurrentUserId() || 'local';
  const history = loadHistory().filter((entry) => (entry.userId || 'local') === userId);
  const limit = parseInt(req.query.limit) || 100;
  res.json(history.slice(0, limit));
});

app.post('/api/history', requireAuth, (req, res) => {
  const { ilac, barkod, sonuclar, enUcuz } = req.body;
  if (!ilac) return res.status(400).json({ error: 'İlaç adı gerekli' });

  const userId = req.user?.userId || getCurrentUserId() || 'local';
  const history = loadHistory();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId,
    tarih: new Date().toISOString(),
    ilac,
    barkod: barkod || null,
    sonuclar: sonuclar || [],
    enUcuz: enUcuz || null,
  };
  history.unshift(entry);
  if (history.length > 500) history.length = 500;
  saveHistory(history);
  res.json({ success: true, id: entry.id });
});

app.delete('/api/history/:id', requireAuth, (req, res) => {
  const userId = req.user?.userId || getCurrentUserId() || 'local';
  let history = loadHistory();
  history = history.filter(h => !(h.id === req.params.id && (h.userId || 'local') === userId));
  saveHistory(history);
  res.json({ success: true });
});

// â”€â”€ History Migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function migrateHistory() {
  const sentinelPath = getDataFilePath('history.migrated');
  if (fs.existsSync(sentinelPath)) return;

  try {
    const history = loadHistory();
    let changed = false;
    for (const entry of history) {
      if (!entry.userId) {
        entry.userId = 'local';
        changed = true;
      }
    }
    if (changed) saveHistory(history);
    fs.writeFileSync(sentinelPath, new Date().toISOString(), 'utf-8');
    console.log('[history] Migration tamamlandı: userId alanı eklendi');
  } catch (err) {
    console.error('[history] Migration hatası:', err.message);
  }
}

// â”€â”€ Start â”€â”€
ensureConfigFile();
console.log(`[config] Server config: ${CONFIG_PATH}`);
console.log(`[history] Server history: ${HISTORY_PATH}`);
migrateHistory();
initDepots();
app.listen(PORT, HOST, () => {
  console.log(`\n  Eczane App calisiyor: http://${HOST}:${PORT}\n`);
});
