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
const { requireAuth } = require('./auth-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'renderer')));

// Depot manager + Search engine
const manager = new DepotManager();
const searchEngine = new SearchEngine();

const CONFIG_PATH = getConfigPath();

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

// Config yükle
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Config okuma hatası:', e.message);
  }
  return { depots: {} };
}

// Config kaydet
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

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
  const depotInfo = DEPOT_CLASSES[depotId];
  if (!depotInfo) return null;
  const aliases = new Set([
    depotInfo.name,
    depotId === 'selcuk' ? 'Selçuk Ecza' : '',
    depotId === 'anadolu-itriyat' ? 'Anadolu İtriyat' : '',
  ].filter(Boolean));
  return manager.depots.find((d) => aliases.has(d.name)) || null;
}

// ── Auth Routes (public) ──────────────────────────────────────────────────────

app.get('/api/auth/setup-status', (req, res) => {
  res.json({ needsSetup: !isSetupComplete() });
});

app.post('/api/auth/setup', async (req, res) => {
  try {
    const { displayName, password } = req.body;
    const auth = await setupUser({ displayName, password });
    const { token, user } = await loginUser(password);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Şifre gerekli' });
    const { token, user } = await loginUser(password);
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── API Routes ──

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

  const selcukDepot = manager.depots.find(d => d.name === 'Selçuk Ecza');
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

    const selcukResult = allResults.find(r => r.depot === 'Selçuk Ecza' && r.results?.length > 0);
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

  const isSelcuk = source === 'Selçuk Ecza';

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
    return res.status(400).json({ error: 'Hiç depot ayarlanmamış. Önce Ayarlar sayfasından depot ekleyin.' });
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
    const aliasesByDepot = {
      selcuk: ['Selçuk Ecza', 'SelÃ§uk Ecza'],
      nevzat: ['Nevzat Ecza'],
      'anadolu-pharma': ['Anadolu Pharma'],
      'anadolu-itriyat': ['Anadolu İtriyat', 'Anadolu Ä°triyat'],
      alliance: ['Alliance Healthcare'],
      sentez: ['Sentez B2B'],
    };
    const aliases = new Set([...(aliasesByDepot[depotId] || []), DEPOT_CLASSES[depotId]?.name].filter(Boolean));
    targetDepot = manager.depots.find(d => aliases.has(d.name)) || null;
  }

  if (!targetDepot) return res.status(404).json({ error: 'Depot ayarlı değil', results: [] });

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
          product.kodu = q; // Görsel tutarlılık
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

// ── Search Engine SSE Stream ──────────────────────────────────────────────────
// Tüm aktif depoları paralel sorgular, sonuçları geldikçe SSE event olarak stream eder.
// Frontend: EventSource('/api/search-smart?q=...&token=...')
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
    // Şifreyi hariç tut, diğer credential'ları döndür
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

// Depot ayarlarını kaydet
app.post('/api/config/depot', requireAuth, (req, res) => {
  const { depotId, credentials, cookies, token } = req.body;

  if (!depotId) {
    return res.status(400).json({ error: 'depotId gerekli' });
  }

  const config = loadConfig();
  if (!config.depots) config.depots = {};

  // Mevcut credentials ile merge et — boş gönderilen alanlar eski değeri korusun
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
app.delete('/api/config/depot/:depotId', requireAuth, (req, res) => {
  const config = loadConfig();
  delete config.depots[req.params.depotId];
  saveConfig(config);
  initDepots();
  res.json({ success: true });
});

// Login test — credential'larla login denemesi yap
app.post('/api/test-login', requireAuth, async (req, res) => {
  try {
  const { depotId, credentials } = req.body;

  const depotInfo = DEPOT_CLASSES[depotId];
  if (!depotInfo) {
    return res.status(400).json({ success: false, error: 'Bilinmeyen depot' });
  }

  // Şifre girilmediyse config'deki mevcut şifreyi kullan
  const config = loadConfig();
  const runtimeDepot = manager.depots.find(d => d.name === depotInfo.name);
  const runtimeCreds = runtimeDepot?.credentials || {};
  const savedCreds = {
    ...runtimeCreds,
    ...(config.depots?.[depotId]?.credentials || {}),
  };
  const mergedCredentials = { ...savedCreds, ...(credentials || {}) };
  // Boş string olan alanlar için saved değeri kullan
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

// ── Alım Geçmişi ──
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
  if (!ilac) return res.status(400).json({ error: 'İlaç adı gerekli' });

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

// ── History Migration ─────────────────────────────────────────────────────────

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

// ── Start ──
ensureConfigFile();
console.log(`[config] Server config: ${CONFIG_PATH}`);
console.log(`[history] Server history: ${HISTORY_PATH}`);
migrateHistory();
initDepots();
app.listen(PORT, () => {
  console.log(`\n  Eczane App çalışıyor: http://localhost:${PORT}\n`);
  // Otomatik tarayıcıda aç (sadece ilk başlatmada)
  if (process.env.ECZANE_OPEN_BROWSER !== '0') {
    const { exec } = require('child_process');
    exec(`start http://localhost:${PORT}`);
  }
});
