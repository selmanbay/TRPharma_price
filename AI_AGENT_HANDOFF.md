# AI Agent Handoff

Tarih: 2026-04-03

## Su Anki Durum

- Versiyon: 2.1.1
- Git durumu: Worktree dirty, kullanicinin ve onceki turların degisiklikleri var
- Electron: Kod degisikliklerinden sonra restart edilmeli
- Oncelik: Arama sonucu teklifi ve MF fiyatlari stabil gostermek

## Bu Turda Yapilan Teknik Isler

1. Varsayilan plan secimi en ucuz teklif olacak sekilde korunuyor.
2. Teklif listesine ayri `Plana Sec` butonu eklendi.
3. Satir tiklama ve buton tiklama ayni secimi yapacak sekilde birlestirildi.
4. Gorunen `TL`/metin bozukluklari temizlenmeye baslandi.
5. MF panelinde fallback liste hemen ciziliyor, sonra varsa canli fiyat ile rerender yapiliyor.
6. Selcuk, Nevzat ve Alliance canli quote altyapisi backend tarafinda hazir.
7. Selcuk fiyat akisi `selcukBirim()` / `selcukMf()` olarak ayrildi; karar alani `netTutar`.
8. Nevzat fiyat akisi `nevzatBirim()` / `nevzatMf()` olarak ayrildi; karar alani `netTutar`.
9. Alliance fiyat akisi `allianceBirim()` / `allianceMf()` olarak ayrildi; karar alani `GrossTotal`.
10. Alliance eksik `Offers` durumunda `Sales/ItemDetail` parse edilerek gercek `ItemString` ile fiyatlandirma yapiliyor.
11. Bulk search qty=1 icin birim fiyat, qty=2+ icin normal arama planner mantigi aktif.
12. Bulk search detay satirinda `al / gel` dili kaldirildi; qty>1 ozeti `Hedef X adet · MF Y+Z`.
13. Bulk live quote basarisiz olursa fallback yine gorunur, fakat fallback artik cache'e kalici yazilmaz.

## Sonraki Agent Icin Kritik Notlar

- `renderer/scripts/app.js` icinde `renderDetailResults()` ve `renderStockCalc()` ana risk alanlari.
- Arama sonucu ekrani bos gorunurse ilk bakilacak yer syntax hatasi veya bozuk template string olmalidir.
- `POST /api/quote-option` sadece canli quote katmanidir; ekran bu endpoint'e bagimli olmamali.
- `Depoya Git` Chrome tabanli kalmali, Electron icine tasinmamali.
- `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY` bozuk olabilir; Selcuk/Nevzat/Alliance icin `proxy: false` kritik.
- Ana sayfadaki plan karti da MF/planlama satirini gostermelidir; detay sayfada var olup home kartta yoksa parity bug'i sayilir.
- `Plani Incele` bos ekran verirse ilk bak: `renderOrderPlanDetail()` artik defensive try/catch ile sarili ve `order-plan-error` diagnostics eventi atar.
- Plan detay ekraninda kart govdesine tiklamak artik inline edit panelini acar; urun acma davranisi sadece `Urunu Ac` butonundadir.
- Inline edit paneli qty +/- ile kayitli kalemin adetini gunceller; hesap simdilik mevcut `effectiveUnit` uzerinden yeniden yazilir.
- Bulk search tarafinda qty=1 iken MF fallback acilmasi bug kabul edilir.
- Bulk search qty=1 iken MF bilgisi gorunur ama fiyat birim fiyat olarak kalir.
- Bulk search qty>1 iken ana fiyat `Odenecek`, alt satir `Efektif birim` olarak okunur.
- Selcuk/Nevzat/Alliance live quote gorunmuyorsa ilk bakilacak yer `fetchQuotedOption()` cache davranisidir.

## Beklenen Dogru Davranis

- Arama sonucu gelir gelmez depo teklifleri tablosu gorunmeli.
- En ucuz teklif default secili olmali.
- Kullanici baska bir satiri veya `Plana Sec` butonunu tiklarsa secim degismeli.
- `Siparis Planina Ekle` secili depoyu ve secili miktari kullanmali.
- MF paneli hicbir durumda bos kalmamali; en az fallback tekliflerini gostermeli.
- Bulk search qty=1 iken satirlar kampanyali batch degil birim fiyat gostermeli.
- Bulk search qty=1 iken satir detayi mevcut MF bilgisini de gostermeli.
- Bulk search qty=2+ iken satirlar normal aramadaki quantity/MF canli fiyat mantigina gecmeli.
## Guncel Ek Not - 01:28

1. Arama sonucu bazen bos beyaz ekran verme bug'i icin gecikmeli rerender korumasi eklendi.
2. Config/depo durumu yukleme hatasi sessiz kirilma yerine kontrollu akisla ele alindi.
3. Eksik kalan `addPlannerOptionToOrderPlan` ve `removeOrderPlanItem` fonksiyonlari geri eklendi.
4. `Siparis Planina Ekle` butonlari tekrar merkezi plan kayit akisina baglandi.
5. Siparis plani miktar mantigi sadeletirildi; plan artik kullanicinin istedigi adedi saklar ve gosterir.
6. Plan detay ekranindaki kartlar tiklanabilir hale getirildi; detay ekrana da `Sil` butonu eklendi.
7. Login/setup ve bazi gorunen Turkce metinler runtime tarafinda duzeltildi.

## Fiyat Sorgulama ve MF Hesaplama Kurallari (HER EKRAN ICIN GECERLI)

### Fiyat sorgulama
- Her depo kendi live quote metodunu kullanir. Bazi depolar (orn. Selcuk) `/api/quote-option` endpoint'i uzerinden gercek zamanli fiyat doner; digerleri statik fiyatla kalir.
- Hangi ekran olursa olsun (tekli arama, toplu arama, MF hesaplayici) fiyat gosterimi su akisi izlemelidir:
  1. `calcMfOptions(items, qty)` -> fallback (statik) fiyatlarla aninda render
  2. `resolveQuotedOptions(items, qty)` -> tum depolar icin live quote dene, degisiklik varsa re-render
- ASLA tek bir item ile `calcMfOptions([item], qty)` cagrisi yapmak yeterli degildir -- bu live quote'u atlar.
- `fetchQuotedOption(item, option, qty)` -- tek bir depo icin live quote + MF birlesimi, cache'li.

### MF hesaplama
- `calcMfOptions(items, qty)` her depo icin `orderQty / receiveQty / effectiveUnit / totalCost` alanlarini dogru hesaplar.
- Satirda gosterilecek fiyat her zaman `effectiveUnit` (etkin birim fiyat), toplam her zaman `totalCost`'tur.
- Ham `item.fiyatNum * qty` gibi manuel carpim YAPILMAMALIDIR -- MF kirilimini yansitmaz.
- MF detayi gosterilirken: `opt.orderQty` (siparis) ve `opt.receiveQty` (gelen) ayri belirtilmeli.

## Search / SSE Debug Notu - 2026-04-05

1. Search ekrani artik `/api/search-smart` SSE endpoint'ini kullanir; bulk search bundan ayridir.
2. Bug'in kok nedeni: stream tamamlanip `done` geldikten sonra EventSource kapanirken `onerror` tetikleniyor ve UI yanlislikla `Sunucuya baglanilamadi` kartina dusuyordu.
3. Cozum:
   - `streamCompleted` guard'i eklendi
   - partial-result guard'i eklendi
   - yeni arama baslangicinda eski sonuclari kosulsuz gizleme kaldirildi
4. Search tekrar sahte hata kartina duserse ilk bakilacak yerler:
   - `doSearch()` icindeki `evtSource.onerror`
   - `msg.type === 'done'` blogu
   - `showSearchErrorState()` cagrilari
5. Search loading spinner'i ilk sonuc geldiginde kapanir; yeniden uzun sure ortada kaliyorsa `msg.type === 'results'` blogundaki loading temizleme davranisi kontrol edilmelidir.
6. `done` hic gelmeyen durumlar icin 8000ms watchdog vardir; timeout sonrasi sonuc varsa success korunur, sonuc yoksa retry hata karti acilir.
7. Search bos donerse ikinci kademe fallback `attemptLegacySearchFallback()` ile `searchOneBulkQuery()` cagrilir.
8. `src/search-engine.js` artik provider `result.error` degerlerini `onError` olarak propagete eder; sessiz auth/session hatalari bu sayede kaybolmaz.

## Search Rollback Notu - 2026-04-05 15:40

1. Kullanici talebiyle normal arama tekrar eski `/api/search-depot` paralel modeline alindi.
2. `doSearch()` icinde EventSource/SSE yolu artik aktif degildir.
3. Kampanya, MF ve depo kapsami sorunlari yasandiginda ilk bakilacak yer tekrar `doSearch()` ve `/api/search-depot` cevabidir.
4. `otherDepots` altindaki `searchInlineLoading` yalniz parcali sonuc durumunda gorunmelidir.
5. Rollback sonrasi bir hotfix olarak `doSearch()` icine `loadDepotStatus()` + `activeDepots` bootstrap blogu geri eklendi; bu blok olmadan search loading'de takilabiliyor.
6. Son durumda `doSearch()` yeniden `_legacy/doSearch-v1.js` ile hizalandi; search davranisi degistirilecekse once o dosyayla diff alinmali.
7. `src/server.js` icindeki `/api/search-depot` route'unda `aliasesByDepot` hotfix'i vardir; Selcuk/Nevzat gibi depolarin instance secimi burada tamir edildi.

## Autocomplete Notu - 2026-04-05

1. Suggestion gecikmesi icin ilk bakilacak yer `setupAutocomplete()` icindeki debounce ve loading davranisidir.
2. Yeni ayar:
   - debounce: 120ms
   - loading skeleton: 120ms gecikmeli
   - query cache: aktif
3. Backend `/api/autocomplete` once Selcuk fast-path dener; sonuc yoksa tum depolara fallback yapar.
4. Autocomplete tekrar yavaslarsa ilk bak:
   - `src/server.js` `/api/autocomplete`
   - `renderer/scripts/app.js` `setupAutocomplete()`
5. Selcuk suggestion icin agir `search()` degil `autocompleteSearch()` kullanilir; bu yol fiyat/MF hesaplamasi yapmaz.
6. `calpol` benzeri isim aramalarinda suggestion bos donerse ilk bakilacak yer `src/depots/selcuk.js` icindeki `_searchProducts()` ve `src/server.js` icindeki `runAutocompleteSearch()` yardimcisidir.

## Bulk Inline Panel Notu - 2026-04-05

1. Bulk sonuc kartlarinda buton/input disindaki alan tiklaninca inline plan yonetim paneli acilir.
2. Offer row click hem secimi gunceller hem de paneli acar; bu cift davranis korunmali.
3. `button`, `input` ve panel ic aksiyonlari kart geneli click handler'ina bubble etmemelidir.
4. Tek acik kart davranisi `closeExpandedBulkCards(exceptCard)` ile saglanir.
5. Inline panel ayrik state kullanmaz; `state.options`, `state.selectedKey` ve `state.qty` uzerinden render olur.
6. Son hotfix ile panel gorunurlugu `state.inlineOpen` uzerinden tutulur; `openInlinePanel()` icinde `renderInlinePanel()` zorunlu cagrilir.

## Search Depot Hotfix - 2026-04-05 16:45

1. Kullanici raporuna gore Selcuk ve Nevzat search sonuclari yeniden kayboldu.
2. Canli adapter testi dogrudan depot siniflari uzerinden yapildi:
   - Selcuk eski durumda `timeout of 6000ms exceeded`
   - Nevzat eski durumda `Maximum number of redirects exceeded`
3. Kök neden stale cookie / bozuk session idi; sadece `search-depot` alias hotfix'i yeterli degildi.
4. Cozum:
   - `src/depots/selcuk.js` `_requestSearch()` catch-level relogin retry
   - `src/depots/nevzat.js` merkezi `_requestSearch()` helper + relogin retry
   - timeout 10000ms
5. Dogrulama sonucu:
   - `8683060010220` -> Selcuk -> 1 sonuc -> `600,00`
   - `8699522705009` -> Nevzat -> 1 sonuc -> `138,78`
6. Kullanici hala bu iki depoyu gormuyorsa bir sonraki adim UI degil, route/log bazli tekrar `/api/search-depot` gozlemi olmalidir.

## Handoff Update - 2026-04-05 Active Plan Drawer
- Active order plan edit UX moved from inline section to right-side drawer.
- Drawer state lives in planEditorDrawerState in renderer/scripts/app.js.
- Clicking a plan card now opens openPlanEditorDrawer(key,depot).
- Drawer re-fetches depot offers via searchOneBulkQuery(barcode), then reuses getFallbackPlannerOptions/resolvePlannerOptions for MF and live quote behavior.
- Save path uses addPlannerOptionToOrderPlan(selectedOption, qty) and removes old entry if depot changed.

- Active plan right drawer visual hierarchy refreshed. Look for CSS classes plan-editor-* in renderer/styles/main.css.

- Active plan detail cards expose on-card quick actions (minus/plus, depot open, delete) in addition to the right drawer editor.

