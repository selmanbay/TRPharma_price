# AI_CHANGELOG — Makine Okunabilir Değişiklik Günlüğü

> **DIKKAT AI ASISTANI (ATTENTION ALL AI AGENTS):**
> Bu dosya sistemdeki kod değişikliklerinin tarihçesini en hızlı ve maliyetsiz (least token usage) şekilde okuyabilmeniz için özel olarak **"Makine Formatında" (Machine-Readable)** tasarlanmıştır.
>
> - Tüm geçmişi okumana gerek yoktur.
> - Eğer en son projenin ne durumda bırakıldığını anlamak istiyorsan sadece `@LATEST_CHANGE` bloğuna odaklan.
> - Yeni bir işlem yaptığında ESKİ `@LATEST_CHANGE` tag'ini `@ARCHIVED_CHANGE` olarak değiştir ve kendi yaptığın işlemi en tepeye `@LATEST_CHANGE` formatıyla YENİDEN EKLE.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-03-31T10:05:00
**SESSION:** Pharmacist Workflow Layer
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/index.html` | Ana sayfaya `Aktif Sipariş Planı` ve `Sabit İhtiyaç Listesi` kartları, sonuç ekranına aksiyon paneli, history ekranına `Rutin Alım Adayları` alanı eklendi.
- `renderer/scripts/app.js` | Frontend-only workflow katmanı yazıldı. `localStorage` tabanlı sipariş planı ve sabit ihtiyaç listesi, history insight üretimi ve sonuç ekranından bu akışlara ekleme davranışı eklendi.
- `renderer/styles/main.css` | Yeni operasyon kartları, sipariş listesi satırları, aksiyon paneli ve history insight alanları stillendi.
- `AI_CHANGELOG.md` | Son değişiklik kaydı güncellendi.
- `AI_CONTEXT.md` | Eczacı odaklı yeni workflow katmanı proje hafızasına işlendi.

**[ADDED/REMOVED]**
- **ADDED:** Sipariş planı özeti
- **ADDED:** Sabit ihtiyaç listesi
- **ADDED:** History tabanlı rutin alım adayları
- **NOT:** Fiyat/search/login/depot adapter mantığına dokunulmadı.

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
Bu feature seti tamamen `renderer/` katmanında tutuldu. Sipariş planı ve sabit ihtiyaçlar `localStorage` kullanır. `src/server.js`, `src/depot-manager.js` ve `src/depots/*.js` altındaki fiyat/search/login akışlarına dokunmayın.

---

### @ARCHIVED_CHANGE_009
**TIMESTAMP:** 2026-03-31T09:10:00
**SESSION:** Maintenance Guide & Feature Backlog
**AGENT:** Codex

**[MODIFIED_FILES]**
- `docs/MAINTENANCE_GUIDE.md` | Proje için kalıcı bakım rehberi eklendi. Mimari özet, klasör sorumlulukları, riskli alanlar, test rutini, değişiklik kuralları ve feature backlog yazıldı.
- `AI_CONTEXT.md` | Yeni bakım rehberi referansı ve önerilen ilk feature (`Fiyat Değişim Takibi`) proje hafızasına işlendi.
- `AI_CHANGELOG.md` | Son değişiklik kaydı güncellendi.

**[ADDED/REMOVED]**
- **ADDED:** Yeni onboarding ve bakım dokümanı.
- **ADDED:** Öncelikli feature backlog ve sıralı öneri listesi.

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
Bakım veya feature geliştirme öncesi önce `docs/MAINTENANCE_GUIDE.md` ve ardından `AI_CONTEXT.md` okunmalı. İlk tavsiye edilen feature, mevcut barkod ve history altyapısı üzerine kurulacak `Fiyat Değişim Takibi` özelliğidir.

---

### @ARCHIVED_CHANGE_008
**TIMESTAMP:** 2026-03-30T10:05:00
**SESSION:** Alliance Net Price (124,76) & QR Stability Fix
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `src/depots/alliance.js` | Alliance için %100 doğru Net Fiyat (124,76) yakalama motoru tamamlandı. `SelectedClass: "3"` ve `Quantity: 1` (number) senkronizasyonu ile 0-length response ve 'Unexpected Error' aşıldı.
- `renderer/scripts/app.js` | **Karekod Titreme Fixi**: `parseQRCode` metodu eklendi (GS1 DataMatrix -> 13 barkod). Seri okutmalarda ekranın zıplamasını önleyen 300ms 'Search Lock' ve 100ms 'UI Delay' mekanizmaları kuruldu.
- `AI_CONTEXT.md` | Alliance mimarisi ve Karekod stabilizasyon kuralları dokümantasyona eklendi.

**[ADDED/REMOVED]**
- **ADDED:** GS1 DataMatrix (Pharmacy QR) Parser: Uzun tarama dizilerinden barkodu (869...) temizler.
- **ADDED:** Concurrency Search Lock: Aynı barkodun saniyelik seri basımlarını filtreler.
- **FIXED:** Alliance Healthcare Net Price: Liste (136) vs Net (124) uyuşmazlığı giderildi.

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
Alliance'ta barkod araması yaparken `SelectedClass: "3"` PARAMETRESİ MECBURİDİR; aksi halde kampanyalar boş gelir. Karekod okutulduğunda `app.js` içindeki `parseQRCode` fonksiyonuna güvenin; manuel regex yazmayın.

---

### @ARCHIVED_CHANGE_007
**TIMESTAMP:** 2026-03-30T09:45:00
**SESSION:** Alliance Healthcare Net Price Fix (Initial Approach)
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | 13 digit Barkod tabanlı Entity (Varlık) modeline geçildi. `nameToBarcode` map'i ile depolar arası çapraz barkod tamamlama (Cross-ref) mantığı eklendi. `MIN_GATHER_TIME` (1.5sn) bekleme süresi ile UI zıplamaları engellendi. Enter tuşu zırhlandı.
- `renderer/styles/main.css` | Varyant seçimi "Görsel Destekli Liste" (List View) tasarımına dönüştürüldü. Animasyonlar (slideLeft) ve hover efektleri premium hale getirildi.
- `main.js` | Electron içerisinde WebView dahil tüm pencerelerde Sağ Tık (Copy/Paste) menüsü aktif edildi. `autoUpdater` log crash hatası fixlendi.
- `src/depots/selcuk.js` & `nevzat.js` | Arama sonuçlarında gelmeyen barkodlar için otomatik detay sayfasına gitme (scrape) ve barkod enjekte etme özelliği eklendi.

**[ADDED/REMOVED]**
- **ADDED:** Cross-Depot Barcode Sync: Bir depoda olan barkodun, aynı isimli başka bir deponun barkodsuz ürününe "Entity ID" olarak atanması sağlandı.
- **ADDED:** 1.5s Gathering Delay: Asenkron veri akışında görsel stabilite sağlandı.

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
Uygulama artık çok güçlü bir "Tekil Veri" (Single Entity) modeline sahiptir. İsim farklılıkları barkod eşleşmesi sayesinde otomatik olarak bertaraf edilir. Yeni bir depo eklerken mutlaka `barkod` alanının doluluğundan emin olun, aksi halde Cross-ref motoruna güvenin.

---

### @ARCHIVED_CHANGE_005
**TIMESTAMP:** 2026-03-30T08:15:00
**SESSION:** UX Dev: Variant Selection Layer (Gruplama Katmanı)
**AGENT:** Antigravity
**TIMESTAMP:** 2026-03-30T08:07:00
**SESSION:** Root Directory Aesthetics & Cleanup
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `create-shortcut.vbs`, `durdur.bat`, `kur.bat`, `start.vbs` | `scripts/` klasörüne taşındı.
- `public_old/` | Git'ten koparılmak üzere gizli `_archive/` klasörünün içine taşındı.

---

### @ARCHIVED_CHANGE_003
**TIMESTAMP:** 2026-03-30T07:55:00
**SESSION:** Git Initialization & OTA (Auto-Updater) System
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `package.json` | "electron-updater" eklendi. `build.publish` bloğuna "github" konfigürasyonu eklendi.
- `main.js` | Top seviyede `autoUpdater` modülü yüklendi. `app.whenReady()` bloğunda `autoUpdater.checkForUpdatesAndNotify()` arka plan tetikleyicisi yazıldı. Log transport aktifleştirildi.

**[ADDED/REMOVED]**
- **ADDED:** `.gitignore` dosyası oluşturuldu.
- **SECURITY:** `config.json` (Parolalar) ve `data/history.json` (Arama Kaydı) sıkı bir şekilde versiyon kontrolünden engellendi (Gizlendi).
- **GIT:** `git init` ve initial commit ile versiyon kontrolü resmen başladı.

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
Proje artık versiyon kontrolündedir. Config'e veri kaydederken şifre gibi hashlerin kodda değil her daim dışarıdan çekildiğine (.gitignore ile gizlenen yerlerden geldiğine) dikkat ediniz. Uygulamanın Build işleminden sonra OTA otomatik güncellemeleri açık durumdadır.

---

### @ARCHIVED_CHANGE_002
**TIMESTAMP:** 2026-03-30T07:46:00
**SESSION:** Directory Cleanup & Unified Architecture
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `src/server.js` (Satır: 16) | `public` dizini `renderer` olarak değiştirildi.
- `main.js` (Satır: 45-50) | `loadFile` yerine `loadURL('http://localhost:3000')` eklendi.
- `renderer/scripts/app.js` (Satır: 1-25 ve Satır: 620-630) | Titlebar `window.electronAPI` wrap içine alındı (Web ortamı stabilizasyonu).
- `AI_CONTEXT.md` | Single Source of Truth, Development Workflow ve Log kuralları eklendi.

**[ADDED/REMOVED]**
- **REMOVED:** Monolithic file logic, duplicate frontend contexts.
- **ADDED:** Directories `_archive`, `_backups`, `docs` for cleaning up.

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
Sistem şu an tam randımanlı Electron/Web unified (tekil) mimarisiyle çalışmaktadır. Yeni özellik geliştirmeden önce mutlaka Chrome (`localhost:3000`) üzerinden UI/Backend testi yapınız.

---

### @ARCHIVED_CHANGE_001
**TIMESTAMP:** 2026-03-27
**SESSION:** Electron Migration & Desktop Conversion
**AGENT:** Cursor

**[MODIFIED_FILES]**
- Tüm `public/` klasör öğeleri `renderer/` içine klonlandı.
- `main.js` native titlebar ve IPC Handler'lar eklendi.
- `renderer/scripts/app.js` arasına MF (Mal Fazlası) uçuş butonu arayüzü eklendi.
