# AI_CONTEXT - Eczane App Proje Hafizasi

Bu dosya sonraki agentin hizli toparlanmasi icin guncel teknik notlari tutar.

---

## Guncel Durum - 2026-04-03

- Uygulama Electron + Express + Vanilla JS mimarisinde calisiyor.
- Arama sonucu ekraninda varsayilan secili plan teklifi en ucuz tekliften geliyor.
- Kullanici bir depo satirina tiklayarak veya satirdaki `Plana Sec` butonuna basarak plan icin secili depoyu degistirebiliyor.
- `Siparis Planina Ekle` butonu en ucuz teklifi degil, o anda secili olan depo teklifini ve secili miktari kullanir.
- Electron icindeki depo oturumlari kalici degil; `Depoya Git` davranisi Chrome uzerinden kalmalidir.

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
