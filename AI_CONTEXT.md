# AI_CONTEXT — Eczane App Proje Hafızası

> Bu dosya AI asistanlar arası bilgi aktarımı için kullanılır.
> Her değişiklik sonrası güncellenmelidir.

---

## Proje Genel Bakış

Eczane İlaç Fiyat Karşılaştırma uygulaması. 6 farklı ecza deposundan (Selçuk, Nevzat, Anadolu Pharma, Anadolu İtriyat, Alliance Healthcare, Sentez B2B) ilaç fiyatlarını çekerek karşılaştırır.

**Teknoloji**: Electron + Express (aynı process) + Vanilla JS frontend

---

## Mimari Kararlar

### Electron Migrasyonu (v2.0.0)
- **Karar**: Web app (Express + public/) → Electron desktop app (main.js + renderer/)
- **Sebep**: Masaüstü uygulama olarak dağıtım, system tray, WebView ile depo sitelerine erişim
- **Yöntem**: Express server `main.js` içinde `require('./src/server.js')` ile aynı process'te çalışır. `ECZANE_OPEN_BROWSER=0` ile tarayıcı açılması engellenir.
- **Renderer**: `file://` protokolüyle yüklenir, API çağrıları `http://localhost:3000` üzerinden yapılır.

### Streaming Arama Mimarisi
- **Karar**: Promise.all monolitik yapı terk edildi
- **Yöntem**: `app.js` → her depo için ayrı `/api/search-depot` fetch → sonuç geldikçe `renderResults()` ile DOM güncellenir
- **Sebep**: Kullanıcı en hızlı dönen deponun sonucunu beklemeden görür

### Unified Architecture (Tekil Mimari Kuralı - ÖNEMLİ)
- **Kural**: Electron Migrasyonundan sonra ortaya çıkan çoklu frontend sorunu (public vs renderer çakışması) giderilmiştir. Projenin BİR TEK backend'i ve BİR TEK arayüz dizini (`renderer/`) vardır.
- **Node.js Localhost**: `src/server.js` artık statik dosyaları eski `public/` yerine güncel UI dizini olan `renderer/` klasöründen sunar (`app.use(express.static('renderer'))`).
- **Electron Main**: `main.js`, Electron penceresini `file://` adresinden değil, direkt `http://localhost:3000` adresinden yükler (`mainWindow.loadURL('http://localhost:3000')`).
- **Amaç**: Electron.js Masaüstü versiyonu ile Chrome (Web) versiyonu tamamen **aynı** kod tabanını okur ve UI/Backend arasında hiçbir kod tekrarı / uyuşmazlık bulunmaz. Eski web frontend klasörü `public_old` olarak isimlendirilmiş ve kullanımdan kaldırılmıştır. Eski klasörleri dikkate almayınız!

### Stok Filtreleme (server.js satır 203)
- **Filtre**: `if (!product.stokVar || (product.stok === 0 && product.stokGosterilsin)) continue;`
- **stokGosterilsin=false** → stok miktarı bilgisi olmayan depolar için (Sentez, Anadolu İtriyat, Alliance). Bu flag `false` olunca stok=0 filtresi devre dışı kalır.
- **stokVar=true** (hardcoded) → Alliance için. Alliance `HasStock:false` dönse bile ürünleri gösteriyoruz çünkü fiyat karşılaştırması için gerekli.

---

## Depo Adaptörleri — Kritik Notlar

### Alliance Healthcare (`src/depots/alliance.js`)
- **Mart 2026 Düzeltmesi**: Alliance login sayfası SPA'ya geçti. GET `/Account/Login` artık boş HTML dönüyor (Content-Length: 0). `__RequestVerificationToken` artık sayfada yok.
- **Çözüm**: Login ve search fonksiyonlarından token zorunluluğu kaldırıldı. Token opsiyonel hale getirildi (`token || '_none_'`). Search header'ında token sadece varsa gönderiliyor.
- **Login**: Token olmadan POST `/Home/Login` JSON body ile çalışıyor, `{"Result":true}` dönüyor.
- **Search**: `__requestverificationtoken` header'ı olmadan da çalışıyor.

### Anadolu İtriyat (`src/depots/anadolu-itriyat.js`)
- **Düzeltme**: `stokGosterilsin: true` → `false` yapıldı. API'den `Quantity` alanı gelmiyor, her ürün `stok:0` oluyor ve server filtresi eliyordu.

### Sentez B2B (`src/depots/sentez.js`)
- Zaten `stokGosterilsin: false` kullanıyordu, sorun yoktu.

### Diğer depolar (Anadolu Pharma)
- Bu session'da değiştirilmedi, sorunsuz çalışıyor.

### Gerçek Fiyat (Net Tutar) Düzeltmesi (30 Mart 2026)
- **Problem**: 3 depo (Selçuk, Nevzat, Alliance) etiket/depocu fiyatı gösteriyordu, eczacının gerçek maliyeti (Net Tutar) değil
- **Selçuk Ecza** (`selcuk.js`): `calculatePrice()` method eklendi
  - Endpoint: `POST /Ilac/IlacGetir-ajax.aspx` — `action=IlacFiyatHesapla`
  - Params: `kod`, `miktar=1`, `satisSekli` (kampanyalardan), `etiketFiyati` (TR format), `ILACTIP`
  - Response field: `obj.netTutar` — KDV+iskonto dahil gerçek maliyet
  - `_fetchMFAndReturn()` 2 aşamalı oldu: GetIlacDetay (MF+satisSekli) → IlacFiyatHesapla (netTutar)
  - satisSekli: `grdKampanyalar[0].satisSekli`, varsayılan "A6"
- **Nevzat Ecza** (`nevzat.js`): Selçuk ile birebir aynı yapı (Boyut Bilişim altyapısı)
  - Aynı `calculatePrice()` + `_fetchMFAndReturn()` mantığı
  - NOT: Nevzat'ta satisSekli "E2" gelebilir, Selçuk'ta "A6" — her zaman kampanyalardan al!
- **Alliance Healthcare** (`alliance.js`): Farklı mimari
  - Endpoint: `POST /Sales/CalculateItemTotals`
  - Request: `{ ItemString: <rawBase64>, OfferString: <firstOffer base64>, Quantity: "01" }`
  - Response field: `Value.GrossTotal` — KDV dahil net tutar
  - `parseHtmlResponse()` artık `_rawBase64` saklıyor
  - `_parseResults()` artık `_rawBase64` ve `_firstOffer` döndürüyor
  - `_fetchPricesAndReturn()` method eklendi — search/doSearch sonrasında çağrılıyor
  - İç alanlar (`_rawBase64`, `_firstOffer`) response'tan temizleniyor
- **Doğru olan depolar**: Anadolu İtriyat ✅, Anadolu Pharma ✅, Sentez ✅ — değişiklik yok
- **Fallback**: Hesaplama hatası olursa orijinal fiyat korunur (graceful)
- **Performans**: Her depo için +10 paralel API çağrısı (~500ms ek süre)

---

## UI Özellikleri

### Custom Title Bar
- Frameless window + HTML/CSS title bar
- Minimize, maximize, close butonları IPC üzerinden

### MF (Mal Fazlası) Stok Hesaplayıcı
- **Konum**: Ürün kartının sağında küçük "MF Hesapla" trigger butonu
- **Davranış**: Tıklanınca flyout panel açılır (max-height animasyonu), tekrar tıklayınca kapanır
- **Mantık**:
  - `parseMf("10+3")` → `{buy:10, free:3, total:13}`
  - MF chip'leri: Her deponun MF'sine göre otomatik hesaplanan adet önerileri (1x, 2x, 3x, 4x, 5x batch)
  - En düşük efektif birim fiyatı veren miktar "★ en uygun" olarak işaretlenir
  - `calcMfOptions()`: Girilen miktar için her depodan en uygun MF/fiyat kombinasyonu, aynı depodan en ucuz seçilir
  - Sonuçlar efektif birim fiyata göre sıralanır, #1 yeşil "EN UYGUN" badge alır

### Depot Browser Panel
- WebView (`partition="persist:depot"`) ile depo sitelerine erişim
- Cookie injection main process'ten IPC ile yapılır (`inject-depot-cookies`)

### Sayfa Geçişleri
- CSS animasyonları: `page-enter`, `page-exit`, `page-enter-home`, `page-exit-home`
- Stagger animasyonlar: `.stagger-enter.stagger-delay-N`

---

## Build & Dağıtım

- **Dev**: `npx electron .` veya `npm start`
- **Build**: `npx electron-builder --win --x64`
- **Çıktı**: `dist/Eczane Setup 2.0.0.exe` (NSIS installer, ~84 MB)
- **Önemli**: `signAndEditExecutable: false` — code signing devre dışı (winCodeSign symlink hatası nedeniyle)
- **Portable**: `dist/win-unpacked/` klasörü doğrudan çalıştırılabilir

---

## Dosya Yapısı

```
eczane-app/
├── main.js                    # Electron main process
├── preload.js                 # Context bridge
├── package.json               # Electron + Express deps, build config
├── config.json                # ⚠️ DOKUNMA — Depo credentials
├── AI_CONTEXT.md              # ← Bu dosya (AI hafızası)
├── src/
│   ├── server.js              # ⚠️ Express API (port 3000)
│   ├── depot-manager.js       # ⚠️ Depo orchestrator
│   └── depots/                # ⚠️ Depo adaptörleri
│       ├── selcuk.js
│       ├── nevzat.js
│       ├── anadolu-pharma.js
│       ├── anadolu-itriyat.js
│       ├── alliance.js
│       └── sentez.js
├── renderer/
│   ├── index.html             # Ana HTML (titlebar, flyout, panels)
│   ├── scripts/
│   │   ├── app.js             # Ana uygulama JS
│   │   ├── depot-browser.js   # WebView yönetimi
│   │   └── transitions.js     # Animasyon yardımcıları
│   └── styles/
│       ├── main.css           # Tüm stiller
│       └── animations.css     # Sayfa geçiş animasyonları
├── data/
│   └── history.json           # ⚠️ DOKUNMA — Alım geçmişi
└── dist/                      # Build çıktıları
```

---

## Son Güncelleme

**Tarih**: 30 Mart 2026
**Session**: Unified Architecture & Development Workflow Rules, Gereksiz Dizin Temizliği

---

## 🛠️ Development Workflow (Geliştirme & Test Akışı Kuralı)

Tekil (Unified) Mimariye geçtiğimiz için, yazılan her kod hem Tarayıcıyı hem de Masaüstü Electron uygulamasını etkiler. Kod çakışmalarını ve Build hatalarını önlemek için şu aşamalar zorunludur:

1. **AŞAMA 1 (Saf Kodlama ve Web Testi):**
   - Herhangi bir UI (Arayüz) devşirmesi, DOM algortiması veya Backend (api) entegrasyonu yazıldığında, **ÖNCELİKLE** Chrome/Safari gibi standart bir tarayıcıdan `http://localhost:3000` üzerinden çalıştırılıp ayağa kaldırılacak.
   - Tüm UI / API asenkron testleri (Network Console incelemeleri) Web üzerinden doğrulanacak. Zira Web arayüzü bozuksa Electron da bozuk olacaktır.

2. **AŞAMA 2 (Electron ve Native Test):**
   - Aşama 1'de hatasız çalışan kod, Masaüstü native özelliklerini ve Layout'ları kırmadığını doğrulamak için `npx electron .` ile çalıştırılarak Local Desktop ortamında denenecek. 
   - Window IPC (`window.electronAPI`) hataları varsa bu aşamada giderilecek.

3. **AŞAMA 3 (Final Build - Dağıtım):**
   - Sadece ilk iki aşamadan sorunsuz geçmiş ve test edilmiş kodlar `npx electron-builder --win --x64` ile son kullanıcı Setup'ı (exe) haline getirilecek. Doğrudan 3. adıma geçmek kesinlikle **yasaktır**.

### Kayıt & Dokümantasyon Kuralı (MECBURİ)
- Projeye dokunan her AI Asistan (Cursor, Claude, Antigravity) yaptığı UFACIK BİR değişikliği veya büyük özellik geliştirmesini **kesinlikle ana dizindeki `AI_CHANGELOG.md` dosyasına not düşecektir.**
- **Log Formatı Zorunluluğu:** Değişiklik notu düşülürken sadece "UI güncellendi" denmeyecek; TAM OLARAK hangi dosyalara (örn: `renderer/scripts/app.js`), hangi satırlara veya fonksiyonlara müdahale edildiği açıkça `AI_CHANGELOG.md`'nin içindeki `@LATEST_CHANGE` bloğuna makine formatında yazılacaktır. Eski loglar aşağı kaydırılacak, yepyenisi en tepeye oturtulacaktır.
