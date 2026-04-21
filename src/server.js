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
const { isSetupComplete, setupUser, loginUser } = require('./auth');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

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
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 8;
const authRateLimitStore = new Map();

// Config dosyasÄ± yolu

// Depot sÄ±nÄ±flarÄ± haritasÄ±
const DEPOT_CLASSES = {
  selcuk: { cls: SelcukDepot, name: 'Selçuk Ecza', authType: 'cookie', url: 'https://webdepo.selcukecza.com.tr/Siparis/hizlisiparis.aspx' },
  nevzat: { cls: NevzatDepot, name: 'Nevzat Ecza', authType: 'cookie', url: 'http://webdepo.nevzatecza.com.tr/Siparis/hizlisiparis.aspx' },
  'anadolu-pharma': { cls: AnadoluPharmaDepot, name: 'Anadolu Pharma', authType: 'token', url: 'https://b2b.anadolupharma.com' },
  'anadolu-itriyat': { cls: AnadoluItriyatDepot, name: 'Anadolu İtriyat', authType: 'cookie', url: 'https://b4b.anadoluitriyat.com' },
  alliance: { cls: AllianceDepot, name: 'Alliance Healthcare', authType: 'cookie', url: 'https://esiparisv2.alliance-healthcare.com.tr' },
  sentez: { cls: SentezDepot, name: 'Sentez B2B', authType: 'cookie', url: 'https://www.sentezb2b.com/tr-TR/Site/Liste?tip=Arama&arama={query}&s=a' },
};

// Config yÃ¼kle
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Config okuma hatasi:', e.message);
  }
  return { depots: {} };
}

// Config kaydet
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
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
  return getRateLimitState(req).count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS;
}

function recordAuthFailure(req) {
  const state = getRateLimitState(req);
  state.count += 1;
  authRateLimitStore.set(getAuthRateLimitKey(req), state);
}

function clearAuthFailures(req) {
  authRateLimitStore.delete(getAuthRateLimitKey(req));
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
    selcuk: ['Selçuk Ecza', 'Selcuk Ecza', 'SelÃ§uk Ecza', 'SelÃƒÂ§uk Ecza'],
    nevzat: ['Nevzat Ecza'],
    'anadolu-pharma': ['Anadolu Pharma'],
    'anadolu-itriyat': ['Anadolu İtriyat', 'Anadolu Itriyat', 'Anadolu Ä°triyat', 'Anadolu Ã„Â°triyat'],
    alliance: ['Alliance Healthcare'],
    sentez: ['Sentez B2B'],
  };
  return [...new Set([...(aliasesByDepot[depotId] || []), depotInfo?.name].filter(Boolean))];
}

function findDepotInstance(depotId) {
  const aliases = new Set(getDepotAliases(depotId).map(normalizeDepotName));
  return manager.depots.find((depot) => aliases.has(normalizeDepotName(depot.name))) || null;
}

// BaÅŸlangÄ±Ã§ta config'den depot'larÄ± yÃ¼kle + Search Engine provider kayÄ±tlarÄ±
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

      // Search Engine: her depo bir provider olarak kayÄ±t olur
      searchEngine.register(depotId, {
        name: depotInfo.name,
        searchFn: (query) => depot.search(query),
      });
      searchEngine.activate(depotId);

      console.log(`[+] ${depotInfo.name} yÃ¼klendi`);
    }
  }
}

function getConfiguredDepotById(depotId) {
  if (!DEPOT_CLASSES[depotId]) return null;
  return findDepotInstance(depotId);
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
    await setupUser({ displayName, password });
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

// Autocomplete â€” SelÃ§uk'tan isim+barkod, diÄŸer depolardan yedek barkod
app.get('/api/autocomplete', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  const selcukDepot = findDepotInstance('selcuk');
  let primaryResults = null;
  let source = '';
  let allResults = [];

  // Ã–nce hÄ±zlÄ± yol: SelÃ§uk varsa sadece ondan suggestion Ã¼ret
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

  // SelÃ§uk sonuÃ§ vermezse fallback: tÃ¼m aktif depolar
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

  // DiÄŸer depolardan gelen barkodlarÄ± yedek olarak topla
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

  // Ä°lk 10 sonuÃ§ iÃ§in barkod getir
  const top10 = primaryResults.slice(0, 10);

  let suggestions;
  if (isSelcuk && selcukDepot && typeof selcukDepot.getProductDetail === 'function') {
    // SelÃ§uk detay API'sinden paralel barkod Ã§ek
    const detailPromises = top10.map(r =>
      selcukDepot.getProductDetail(r.kodu, r.ilacTip).catch(() => null)
    );
    const details = await Promise.all(detailPromises);

    suggestions = top10.map((r, i) => {
      let barcode = details[i]?.barkod || null;
      // SelÃ§uk detaydan gelemediyse diÄŸer depolardan dene
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
    // SelÃ§uk deÄŸilse, kodu 8 ile baÅŸlÄ±yorsa barkod, yoksa barcodeMap'ten
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

// Barkod ile tÃ¼m depolardan arama (Eski Monolithic Method)
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

// Tek bir depodan asenkron arama (Yeni HÄ±zlÄ± Method)
app.get('/api/search-depot', requireAuth, async (req, res) => {
  const { q, depotId } = req.query;
  if (!q || !depotId) return res.status(400).json({ error: 'Sorgu param eksik' });

  // Ä°lgili depot instance'Ä±nÄ± bul
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
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch { /* client kapandÄ± */ }
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

// Depot ayarlarÄ±nÄ± getir (ÅŸifreleri gizle)
app.get('/api/config', requireAuth, (req, res) => {
  const config = loadConfig();
  const safe = { depots: {}, availableDepots: {} };

  // Mevcut ayarlanmÄ±ÅŸ depolar
  for (const [key, val] of Object.entries(config.depots)) {
    // Åifreyi hariÃ§ tut, diÄŸer credential'larÄ± dÃ¶ndÃ¼r
    const creds = { ...(val.credentials || {}) };
    delete creds.sifre;
    delete creds.password;
    safe.depots[key] = {
      enabled: true,
      hasCredentials: !!val.credentials?.kullaniciAdi,
      hasCookies: !!val.cookies,
      hasToken: !!val.token,
      credentials: creds,
    };
  }

  // TÃ¼m mevcut depolar (ayarlanmamÄ±ÅŸlar dahil)
  for (const [key, info] of Object.entries(DEPOT_CLASSES)) {
    safe.availableDepots[key] = {
      name: info.name,
      authType: info.authType,
      configured: !!config.depots[key],
    };
  }

  res.json(safe);
});

// Depot ayarlarÄ±nÄ± kaydet
app.post('/api/config/depot', requireAdmin, (req, res) => {
  const { depotId, credentials, cookies, token } = req.body;

  if (!depotId) {
    return res.status(400).json({ error: 'depotId gerekli' });
  }

  const config = loadConfig();
  if (!config.depots) config.depots = {};

  // Mevcut credentials ile merge et â€” boÅŸ gÃ¶nderilen alanlar eski deÄŸeri korusun
  const savedCreds = config.depots[depotId]?.credentials || {};
  const mergedCredentials = { ...savedCreds, ...(credentials || {}) };
  for (const key of Object.keys(mergedCredentials)) {
    if (!mergedCredentials[key] && savedCreds[key]) {
      mergedCredentials[key] = savedCreds[key];
    }
  }

  config.depots[depotId] = {
    credentials: mergedCredentials,
    cookies: cookies || config.depots[depotId]?.cookies || null,
    token: token || config.depots[depotId]?.token || null,
    ciSession: config.depots[depotId]?.ciSession || null,
  };

  saveConfig(config);
  initDepots();

  res.json({ success: true });
});

// Depot sil
app.delete('/api/config/depot/:depotId', requireAdmin, (req, res) => {
  const config = loadConfig();
  delete config.depots[req.params.depotId];
  saveConfig(config);
  initDepots();
  res.json({ success: true });
});

// Login test â€” credential'larla login denemesi yap
app.post('/api/test-login', requireAdmin, async (req, res) => {
  try {
  const { depotId, credentials } = req.body;

  const depotInfo = DEPOT_CLASSES[depotId];
  if (!depotInfo) {
    return res.status(400).json({ success: false, error: 'Bilinmeyen depot' });
  }

  // Åifre girilmediyse config'deki mevcut ÅŸifreyi kullan
  const config = loadConfig();
  const runtimeDepot = manager.depots.find(d => d.name === depotInfo.name);
  const runtimeCreds = runtimeDepot?.credentials || {};
  const savedCreds = {
    ...runtimeCreds,
    ...(config.depots?.[depotId]?.credentials || {}),
  };
  const mergedCredentials = { ...savedCreds, ...(credentials || {}) };
  // BoÅŸ string olan alanlar iÃ§in saved deÄŸeri kullan
  for (const key of Object.keys(mergedCredentials)) {
    if (!mergedCredentials[key] && savedCreds[key]) {
      mergedCredentials[key] = savedCreds[key];
    }
  }

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
      saveConfig(config);
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
    saveConfig(config);
    initDepots();
  }

  res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: `Login testi hatasi: ${err.message}` });
  }
});

// â”€â”€ AlÄ±m GeÃ§miÅŸi â”€â”€
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

app.get('/api/history', requireAuth, (req, res) => {
  const history = loadHistory();
  const limit = parseInt(req.query.limit) || 100;
  res.json(history.slice(0, limit));
});

app.post('/api/history', requireAuth, (req, res) => {
  const { ilac, barkod, sonuclar, enUcuz } = req.body;
  if (!ilac) return res.status(400).json({ error: 'Ä°laÃ§ adÄ± gerekli' });

  const history = loadHistory();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: 'local',
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
  let history = loadHistory();
  history = history.filter(h => h.id !== req.params.id);
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
    console.log('[history] Migration tamamlandÄ±: userId alanÄ± eklendi');
  } catch (err) {
    console.error('[history] Migration hatasÄ±:', err.message);
  }
}

// â”€â”€ Start â”€â”€
ensureConfigFile();
console.log(`[config] Server config: ${CONFIG_PATH}`);
console.log(`[history] Server history: ${HISTORY_PATH}`);
migrateHistory();
initDepots();
app.listen(PORT, HOST, () => {
  console.log(`\n  Eczane App Ã§alÄ±ÅŸÄ±yor: http://${HOST}:${PORT}\n`);
  // Otomatik tarayÄ±cÄ±da aÃ§ (sadece ilk baÅŸlatmada)
  if (process.env.ECZANE_OPEN_BROWSER !== '0') {
    const { exec } = require('child_process');
    exec(`start http://${HOST}:${PORT}`);
  }
});


