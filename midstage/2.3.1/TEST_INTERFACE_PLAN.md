# V2.3 Test Interface Plan

Tarih: 2026-04-21
Durum: Faz 2 genisletildi
Hedef workspace: `D:\personal\eczane-app\midstage\2.3`

## 1. Amac

V2.3 icin test etme arayuzu su iki ihtiyaci ayni anda cozmeli:

1. Terminalden backend endpoint'lerine kolay ve tekrar edilebilir sekilde test atabilmek
2. Frontend'de olan biteni terminal veya dosya logu olarak gorup otomatik teste dahil edebilmek

Yani hedef yalniz `curl atmak` degil, su zinciri kurmaktir:

- test session baslat
- backend smoke cagir
- frontend diagnostic olaylarini topla
- sonucu terminalde ve artefakt dosyasinda gor

## 2. Bugunku Durum

Bugun elimizde parcali ama degerli iki temel parca var:

### 2.1 Backend terminal script ornegi var

Root'ta zaten bir ornek mevcut:

- `scripts/test-api-search-depot.js`

Bu script su konuda iyi bir temel:

- local token uretiyor
- auth'li endpoint'e terminalden istek atiyor
- JSON cevabi okunur bicimde basiyor

### 2.2 Frontend diagnostic buffer zaten var

`midstage/2.2/renderer/scripts/app.js` icinde zaten:

- `pushDiagnosticEvent()`
- `getDiagnosticsSnapshot()`
- `clearDiagnosticsBuffer()`

ve settings developer sekmesinde tanilar gorunuyor.

Bu da bize sunu gosteriyor:

- frontend test izi uretme mekanizmasi zaten var
- eksik olan sey bunun test oturumuna ve terminale tasinmasi

## 3. Hedef Mimari

V2.3 test arayuzu 5 katmanli olmali.

## Katman 1 - Runtime Control

Bu katman testten once uygulamayi ayaga kaldirir veya baglanir.

Hedef komutlar:

- `npm --prefix midstage/2.2 run test:health`
- `npm --prefix midstage/2.2 run test:backend -- search-depot 8683060010220 selcuk`
- `npm --prefix midstage/2.2 run test:session:start`

Gerekli araclar:

- `midstage/2.2/scripts/test-runtime.js`
- `midstage/2.2/scripts/test-auth.js`

Gorevi:

- server acik mi kontrol et
- gerekirse V2.2 runtime'ini baslat
- test token'i uret
- test session id olustur

## Katman 2 - Backend Test CLI

Bu katman terminalden okunabilir test komutlari verir.

Hedef:

- endpoint bazli smoke test
- depo bazli login test
- search ve quote test
- health ve config test

Onerilen komut yapisi:

```text
node scripts/test-backend-cli.js health
node scripts/test-backend-cli.js search-depot --query 8683060010220 --depot selcuk
node scripts/test-backend-cli.js quote-option --depot selcuk --barcode 8683060010220 --qty 10
node scripts/test-backend-cli.js test-login --depot nevzat
```

Beklenen ozellikler:

- her komut tek satir ozet + JSON detay uretsin
- exit code 0/1 net olsun
- `--json` ve `--pretty` desteklesin
- tum ciktiya `sessionId` eklensin

## Katman 3 - Frontend Diagnostic Relay

Bu katman planin en kritik parcasidir.

Sorun:

- su an frontend diagnostic olaylari sadece browser/Electron icinde yasiyor
- terminal tabanli smoke test bunu goremiyor

Cozum:

frontend event buffer'i test modunda backend'e relay edilmeli.

Onerilen akis:

1. frontend `pushDiagnosticEvent()` cagirir
2. test modu aciksa olay local buffer'a eklenir
3. ayni olay backend `POST /api/test/client-log` endpoint'ine de gonderilir
4. backend bunu session id bazli ring buffer'da tutar
5. terminal CLI bunu `GET /api/test/client-log?sessionId=...` ile okuyabilir

Onerilen endpoint'ler:

- `POST /api/test/client-log`
- `GET /api/test/client-log`
- `DELETE /api/test/client-log`

Payload:

```json
{
  "sessionId": "v22-20260419-001",
  "source": "renderer",
  "type": "search-success",
  "message": "Arama tamamlandi: 8683060010220",
  "meta": { "count": 4, "query": "8683060010220" },
  "timestamp": 1234567890
}
```

## Katman 4 - Scenario Runner

Bu katman tek tek endpoint testinden daha ileri bir seviyedir.

Amac:

- kullanici davranisina yakin smoke senaryolari yazmak

Ornek senaryolar:

- `search-basic`
- `search-auth-expired`
- `plan-add-flow`
- `bulk-search-basic`
- `settings-login-flow`

Onerilen komut:

```text
node scripts/test-scenario-runner.js search-basic --query 8683060010220 --session v22-smoke-1
```

Beklenen akış:

1. session baslat
2. gerekiyorsa test data hazirla
3. backend istegini at
4. frontend client-log akisini oku
5. pass/fail ozetini ver
6. artefakt dosyasi yaz

## Katman 5 - Consistency Runner

Bu katman canli GUI smoke yerine saf invariant ve parity kontrolleri kosar.

Amac:

- V2.2 ile V2.3 arasinda logic kaymasini erken yakalamak
- barkod ve karekod normalize akislarini seri kontrol etmek
- plan/search identity kurallarini tek komutla denetlemek

Onerilen komutlar:

```text
node scripts/test-consistency-runner.js all
node scripts/test-consistency-runner.js mf-parity
node scripts/test-consistency-runner.js bulk-normalization
node scripts/test-consistency-runner.js identity-grouping
```

Ilk kapsanan sabitler:

- `mf-parity`
  V2.3 `offer-domain.js` hesabi ile V2.2 `LegacyPricingEngine.js` fallback planner davranisi ayni mi?
- `bulk-normalization`
  GS1 karekod + barkod ayni canonical barkoda iniyor mu, tekrarlar adet olarak birlesiyor mu?
- `identity-grouping`
  search gruplama ve plan key adaylari ayni barkod etrafinda tutarli mi?

## 4. Test Oturumu Kavrami

Bu planin merkezinde `test session` kavrami olmali.

Sebebi:

- backend log
- frontend diagnostic olaylari
- terminal komut sonucu

ayni test kosusuna baglanabilmeli.

Test session alanlari:

- `sessionId`
- `startedAt`
- `scenario`
- `query`
- `depotId`
- `status`

Bu sayede bir smoke test sonunda su sorular cevaplanir:

- hangi komut kosuldu
- hangi endpoint cevap verdi
- frontend ne logladi
- hata nerede oldu

## 5. Ilk Fazda Yapilan Somut Isler

Bu plan tek seferde full sistem kurmayi onermiyor.

Uygulanan ilk faz:

1. `GET /api/health` eklendi
2. V2.2 icin terminal backend CLI script'i eklendi
3. `pushDiagnosticEvent()` test session algilarsa backend'e relay edecek sekilde guncellendi
4. session id bazli `client-log` endpoint'leri eklendi
5. `search-basic` icin ilk scenario runner yazildi

Eklenen dosyalar:

- `scripts/test-auth.js`
- `scripts/test-backend-cli.js`
- `scripts/test-scenario-runner.js`
- `scripts/test-consistency-runner.js`

Eklenen komutlar:

- `npm --prefix midstage/2.2 run test:health`
- `npm --prefix midstage/2.2 run test:backend -- ...`
- `npm --prefix midstage/2.2 run test:scenario -- ...`
- `npm --prefix midstage/2.3 run test:consistency -- ...`

## 6. Onerilen Dosya Yapisi

```text
midstage/2.2/
  scripts/
    test-auth.js
    test-runtime.js
    test-backend-cli.js
    test-scenario-runner.js
  test-artifacts/
  docs/
    TEST_INTERFACE_PLAN.md
```

Not:

- plan dosyasi simdilik rootte `midstage/2.2/TEST_INTERFACE_PLAN.md` olarak tutulur
- uygulama turlerinde istersek bunu `docs/` altina tasiyabiliriz

## 7. Terminal Arayuzu Tasarim Kurali

Bu CLI gercekten kullanilabilir olmali.

Kurallar:

- komut isimleri kisa olacak
- depo ve query parametreleri acik olacak
- cikti hem insan okunur hem parse edilebilir olacak

Onerilen cikti bicimi:

```text
[PASS] search-depot
session: v22-smoke-001
depot: selcuk
query: 8683060010220
resultCount: 1
elapsedMs: 842
```

ve `--json` ile:

```json
{
  "ok": true,
  "sessionId": "v22-smoke-001",
  "command": "search-depot",
  "depotId": "selcuk",
  "query": "8683060010220",
  "elapsedMs": 842,
  "payload": { "...": "..." }
}
```

## 8. Frontend Log Tasarim Kurali

Frontend diagnostic olaylari gelisiguzel console spam olmamali.

Her olay icin:

- `type`
- `message`
- `meta`
- `timestamp`
- `sessionId`

zorunlu olmali.

Ilk relay edilecek olaylar:

- `search-start`
- `search-success`
- `search-empty`
- `search-error`
- `search-depot-error`
- `renderer-error`
- `renderer-promise`
- `order-plan-error`

## 9. Kabul Kriterleri

Bu planin ilk uygulanmis hali kabul edilmis sayilabilmesi icin:

1. terminalden auth'li backend smoke atilabilmeli
2. backend health tek komutla gorulebilmeli
3. frontend diagnostic olaylari session id ile cekilebilmeli
4. en az bir senaryo (`search-basic`) tek komutla kosabilmeli
5. pass/fail cikisi CI veya lokal otomasyona uygun olmali

## 10. Sonraki En Mantikli Uygulama Sirasi

Tamamlananlar:

1. `GET /api/health`
2. `scripts/test-backend-cli.js`
3. frontend -> backend `client-log` relay
4. `GET/POST/DELETE /api/test/client-log`
5. `scripts/test-scenario-runner.js`

Siradaki mantikli adimlar:

1. terminalden V2.2 runtime baslatma/durdurma yardimcisi (`test-runtime.js`)
2. frontend relay olaylarini settings developer sekmesinde test session ile birlikte gostermek
3. login/setup ekranini da kapsayan Electron smoke testi
4. `quote-option` ve `test-login` senaryolari icin canned scenario runner'lar
5. test artefaktlarini dosyaya yazan `test-artifacts/` katmani

Bu sira bilerek secildi:

- once backend gorulebilir olsun
- sonra terminal arayuzu gelsin
- sonra frontend loglari baglansin
- en son senaryo katmani eklensin
