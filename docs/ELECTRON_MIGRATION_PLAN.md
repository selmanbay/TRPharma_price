# Eczane App — Electron Masaüstü Uygulama Dönüşüm Talimatları

## GENEL BAKIŞ

Bu proje şu anda Node.js/Express + vanilla HTML/CSS/JS olarak çalışan bir eczane ilaç fiyat karşılaştırma web uygulamasıdır. Amacımız bunu **Electron masaüstü uygulamasına** dönüştürmek. Uygulama, 6 Türk ilaç deposundan (B2B) eşzamanlı fiyat çekip karşılaştırma yapıyor.

---

## KRİTİK KURAL: DOKUNULMAYACAK DOSYALAR

**Bu dosyalara KESİNLİKLE dokunma, değiştirme, refactor etme:**

```
src/server.js           ← Express API sunucusu (tüm API route'ları)
src/depot-manager.js    ← Depo yönetim sınıfı
src/depots/selcuk.js    ← Selçuk Ecza adapter
src/depots/nevzat.js    ← Nevzat Ecza adapter
src/depots/sentez.js    ← Sentez B2B adapter
src/depots/alliance.js  ← Alliance Healthcare adapter
src/depots/anadolu-pharma.js   ← Anadolu Pharma adapter
src/depots/anadolu-itriyat.js  ← Anadolu İtriyat adapter
config.json             ← Kullanıcı kimlik bilgileri (şifreler dahil)
```

Bu dosyalar çalışan, test edilmiş backend mantığıdır. API endpoint'leri, depo scraping/parse logic'i, kimlik doğrulama — hepsi çalışıyor. **Sadece tüket, değiştirme.**

---

## MEVCUT MİMARİ (ANLA)

### Backend API Endpoint'leri (server.js — port 3000)
| Endpoint | Method | İşlev |
|----------|--------|-------|
| `/api/autocomplete?q=` | GET | İlaç adı/barkod önerisi (10 sonuç) |
| `/api/search-depot?q=&depotId=` | GET | Tek bir depodan arama. Response: `{ depot, depotUrl, error, results }` |
| `/api/config` | GET | Depo bağlantı durumları (şifreler hariç) |
| `/api/config/depot` | POST | Depo kimlik bilgilerini kaydet |
| `/api/config/depot/:depotId` | DELETE | Depo bilgilerini sil |
| `/api/test-login` | POST | Depo login testi + kaydet |
| `/api/history` | GET | Arama geçmişi (limit parametreli) |
| `/api/history` | POST | Geçmişe kaydet |
| `/api/history/:id` | DELETE | Geçmişten sil |

### Arama Sonuç Formatı (her result item)
```json
{
  "ad": "ARVELES 25 MG 20 FTB.",
  "kodu": "21827",
  "fiyat": "109,83",
  "fiyatNum": 109.83,
  "stok": 490,
  "stokVar": true,
  "stokGosterilsin": true,
  "malFazlasi": "9+1",
  "imgUrl": "https://...",
  "depot": "Selçuk Ecza",
  "depotUrl": "https://webdepo.selcukecza.com.tr/..."
}
```

### 6 Depo ve URL'leri
| ID | Ad | Web URL |
|----|-----|---------|
| `selcuk` | Selçuk Ecza | `https://webdepo.selcukecza.com.tr/Siparis/hizlisiparis.aspx` |
| `nevzat` | Nevzat Ecza | `http://webdepo.nevzatecza.com.tr/Siparis/hizlisiparis.aspx` |
| `anadolu-pharma` | Anadolu Pharma | `https://b2b.anadolupharma.com` |
| `anadolu-itriyat` | Anadolu İtriyat | `https://b4b.anadoluitriyat.com` |
| `alliance` | Alliance Healthcare | `https://esiparisv2.alliance-healthcare.com.tr` |
| `sentez` | Sentez B2B | `https://www.sentezb2b.com/tr-TR/Site/Liste?tip=Arama&arama={query}&s=a` |

### Depo Login Bilgileri
`config.json` dosyasında saklanıyor. Her depoda `credentials`, `cookies`, `token` alanları var. Login flow: `/api/test-login` çağrıldığında server depot sınıfını kullanarak login olur, cookie/token alır, config.json'a kaydeder.

---

## ELECTRON DÖNÜŞÜM TALİMATLARI

### ADIM 1: Proje Yapısı

```
eczane-app/
├── main.js                  ← YENİ: Electron ana process
├── preload.js               ← YENİ: Güvenli IPC bridge
├── package.json             ← GÜNCELLE: Electron bağımlılıkları ekle
├── src/
│   ├── server.js            ← DOKUNMA (Express API — arka planda çalışacak)
│   ├── depot-manager.js     ← DOKUNMA
│   └── depots/              ← DOKUNMA (6 adapter dosyası)
├── renderer/                ← YENİ: Tüm frontend buraya taşınacak
│   ├── index.html           ← YENİ: Ana pencere HTML
│   ├── styles/
│   │   ├── main.css         ← YENİ: Ana stil dosyası
│   │   └── animations.css   ← YENİ: Geçiş animasyonları
│   ├── scripts/
│   │   ├── app.js           ← YENİ: Ana uygulama mantığı
│   │   ├── search.js        ← YENİ: Arama modülü
│   │   ├── depot-browser.js ← YENİ: Depo sitesi gömülü tarayıcı
│   │   └── history.js       ← YENİ: Geçmiş modülü
│   └── assets/
│       └── icons/           ← YENİ: Uygulama ikonları
├── config.json              ← DOKUNMA
└── data/
    └── history.json         ← DOKUNMA
```

### ADIM 2: package.json Güncelleme

```json
{
  "name": "eczane-app",
  "version": "2.0.0",
  "description": "Eczane İlaç Fiyat Karşılaştırma",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "dev": "electron . --dev"
  },
  "dependencies": {
    "axios": "^1.13.6",
    "cheerio": "^1.2.0",
    "express": "^5.2.1"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.eczane.app",
    "productName": "Eczane",
    "win": {
      "target": "nsis",
      "icon": "renderer/assets/icons/icon.ico"
    },
    "nsis": {
      "oneClick": true,
      "allowToChangeInstallationDirectory": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "runAfterFinish": true
    },
    "files": [
      "main.js",
      "preload.js",
      "src/**/*",
      "renderer/**/*",
      "config.json",
      "data/**/*",
      "node_modules/**/*"
    ]
  }
}
```

### ADIM 3: main.js — Electron Ana Process

```
Sorumlulukları:
1. Express server'ı child process olarak AYNI PROCESS İÇİNDE başlat (port 3000)
2. BrowserWindow oluştur (frameless veya custom title bar)
3. System tray ikonu ekle (sağ tık: Aç / Kapat)
4. Pencere kapatılınca tray'e küçült (tamamen kapatma)
5. Tek instance kontrolü (app.requestSingleInstanceLock)
6. Auto-updater (opsiyonel, sonra eklenebilir)
```

**main.js İçin Teknik Detaylar:**

```javascript
// Express'i doğrudan require et — ayrı process değil
// server.js'yi require etmeden ÖNCE ECZANE_OPEN_BROWSER=0 set et
// çünkü Electron kendi penceresini açacak, tarayıcı açmasına gerek yok
process.env.ECZANE_OPEN_BROWSER = '0';

// BrowserWindow ayarları:
// - width: 1280, height: 800, minWidth: 900, minHeight: 600
// - frame: false (custom title bar kullanacağız)
// - webPreferences.preload: preload.js
// - webPreferences.webviewTag: true (depo siteleri için)
// - backgroundColor: '#FFFFFF'

// Express server'ı başlat, hazır olunca pencereyi aç
// Server başlatma: require('./src/server.js') — bu dosya zaten app.listen() yapıyor
// Port hazır olduğunda mainWindow.loadURL('http://localhost:3000') YAPMA
// Bunun yerine mainWindow.loadFile('renderer/index.html') yap
// Frontend, API'ye http://localhost:3000 üzerinden fetch yapacak
```

### ADIM 4: preload.js — IPC Bridge

```
Sadece gerekli API'leri expose et:
- window.electronAPI.minimize()
- window.electronAPI.maximize()
- window.electronAPI.close()
- window.electronAPI.openDepotSite(url) — webview'da depo sitesini aç
- window.electronAPI.isMaximized()
```

### ADIM 5: Custom Title Bar

Mevcut navbar'ı genişlet:
- Sol: Sürüklenebilir alan (CSS: `-webkit-app-region: drag`)
- Sağ: Minimize / Maximize / Close butonları (Windows native görünüm)
- Mevcut Eczane logosu + profil menüsü korunsun

```css
.titlebar {
  -webkit-app-region: drag;
  height: 32px;
}
.titlebar button {
  -webkit-app-region: no-drag;
}
```

---

## ADIM 6: ANA UX AKIŞI (EN ÖNEMLİ KISIM)

### 6.1: Arama Deneyimi — Animasyonlu Geçiş

**Mevcut durum:** Arama yapınca sayfa tamamen değişiyor (showPage ile CSS display toggle)

**Hedef:** Uygulama hissi veren akıcı geçişler

```
ANA EKRAN (Home)
┌──────────────────────────────────────┐
│  [Logo]              [Profil]  [─□×] │ ← Custom title bar
│                                      │
│         En Uygun İlacı               │
│         Anında Bulun                 │
│                                      │
│    ┌─[🔍 İlaç adı veya barkod]──┐   │
│    └─────────────────────────────┘   │
│                                      │
│   ● Selçuk  ● Nevzat  ● Pharma ...  │ ← Depo kartları
└──────────────────────────────────────┘

    ↓ Arama yapılınca (animasyonlu geçiş) ↓

ARAMA SONUÇLARI
┌──────────────────────────────────────┐
│  [←] [🔍 arveles        ] [Profil]   │ ← Arama kutusu navbar'a taşınır
│──────────────────────────────────────│
│  ┌─────────────────────────────────┐ │
│  │ 💊 ARVELES 25 MG 20 FTB        │ │ ← Ürün kartı
│  │ Barkod: 8699832090055           │ │
│  │ 15 Teklif Bulundu               │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌─── EN UCUZ TEKLİF ────────────┐  │
│  │ Anadolu Pharma     ₺26,75     │  │
│  │ Stok: 490  MF: 10+12          │  │
│  │ [Depoya Git →]                 │  │ ← Tıklayınca sağda panel açılır
│  └────────────────────────────────┘  │
│                                      │
│  DİĞER DEPOLAR                      │
│  ┌────┬────────┬───────┬──────┬───┐  │
│  │Depo│ Stok   │ MF    │ Fiyat│ → │  │
│  ├────┼────────┼───────┼──────┼───┤  │
│  │... │ ...    │ ...   │ ...  │ → │  │
│  └────┴────────┴───────┴──────┴───┘  │
└──────────────────────────────────────┘
```

**Animasyon detayları:**

1. **Arama tetiklendiğinde:**
   - Hero başlık + alt metin `opacity: 0` + `translateY(-20px)` ile kaybolur (200ms)
   - Depo kartları `opacity: 0` + `scale(0.95)` ile kaybolur (200ms)
   - Arama kutusu yerinden navbar'a doğru `transform` ile kayar (400ms ease-out)
   - Arka plan glow efekti söner

2. **Sonuçlar geldiğinde:**
   - Ürün kartı `opacity: 0 → 1` + `translateY(20px) → 0` ile girer (300ms)
   - En ucuz teklif kartı aşağıdan süzülerek gelir (400ms, 100ms delay)
   - Tablo satırları sırayla girer — her satır 50ms gecikmeyle (staggered animation)

3. **Ana sayfaya dönüş:**
   - Tam tersi animasyon — sonuçlar kaybolur, hero geri gelir
   - Arama kutusu navbar'dan tekrar merkeze kayar

**CSS Geçiş Sınıfları:**
```css
.page-enter { animation: slideInUp 300ms ease-out forwards; }
.page-exit { animation: slideOutUp 200ms ease-in forwards; }
.stagger-item { animation: fadeInUp 300ms ease-out forwards; }
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 50ms; }
.stagger-item:nth-child(3) { animation-delay: 100ms; }
/* ... */

@keyframes slideInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 6.2: "Depoya Git" — Gömülü Depo Tarayıcı (WebView)

**Mevcut durum:** Yeni sekmede depo sitesi açılıyor, kullanıcı kendisi arama yapıyor.

**Hedef:** Uygulama içinde sağdan kayan panel ile depo sitesi açılsın, login zaten yapılı olsun.

```
ARAMA SONUÇLARI          │  DEPO TARAYICI (Sağdan kayar)
┌─────────────────────────┼────────────────────────────────┐
│                         │  [← Geri]  Selçuk Ecza    [×]  │
│  Sonuçlar...            │  ┌────────────────────────────┐ │
│                         │  │                            │ │
│                         │  │   <webview>                │ │
│                         │  │   Depo sitesi burada       │ │
│                         │  │   gösterilir               │ │
│                         │  │                            │ │
│                         │  │   Login otomatik           │ │
│                         │  │   yapılmış olacak          │ │
│                         │  │                            │ │
│                         │  └────────────────────────────┘ │
└─────────────────────────┴────────────────────────────────┘
```

**WebView Teknik Detayları:**

```html
<!-- renderer/index.html içinde -->
<div id="depot-browser-panel" class="depot-panel">
  <div class="depot-panel-header">
    <button onclick="closeDepotPanel()">← Geri</button>
    <span id="depot-panel-title">Depo Adı</span>
    <button onclick="closeDepotPanel()">×</button>
  </div>
  <webview id="depotWebview"
    partition="persist:depot"
    allowpopups
    style="width:100%; height:100%;">
  </webview>
</div>
```

```css
.depot-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 60%;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 24px rgba(0,0,0,0.15);
  transform: translateX(100%);
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 1000;
}
.depot-panel.open {
  transform: translateX(0);
}
```

**Login Yönetimi:**

Depo sitelerine login `config.json`'daki cookie/token bilgileriyle yapılacak. Her depo için:

1. **Cookie tabanlı depolar** (Selçuk, Nevzat, Alliance, Anadolu İtriyat, Sentez):
   - WebView açılmadan ÖNCE, `webview.getWebContents().session.cookies.set()` ile config'deki cookie'leri enjekte et
   - Cookie domain'leri: her deponun URL'sinden parse et

2. **Token tabanlı depolar** (Anadolu Pharma):
   - WebView yüklendikten sonra `webview.executeJavaScript()` ile localStorage'a token yaz
   - Veya header intercept ile Authorization header ekle

**Cookie enjeksiyon kodu (main.js veya preload.js üzerinden IPC ile):**

```javascript
async function injectDepotCookies(webview, depotId) {
  const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  const depotConfig = config.depots[depotId];
  if (!depotConfig || !depotConfig.cookies) return;

  const cookieString = depotConfig.cookies;
  const depotUrl = DEPOT_URLS[depotId]; // URL'den domain parse et
  const domain = new URL(depotUrl).hostname;

  // Cookie string'i parse et ve her birini set et
  const cookies = cookieString.split(';').map(c => c.trim()).filter(Boolean);
  const session = webview.getWebContents().session;

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=');
    const value = valueParts.join('=');
    await session.cookies.set({
      url: depotUrl,
      name: name.trim(),
      value: value.trim(),
      domain: domain,
    });
  }
}
```

**WebView açma akışı:**
1. Kullanıcı "Depoya Git" butonuna tıklar
2. `openDepotSite(depotUrl, depotId)` çağrılır
3. Cookie'ler enjekte edilir
4. Panel sağdan kayarak açılır
5. WebView depo URL'sini yükler — kullanıcı zaten login'li görür
6. Sentez için URL'de `?arama={query}` parametresi varsa direkt arama sonuçları gelir
7. Diğer depolar için: WebView yüklendikten sonra `executeJavaScript` ile arama kutusunu bul, ilaç adını yaz, formu submit et

**Otomatik arama (WebView yüklendikten sonra — opsiyonel ama çok değerli):**

```javascript
// Her depo için arama kutusunun CSS selector'ı
const DEPOT_SEARCH_SELECTORS = {
  selcuk: { input: '#txtAra', button: '#btnAra' },
  nevzat: { input: '#txtAra', button: '#btnAra' },
  'anadolu-pharma': { input: 'input[placeholder*="Ara"]', button: 'button[type="submit"]' },
  'anadolu-itriyat': { input: '#SearchText', button: '#SearchButton' },
  alliance: { input: '#txtSearch', button: '#btnSearch' },
  sentez: null, // URL parametresiyle zaten aranıyor
};

// WebView yüklendikten sonra:
webview.addEventListener('did-finish-load', () => {
  const selectors = DEPOT_SEARCH_SELECTORS[depotId];
  if (selectors && searchQuery) {
    webview.executeJavaScript(`
      const input = document.querySelector('${selectors.input}');
      if (input) {
        input.value = '${searchQuery}';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const btn = document.querySelector('${selectors.button}');
        if (btn) btn.click();
      }
    `);
  }
});
```

> **NOT:** Bu selector'lar tahmindir. Gerçek selector'ları bulmak için her depo sitesini Chrome DevTools ile incelemen gerekecek. Login yapıp arama sayfasına git, arama kutusuna sağ tıkla → Inspect → selector'ı al.

### 6.3: Hızlı Erişim — Keyboard Shortcuts

```javascript
// Global kısayollar (main.js — globalShortcut)
Ctrl+Shift+E → Uygulamayı ön plana getir / aç
Ctrl+F       → Arama kutusuna odaklan (pencere içi)
Escape       → Depo panelini kapat / Ana sayfaya dön
F5           → Aramayı yenile
```

### 6.4: System Tray

```javascript
// main.js
const tray = new Tray('renderer/assets/icons/tray-icon.png');
const contextMenu = Menu.buildFromTemplate([
  { label: 'Eczane App', enabled: false },
  { type: 'separator' },
  { label: 'Aç', click: () => mainWindow.show() },
  { label: 'Kapat', click: () => app.quit() },
]);
tray.setContextMenu(contextMenu);
tray.setToolTip('Eczane İlaç Fiyat Karşılaştırma');
tray.on('click', () => mainWindow.show());

// Pencere kapatma → tray'e küçült
mainWindow.on('close', (e) => {
  e.preventDefault();
  mainWindow.hide();
});
```

---

## ADIM 7: TASARIM SİSTEMİ

### Renk Paleti (KORUYUN)
```css
--accent: #DC2626;        /* Eczane kırmızısı — butonlar, vurgular */
--accent-hover: #B91C1C;  /* Hover durumu */
--best: #059669;           /* En ucuz fiyat — yeşil */
--status-green: #16A34A;  /* Bağlı / Stokta var */
--status-red: #DC2626;    /* Bağlı değil / Stok yok */
--bg-0: #FFFFFF;          /* Ana arka plan */
--bg-1: #FDF8F8;          /* Kart arka planı */
```

### Tipografi
- Font: Inter (zaten yüklü)
- Monospace: JetBrains Mono (barkodlar için)
- Başlıklar: 600-700 weight
- Body: 400-500 weight

### Animasyon Prensipleri
- Tüm geçişler `cubic-bezier(0.16, 1, 0.3, 1)` — doğal, yavaş bitiş hissi
- Giriş animasyonları: 200-400ms
- Çıkış animasyonları: 150-250ms (giriş'ten hızlı)
- Stagger (sıralı giriş): her eleman 40-60ms gecikme
- Hiçbir yerde `ease-in` kullanma (yapay hissettiriyor)
- Tercih: `ease-out` veya custom bezier

---

## ADIM 8: UYGULAMA İÇİ SAYFA GEÇİŞLERİ

### Sayfa yapısı (SPA — tek pencere)
```
Ana Ekran ←→ Arama Sonuçları ←→ Depo Panel (overlay)
     ↕              ↕
  Ayarlar       Geçmiş
```

### Geçiş Kuralları
| Nereden | Nereye | Animasyon |
|---------|--------|-----------|
| Ana → Arama | Arama kutusu yukarı kayar, hero kaybolur, sonuçlar aşağıdan gelir |
| Arama → Ana | Sonuçlar yukarı kaybolur, hero aşağıdan gelir, arama kutusu merkeze döner |
| Arama → Depo Panel | Panel sağdan kayarak açılır (overlay), arka plan karartılır |
| Depo Panel → Arama | Panel sağa kayarak kapanır |
| Ana → Ayarlar | Sağa slide geçiş |
| Ana → Geçmiş | Sağa slide geçiş |
| Ayarlar/Geçmiş → Ana | Sola slide geçiş (geri dönüş) |

---

## ADIM 9: ARAMA OPTİMİZASYONU

**Mevcut arama akışı (KORU — mantığı değiştirme):**
1. Kullanıcı yazar → 300ms debounce → `/api/autocomplete` → öneri listesi
2. Barkod tarayıcı (8/13 haneli numara) → debounce ATLA → direkt `doSearch()`
3. `doSearch()` → Aktif her depo için paralel `/api/search-depot` → sonuçlar geldiğinde anlık render

**Eklenecek optimizasyonlar:**
- Son 50 aramayı localStorage'da cache'le (aynı barkod tekrar aranırsa 0ms)
- Arama kutusunda skeleton loading (sonuçlar gelirken gri kutular)
- İlk depo sonucu geldiğinde hemen göster, diğerleri eklendikçe güncelle (şu an zaten yapılıyor, koru)

---

## ADIM 10: BUILD & DAĞITIM

### Development
```bash
npm install
npm run dev   # Electron dev mode (hot reload opsiyonel)
```

### Production Build
```bash
npm run build  # electron-builder ile .exe oluştur
# Output: dist/Eczane Setup.exe (tek dosya NSIS installer)
```

### Installer Davranışı
- Tek tık kurulum (oneClick: true)
- Masaüstü kısayolu otomatik
- Start menüsü kısayolu otomatik
- Kurulum sonrası otomatik başlat

---

## ADIM 11: DOSYA YAPISI ÖZETİ — NE OLUŞTURULACAK

```
YENİ DOSYALAR:
├── main.js                    ← Electron ana process
├── preload.js                 ← IPC bridge
├── renderer/
│   ├── index.html             ← Ana pencere (custom title bar + webview container)
│   ├── styles/
│   │   ├── main.css           ← Tüm stiller (mevcut style.css baz alınacak)
│   │   └── animations.css     ← Geçiş animasyonları
│   ├── scripts/
│   │   ├── app.js             ← Ana mantık (mevcut app.js baz alınacak)
│   │   ├── depot-browser.js   ← WebView kontrol + cookie enjeksiyon
│   │   └── transitions.js     ← Sayfa geçiş animasyonları
│   └── assets/
│       └── icons/
│           ├── icon.ico       ← Windows uygulama ikonu (256x256)
│           ├── icon.png       ← PNG ikon (512x512)
│           └── tray-icon.png  ← Tray ikonu (16x16 veya 32x32)

GÜNCELLENEN DOSYALAR:
├── package.json               ← Electron + builder bağımlılıkları

DOKUNULMAYAN DOSYALAR:
├── src/server.js
├── src/depot-manager.js
├── src/depots/*.js
├── config.json
└── data/history.json

SİLİNEBİLECEK DOSYALAR (Electron'a geçince gereksiz):
├── public/                    ← Eski web arayüzü (renderer/ ile değiştirildi)
├── start.vbs                  ← Electron kendi başlatıyor
├── kur.bat                    ← Installer ile değiştirildi
├── durdur.bat                 ← Tray'den kapatılıyor
└── create-shortcut.vbs        ← Installer kısayol oluşturuyor
```

---

## ADIM 12: KONTROL LİSTESİ

Tamamlandığında bunları doğrula:

- [ ] `npm run dev` ile uygulama açılıyor
- [ ] Custom title bar çalışıyor (sürükleme, minimize, maximize, close)
- [ ] Arama kutusu çalışıyor, autocomplete geliyor
- [ ] Barkod tarayıcı algılanıyor (8/13 haneli sayı → direkt arama)
- [ ] 6 depodan paralel sonuç geliyor
- [ ] Sonuçlar fiyata göre sıralı
- [ ] "Depoya Git" butonu sağdan panel açıyor
- [ ] WebView'da depo sitesi yükleniyor
- [ ] Depo sitesine cookie/token ile login yapılmış oluyor
- [ ] Arama geçmişi kaydediliyor ve görüntüleniyor
- [ ] Ayarlar sayfasından depo login bilgileri girilebiliyor
- [ ] System tray ikonu var, sağ tık menüsü çalışıyor
- [ ] Pencere kapatınca tray'e küçülüyor
- [ ] Ctrl+Shift+E ile uygulama ön plana geliyor
- [ ] Sayfa geçiş animasyonları akıcı
- [ ] `npm run build` ile .exe oluşuyor
- [ ] Installer çalışıyor, masaüstü kısayolu oluşuyor

---

## ÖNEMLİ NOTLAR

1. **Express server Electron içinde çalışacak** — ayrı terminal/process değil. `main.js` içinde `require('./src/server.js')` yap. Bu dosya zaten `app.listen(3000)` yapıyor. `ECZANE_OPEN_BROWSER=0` environment variable'ını set et ki tarayıcı açmasın.

2. **Frontend API çağrıları `http://localhost:3000/api/...`'e yapılacak** — aynen şu an olduğu gibi. fetch URL'lerini değiştirmeye gerek yok.

3. **`config.json` yolları** — Electron'da `__dirname` farklı çalışabilir. `app.getPath('userData')` veya `process.cwd()` kullanarak config.json'un doğru yerden okunduğundan emin ol. EN GÜVENLİSİ: server.js'deki CONFIG_PATH'i environment variable ile override edilebilir yap (ama server.js'e dokunma, main.js'de working directory'i ayarla).

4. **WebView partition** — `partition="persist:depot"` kullan ki cookie'ler oturumlar arası kalıcı olsun.

5. **Arama selector'ları** — DEPOT_SEARCH_SELECTORS'daki CSS selector'lar tahmindir. Her depo sitesini Chrome'da aç, DevTools ile gerçek selector'ları bul ve güncelle.

6. **İkon** — Kırmızı artı (+) işareti beyaz yuvarlak içinde — mevcut navbar'daki brand-pill ile aynı konsept. 256x256 ICO ve 512x512 PNG oluştur.
