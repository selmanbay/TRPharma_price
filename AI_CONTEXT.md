# AI_CONTEXT - Eczane App Proje Hafizasi

Bu dosya sonraki agentin hizli toparlanmasi icin guncel teknik notlari tutar.

---

## Guncel Durum - 2026-04-03

- Uygulama Electron + Express + Vanilla JS mimarisinde calisiyor.
- Arama sonucu ekraninda varsayilan secili plan teklifi en ucuz tekliften geliyor.
- Kullanici bir depo satirina tiklayarak veya satirdaki `Plana Sec` butonuna basarak plan icin secili depoyu degistirebiliyor.
- `Siparis Planina Ekle` butonu en ucuz teklifi degil, o anda secili olan depo teklifini ve secili miktari kullanir.
- Electron icindeki depo oturumlari kalici degil; `Depoya Git` davranisi Chrome uzerinden kalmalidir.
- Ana sayfadaki kisa plan karti ile detay plan ekrani arasinda bilgi parity korunur; MF/planlama satiri ikisinde de gorunmelidir.
- Plan detay sayfasi render oncesi `normalizeOrderPlanItem()` ile tekrar normalize edilir; bozuk kayit varsa sayfa tamamen bos kalmamalidir.
- Plan detay ekraninda karta tiklamak urunu acmaz; ilgili kalem icin inline edit/aksiyon katmanini acar.
- Aktif plan inline katmaninda qty +/- duzenleme, `Urunu Ac`, `Depoya Git` ve `Sil` aksiyonlari vardir.

## Quantity Bazli Fiyat Mimarisi

- MF paneli once lokal fallback hesapla teklifleri hemen gosterir.
- Ardindan `POST /api/quote-option` ile uygun depolar icin canli fiyat cekilir.
- Selcuk, Nevzat ve Alliance adapterlari quantity bazli canli fiyat quote edebilir.
- Anadolu Pharma, Anadolu Itriyat ve Sentez fallback fiyat mantiginda kalir.
- Canli fiyat basarisiz olsa bile fallback liste ekranda kalmalidir; panel bos kalmasi bug kabul edilir.

## Canli Fiyat Karar Alanlari

- Selcuk search fiyati `selcukBirim()` ile gelir ve karar alani `netTutar`dir.
- Selcuk MF / quantity fiyati `selcukMf()` ile gelir ve karar alani `netTutar`dir.
- Nevzat search fiyati `nevzatBirim()` ile gelir ve karar alani `netTutar`dir.
- Nevzat MF / quantity fiyati `nevzatMf()` ile gelir ve karar alani `netTutar`dir.
- Alliance search fiyati `allianceBirim()` ile gelir ve karar alani `GrossTotal`dir.
- Alliance MF / quantity fiyati `allianceMf()` ile gelir ve karar alani `GrossTotal`dir.
- Alliance arama sonucunda offer bilgisi eksikse `Sales/ItemDetail` icindeki `data-item` parse edilerek gercek `ItemString` ve `Offers` alinmalidir.

## Bulk Search Kurali

- Bulk search qty=1 iken normal arama gibi birim fiyat gosterir.
- Bulk search qty=1 iken mevcut MF bilgisi satirda bilgi olarak gorunur, fakat fiyat batch mantigi ile degismez.
- Bulk search qty=2+ iken normal aramadaki quantity/MF helper zincirini kullanir.
- Bulk search qty=2+ iken satirdaki ana fiyat `Odenecek`, alt fiyat ise `Efektif birim` olarak okunur.
- Bulk search detay metninde `al / gel` dili kullanilmaz; ozet `Hedef X adet · MF Y+Z` formatindadir.
- Bulk sonuc kartinin buton ve input disindaki alani tiklanabilir; tiklaninca ayni kart icinde inline plan yonetim paneli acilir.
- Inline panel secili depo, barkod, birim maliyet, toplam maliyet ve `Urunu Ac / Depoya Git / Kapat` aksiyonlarini gosterir.
- Bulk ekranda ayni anda tek kart expanded tutulur; yeni kart acilinca onceki inline panel kapanir.
- Inline panel gorunurlugu artik `state.inlineOpen` ile tutulur; acma sirasinda panel render'i zorunlu tetiklenir.
- Bu davranisin merkezi helperlari:
  - `buildUnitOptions()`
  - `getFallbackPlannerOptions()`
  - `resolvePlannerOptions()`
  - `getPlannerOptionDetailText()`
  - `getBulkOfferDetailText()`

## Kritik UI Davranislari

- `currentSelectedOfferKey` arama sonucu secimini tutan ana state'tir.
- `resolveSelectedOfferItem(items)` secim yoksa en ucuz teklifi, o da yoksa ilk kaydi dondurur.
- Teklif satiri hem `click` hem `Enter/Space` ile secilebilir.
- Ayrica satirda gorunen `Plana Sec` butonu ayni secimi acik ve okunur sekilde yapar.
- Seçili satir tabloda `is-selected` sinifi ile vurgulanir ve `Secili Siparis Deposu` pill'i gorunur.

## Kisa Risk Listesi

- Eski dosyalarda mojibake kalintilari olabilir; yeni eklenen metinleri ASCII-safe tut.
- `renderer/scripts/app.js` buyuk ve stateful; arama sonucu render zincirinde ufak bir syntax hatasi tum ekranin kaybolmasina neden olabilir.
- Alliance urun sayfasi URL tabanli degildir; Chrome tarafinda dogrudan urune gitmek yerine `QuickOrder` fallback kullanilir.
- Bazi ortamlarda bozuk sistem proxy degerleri olabilir; Selcuk/Nevzat/Alliance adapterlarindaki `proxy: false` kaldirilmamali.
- `fetchQuotedOption()` basarisiz live quote sonucunu cache'e yazmamalidir; aksi halde bulk ekrani fallback'e kilitlenir.

## Search Depot Hotfix - 2026-04-05 16:45

- Selcuk ve Nevzat'in sonuc vermemesi name alias bug'indan degil, stale cookie + redirect/timeout durumundan da kaynaklaniyordu.
- Selcuk arama request'i bozuk oturumda `timeout of 6000ms exceeded` ile dusuyordu.
- Nevzat arama request'i bozuk oturumda `Maximum number of redirects exceeded` ile dusuyordu.
- Iki adapter da artik search seviyesinde `cookie temizle -> login yenile -> ayni sorguyu bir kez tekrar dene` davranisi uygular.
- Search timeout'lari Selcuk/Nevzat icin 10000ms yapildi.
- Canli adapter testi su sonucu verdi:
  - `8683060010220` -> `Selcuk Ecza` -> `600,00`
  - `8699522705009` -> `Nevzat Ecza` -> `138,78`
- Bu nedenle Selcuk/Nevzat tekrar kaybolursa ilk bakilacak yer `src/depots/selcuk.js::_requestSearch()` ve `src/depots/nevzat.js::_requestSearch()` olmalidir.
## Guncel Ek Not - 2026-04-03 01:28

- Siparis plani artik kampanya batch miktarini degil, kullanicinin istedigi adedi saklar.
- Plan kartlarinda eski `hedef / teslim` dili kaldirildi; hem ana kartta hem detay ekraninda tek `adet` gosterilir.
- Plan kaydi `(barcode + depo)` bazinda tutulur; ayni barkod ayni depoda yeniden eklenirse kayit replace edilir.
- Plan detay ekranindaki kartlar tiklanabilirdir; butona degil kart govdesine tiklanirsa urun acilir.
- Plan detay ekraninda da `Sil` aksiyonu vardir; silme sadece ana sayfadaki ozet listeye bagli degildir.
- Arama sonucu render zincirinde `MIN_GATHER_TIME` nedeniyle bos ekran kalma riski icin gecikmeli rerender korumasi eklendi.
- Depot/config yukleme basarisiz olursa akis sessiz kirilmak yerine kontrollu hata gosterir.

---

## Stabilizasyon Faz 1 Tamamlandi - 2026-04-03

- authFetch() artik 15 saniye timeout icerir; zaman asimi 'timeout' tipiyle firlatilir.
- doSearch() icerisinde _activeSearchId token'i ile search race condition kapatildi; eski arama yanitlari yeni sonucu ezemez.
- resolveQuotedOptions() icerisinde _activeQuoteId token'i ile quote latest-only yapildi.
- main.js startup'ta sabit 1000ms setTimeout kaldirildi; waitForServer() ile Express hazir olunca pencere aciliyor.
- Renderer'a global window.error + unhandledrejection handler eklendi.

## Stabilizasyon Devam Eden Maddeler (Faz 2)

- Arama render batching (100-150ms throttle)
- Quote concurrency limiti (Selcuk/Nevzat/Alliance)
- Event binding hijyeni (duplicate listener riski)

## Stabilizasyon Faz 2 Tamamlandi - 2026-04-03

- scheduleRender() ile 120ms render batching eklendi; birden fazla depo yaniti tek DOM guncellemeye birlestirilir.
- allItems arrayi sadece concat-only; sort/dedupe sadece render aninda (flush) uygulanir.
- resolveQuotedOptions() artik Promise.all degil runConcurrent(tasks, 2) kullanir; max 2 quote istegi esanli gider.
- Barkod aramalarinda scheduleRender bypass edilir - hiz kritik.
- Tum Faz 1 korumalari (_activeSearchId, _activeQuoteId, authFetch timeout, waitForServer) aktif.

---

## Search Engine (v1.0 — 2026-04-05)

### Mimari
- `src/search-engine.js` — Provider Registry Pattern
- Her depo bir **search provider** olarak kayit olur: `searchEngine.register(id, {name, searchFn})`
- Providerlar `activate(id)` / `deactivate(id)` ile yonetilir
- `search(query, {onResult, onDone, onError})` — tum aktif providerlar **paralel** sorgulanir

### SSE Endpoint
- `GET /api/search-smart?q=...&token=...`
- `Content-Type: text/event-stream`
- Event tipleri:
  - `results` — {depotId, depot, depotUrl, results[]}
  - `error` — {depotId, depot, error}
  - `done` — {} (tum providerlar tamamlandi)

### Frontend Entegrasyonu
- `doSearch()` → `new EventSource(sseUrl)` — tek baglanti, tum depolar
- `_activeEventSource` — onceki SSE baglantilarini kapatir (race condition)
- Mevcut `scheduleRender()`, `_activeSearchId`, `MIN_GATHER_TIME` korunur

### Search Dayaniklilik Notu (2026-04-05 13:45)

- Search SSE stream'i `done` event'inden sonra dogal olarak kapanir; bu kapanis `EventSource.onerror` ile ikinci kez hata gibi islenmemelidir.
- `renderer/scripts/app.js` icinde `streamCompleted` guard'i bu false-error durumunu engeller.
- Search ekrani artik yeni arama baslarken eski sonuclari hemen gizlemez; yeni sonuc gelene veya gercek hata/empty state kesinlesene kadar mevcut gorunum korunur.
- SSE stream koptugunda elde en az bir sonuc varsa UI hata kartina dusmez; mevcut sonuc basarili durum olarak korunur.
- Bulk search SSE kullanmaz; hala tek tek `/api/search-depot` cagirir.
- Search loading katmani ilk sonuc geldiginde kapanir; kullanici sonuc gorurken tam ekran spinner ile bloklanmaz.
- Search watchdog suresi 8000ms'dir; `done` hic gelmezse ve elde sonuc varsa loading kapatilip mevcut sonuc korunur.
- Search yine bos donerse ikinci asama olarak `searchOneBulkQuery()` fallback'i calisir; bu yol `/api/search-depot` uzerinden aktif depolari tekrar yoklar.
- Teklif tablosu gorunurken kalan depo yanitlari icin `searchInlineLoading` kullanilir; bu loading `otherDepots` altinda gorunur.

### Search Rollback Notu (2026-04-05 15:40)

- Kullanici geri bildirimiyle normal search akisi tekrar eski guvenilir metoda alindi.
- `renderer/scripts/app.js` icindeki `doSearch()` artik `EventSource('/api/search-smart')` kullanmaz.
- Normal search tekrar aktif depolar icin paralel `/api/search-depot` cagrilari ile calisir.
- Search-smart server tarafinda dursa da normal UI flow icin birincil yol degildir.
- Rollback sonrasi `doSearch()` icinde `loadDepotStatus()` / `cachedConfig` / `activeDepots` bootstrap blogu eksik kalirsa arama loading'de takilabilir; bu blok kritik olarak geri eklendi.
- Son hotfix ile `doSearch()` tekrar `_legacy/doSearch-v1.js` prosedurune hizalandi; search icinde deneysel watchdog/inline-loading finalize davranislari kaldirildi.
- `src/server.js` icindeki `/api/search-depot` route'unda alias tabanli instance secimi eklendi; Selcuk/Nevzat gibi depolar name/encoding farklari nedeniyle dusmemeli.

### Autocomplete Performans Notu (2026-04-05 14:00)

- Autocomplete frontend debounce suresi 120ms'dir.
- Loading metni sadece istek 120ms ustu surerse gosterilir; bu sayede suggestion daha hizli hissedilir.
- `renderer/scripts/app.js` icinde query-bazli kucuk suggestion cache vardir.
- `/api/autocomplete` artik once Selcuk'tan suggestion almaya calisir.
- Selcuk suggestion vermezse ancak o zaman tum depolar fallback olarak taranir.

### Autocomplete Stabilite Notu (2026-04-05 14:20)

- Suggestion akisi ile normal arama akisi artik bilincli olarak ayridir.
- `src/depots/selcuk.js` icindeki `autocompleteSearch()` yalniz `GetUrunler` sonucunu dondurur; suggestion ekraninda fiyat/MF zincirine girilmez.
- Normal search halen `search()` -> `_fetchMFAndReturn()` uzerinden canli fiyat alir.
- `/api/autocomplete` bir depot `autocompleteSearch()` sagliyorsa onu tercih eder; yoksa `search()` fallback'tir.

### Depo Ekleme Prosedürü
1. `src/depots/yeni-depo.js` yaz — `search(query)` methodu olan sinif
2. `server.js` → `DEPOT_CLASSES`'a 1 satir ekle
3. Config'de credentials tanimla → otomatik olarak engine'e kayit olur

### Geri Alma
- `_legacy/doSearch-v1.js` — eski frontend kodu + prosedur
- `_legacy/server-search-v1.js` — eski server search endpoint'leri

## Guncel Not - 2026-04-05 Active Plan Drawer
- Aktif plan detay kartlari artik sag panel plan duzenleyici aciyor.
- Duzenleyici barkod uzerinden depo tekliflerini yeniden topluyor, qty degisince resolvePlannerOptions ile MF/canli fiyat guncelliyor.
- Kaydet aksiyonu plan kaydini secilen depo ve istenen adet ile yeniden yazar.

- Active plan drawer UI refresh: daha genis sag panel, ust toplam karti, daha net depo kartlari ve sticky aksiyon alani.

- Active plan cards now keep quick actions on-card while full editing still opens in right drawer.

