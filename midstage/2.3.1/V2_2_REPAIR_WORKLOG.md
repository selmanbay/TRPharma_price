# V2.2 Repair Worklog

Bu dosya V2.2 uzerinde yapilan canli onarimlarin izini tutar.
Amac:
- hangi dosya neden okundu
- hangi root-cause bulundu
- hangi degisiklik neden yapildi
- hangi test ne sonuc verdi

## 2026-04-19 - Security + DB-sim uyum onarimi

### Hedef
- depo credential alanlarinin tekrar gorunmesi
- depo durumlarinin UI'da saglikli gelmesi
- update sonrasi kullanicinin uygulamayi kullanmaya devam etmesi
- local admin/user demo panel zemininin acilmasi

### Okunan yerler
- `midstage/2.2/src/server.js`
  - `/api/config`
  - `/api/config/depot`
  - `/api/test-login`
  - auth ve loadConfig akisleri
- `midstage/2.2/src/account-store.js`
  - local account store yapisi
  - legacy config import adaylari
- `midstage/2.2/src/auth.js`
  - setup/login ve `userId` migration
- `midstage/2.2/renderer/scripts/app.js`
  - `loadDepotStatus()`
  - `buildDepotSettingsMarkup()`
  - `saveDepot()`
  - `testDepotLogin()`
- `midstage/2.2/renderer/src/core/storage.js`
  - auth token okuma/yazma uyumlulugu
- `midstage/2.2/renderer/src/core/AuthService.js`
  - moduler auth katmani

### Bulunan root-causelar
- Moduler storage, legacy login tokenini JSON gibi okuyordu; bu yuzden auth kaybolup `/api/config` 401 olabiliyordu.
- `/api/config` sifre alanlarini tamamen siliyordu; settings formu bu durumda password alanlarini bos gosteriyordu.
- Local account store import mantigi calisiyor ama update senaryolari icin daha genis legacy kaynaklardan beslenmesi gerekiyor.
- `renderer/scripts/app.js` icinde iki farkli `renderSettings()` vardi; eski tanim yeni rol-demo sekmesini ezebiliyordu.
- Moduler `AuthService` `localhost:3000` kullaniyordu, pencere ise `127.0.0.1:3000` uzerinden aciliyordu; bu capraz-origin sessiz bozulma riski yaratiyordu.

### Yapilan degisiklikler
- `renderer/src/core/storage.js`
  - JSON parse edilemeyen raw string token okuma destegi eklendi.
- `renderer/src/shared/storage/LocalJsonStore.js`
  - `createLocalJsonStore()` wrapper export eklendi.
- `renderer/src/state/PlanState.js`
  - `createPlanStateStore()` export eklendi.
- `renderer/src/shared/products/ProductIdentity.js`
  - `getProductIdentity()` export eklendi.
- `src/server.js`
  - `/api/config` artik sifre alanlarini tamamen silmek yerine `********` ile maskeliyor.
  - `save` ve `test-login` akislarinda maskeli sifre `mevcut sifreyi koru` olarak yorumlaniyor.
  - local rol demosu icin `/api/demo/panel` GET/POST endpoint'leri eklendi.
- `src/account-store.js`
  - legacy import adaylari `midstage/current-modular/config.json` ve root `config.json` ile genisletildi.
- `renderer/scripts/app.js`
  - local rol demo state loader eklendi.
  - ayarlara `Rol Demo` sekmesi ve local hesap ozeti paneli eklendi.
  - eski `renderSettings` compat moda cekildi; yeni owner `renderSettings` tek aktif tanim olarak birakildi.
  - legacy `API_BASE` sabiti `localhost` yerine `window.location.origin` tabanina cekildi.
- `renderer/src/core/AuthService.js`
  - API base ayni-origin olacak sekilde `window.location.origin` tabanina cekildi.
- `renderer/index.html`
  - CSP icine `127.0.0.1:3000` eklendi.
- `src/auth-middleware.js`
  - query-string token fallback kaldirildi; auth yalnizca Authorization header ile kabul edilir hale getirildi.
- `src/server.js`
  - `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store` header'lari eklendi.

### Bekleyen isler
- Electron runtime uzerinden canli UI smoke
- demo rol secimine gore daha belirgin panel farklari
- gercek DB entity taslagina gecis notlari

### Test notlari
- `node --input-type=module` ile `renderer/src/main.js` import testi gecti.
- `2.2` backend smoke: `/api/health` ve `/api/config` gecti.
- `/api/config` smoke sonucunda `selcuk.credentials.sifre === "********"` ve `hasSavedPassword === true`.
- `/api/demo/panel` smoke sonucunda `selectedRole=admin`, `profileCount=2`, `accountCount=1`.
- Maskeli sifre ile `/api/config/depot` save smoke gecti; mevcut sifre korunarak kayit devam etti.
- Electron profilindeki `AppData/Roaming/eczane-app-v2_2/data/local-accounts.json` dogrulandi; depo credential'lari gercekten dolu.
- Runtime kontrolunde Electron + backend tekrar kalkti; tum 6 depo yuklenmis olarak loglandi.
- Eski `failed to fetch` semptomunun ana nedeni bulundu: legacy `app.js` halen `http://localhost:3000` kullaniyordu; Electron penceresi `http://127.0.0.1:3000` origin'inde acildigi icin settings fetch'leri cross-origin kopuyordu.
- Query-string token fallback kaldirildi; URL sizintisi riski daraltildi.
- Header smoke sonucu: `nosniff`, `DENY`, `no-referrer`, `no-store` aktif.

## 2026-04-19 - Guvenlik turu devam

### Bu turda okunan dosyalar
- `midstage/2.2/src/auth-middleware.js`
- `src/auth-middleware.js`
- `midstage/2.2/src/server.js`
- `src/server.js`
- `midstage/2.2/renderer/scripts/app.js`
- `renderer/scripts/app.js`
- `midstage/2.2/renderer/index.html`
- `renderer/index.html`

### Bu turda bulunan riskler
- Autocomplete onerileri depo verisini highlight ederken `innerHTML` ile kuruluyordu; highlight metni HTML string uzerinden olustugu icin kalan bir XSS yuzeyi vardi.
- Yonetim agirlikli endpointler (`config/depot`, `test-login`, test session/client-log, keep-alive, demo-panel`) sadece `requireAuth` ile korunuyordu; ileride staff/user rolleri geldiginde sunucu tarafinda gereksiz genis yetki riski tasiyordu.
- CSP metasi temel koruma sagliyordu ama `object-src`, `frame-ancestors`, `base-uri` kisitlari eksikti.
- API cevaplari temel security header'lari tasiyordu fakat tarayici izolasyonu icin `COOP/CORP/Permissions-Policy` eksikti.

### Yapilan degisiklikler
- `midstage/2.2/src/auth-middleware.js`
- `src/auth-middleware.js`
  - `requireAdmin` middleware eklendi.
  - token payload -> `req.user` map'i tek helper'a toplandi.
- `midstage/2.2/src/server.js`
  - admin-only olmasi gereken endpointler `requireAdmin` altina alindi:
    - `/api/demo/panel`
    - `/api/test/session/*`
    - `/api/test/client-log`
    - `/api/depots/keep-alive`
    - `/api/config/depot`
    - `/api/test-login`
  - `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy` eklendi.
- `src/server.js`
  - root runtime icin de ayni ek security header'lari ve admin guard'lari eklendi.
- `midstage/2.2/renderer/scripts/app.js`
- `renderer/scripts/app.js`
  - autocomplete highlight render'i HTML string yerine `DocumentFragment + text node + mark` ile guvenli DOM kurulumuna cevrildi.
  - suggestion satiri artik `replaceChildren()` ile olusuyor; depo adindan script calistirma riski daraltildi.
- `midstage/2.2/renderer/index.html`
- `renderer/index.html`
  - CSP'ye `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` eklendi.
  - root index icin `127.0.0.1:3000` da izinli kaynak listesine alindi.

### Bu turun testleri
- `node --check`:
  - `midstage/2.2/src/auth-middleware.js`
  - `midstage/2.2/src/server.js`
  - `midstage/2.2/renderer/scripts/app.js`
  - `src/auth-middleware.js`
  - `src/server.js`
  - `renderer/scripts/app.js`
- `2.2` admin smoke:
  - admin token ile `/api/demo/panel` 200 dondu
  - `/api/config` 200 dondu
  - `demoRole=admin`, `accountCount=1`, `depotCount=6`
  - header smoke sonucu:
    - `Cross-Origin-Opener-Policy: same-origin`
    - `Cross-Origin-Resource-Policy: same-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
