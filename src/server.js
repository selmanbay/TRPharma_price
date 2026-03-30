const express = require('express');
const path = require('path');
const DepotManager = require('./depot-manager');
const SelcukDepot = require('./depots/selcuk');
const NevzatDepot = require('./depots/nevzat');
const AnadoluPharmaDepot = require('./depots/anadolu-pharma');
const AnadoluItriyatDepot = require('./depots/anadolu-itriyat');
const AllianceDepot = require('./depots/alliance');
const SentezDepot = require('./depots/sentez');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'renderer')));

// Depot manager
const manager = new DepotManager();

// Config dosyası yolu
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

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

// Başlangıçta config'den depot'ları yükle
function initDepots() {
  const config = loadConfig();
  manager.depots = [];

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
      console.log(`[+] ${depotInfo.name} yüklendi`);
    }
  }
}

// ── API Routes ──

// Autocomplete — Selçuk'tan isim+barkod, diğer depolardan yedek barkod
app.get('/api/autocomplete', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  // Tüm depolardan paralel arama yap
  const promises = manager.depots.map(d => d.search(q).catch(() => ({ depot: d.name, results: [] })));
  const allResults = await Promise.all(promises);

  // Selçuk sonuçlarını öncelikli kullan
  const selcukResult = allResults.find(r => r.depot === 'Selçuk Ecza' && r.results?.length > 0);
  let primaryResults = selcukResult?.results;
  let source = selcukResult?.depot;

  // Selçuk yoksa ilk sonuç dönen depoyu kullan
  if (!primaryResults || primaryResults.length === 0) {
    for (const r of allResults) {
      if (r.results && r.results.length > 0) {
        primaryResults = r.results;
        source = r.depot;
        break;
      }
    }
  }

  if (!primaryResults || primaryResults.length === 0) {
    return res.json({ suggestions: [] });
  }

  // Selçuk sonuçları için GetIlacDetay'den barkod çek (paralel)
  const selcukDepot = manager.depots.find(d => d.name === 'Selçuk Ecza');
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
app.get('/api/search', async (req, res) => {
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
app.get('/api/search-depot', async (req, res) => {
  const { q, depotId } = req.query;
  if (!q || !depotId) return res.status(400).json({ error: 'Sorgu param eksik' });

  // İlgili depot instance'ını bul
  let targetDepot = null;
  const config = loadConfig();
  if (config.depots[depotId]) {
    const depotInfo = DEPOT_CLASSES[depotId];
    targetDepot = manager.depots.find(d => d.name === depotInfo.name);
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

// Depot ayarlarını getir (şifreleri gizle)
app.get('/api/config', (req, res) => {
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
app.post('/api/config/depot', (req, res) => {
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
app.delete('/api/config/depot/:depotId', (req, res) => {
  const config = loadConfig();
  delete config.depots[req.params.depotId];
  saveConfig(config);
  initDepots();
  res.json({ success: true });
});

// Login test — credential'larla login denemesi yap
app.post('/api/test-login', async (req, res) => {
  const { depotId, credentials } = req.body;

  const depotInfo = DEPOT_CLASSES[depotId];
  if (!depotInfo) {
    return res.status(400).json({ success: false, error: 'Bilinmeyen depot' });
  }

  // Şifre girilmediyse config'deki mevcut şifreyi kullan
  const config = loadConfig();
  const savedCreds = config.depots?.[depotId]?.credentials || {};
  const mergedCredentials = { ...savedCreds, ...credentials };
  // Boş string olan alanlar için saved değeri kullan
  for (const key of Object.keys(mergedCredentials)) {
    if (!mergedCredentials[key] && savedCreds[key]) {
      mergedCredentials[key] = savedCreds[key];
    }
  }

  const depot = new depotInfo.cls(mergedCredentials);
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
});

// ── Alım Geçmişi ──
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'history.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
  } catch (e) {}
  return [];
}

function saveHistory(data) {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/history', (req, res) => {
  const history = loadHistory();
  const limit = parseInt(req.query.limit) || 100;
  res.json(history.slice(0, limit));
});

app.post('/api/history', (req, res) => {
  const { ilac, barkod, sonuclar, enUcuz } = req.body;
  if (!ilac) return res.status(400).json({ error: 'İlaç adı gerekli' });

  const history = loadHistory();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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

app.delete('/api/history/:id', (req, res) => {
  let history = loadHistory();
  history = history.filter(h => h.id !== req.params.id);
  saveHistory(history);
  res.json({ success: true });
});

// ── Start ──
initDepots();
app.listen(PORT, () => {
  console.log(`\n  Eczane App çalışıyor: http://localhost:${PORT}\n`);
  // Otomatik tarayıcıda aç (sadece ilk başlatmada)
  if (process.env.ECZANE_OPEN_BROWSER !== '0') {
    const { exec } = require('child_process');
    exec(`start http://localhost:${PORT}`);
  }
});
