# AI Agent Handoff

Tarih: 2026-04-03

## Guncel Not - 2026-04-19 V2.2 Baseline Duzeltmesi

- Onemli: `midstage/2.2` artik eski/root runtime kopyasi degil; kritik rebase ile `midstage/current-modular` tabanina alinmistir.
- Bu duzeltme olmadan 2.2 son feature'lari kaybediyordu: workspace/operasyonel gorunum, `runtimeCoordinator`, workspace shell ve ilgili UI mode katmanlari eksikti.
- Simdi korunmasi gereken kural su:
  1. 2.2'de runtime tabani `current-modular` parity'sinden gelir
  2. V2.2 extraction ve test katmanlari bunun ustune eklenir
  3. Bir sonraki extraction turunda root/current degil once `midstage/current-modular` referans alinmali
- V2.2'ye ozel halen aktif ekler:
  - `renderer/src/main.js` icinde `window.V22Modules`
  - `src/server.js` icinde `health` + test session/client-log endpoint'leri
  - `renderer/scripts/app.js` icinde test relay hook'u
  - `main.js` icinde ayri `userData` ve dev modda tek-instance lock bypass'i

## Su Anki Durum

- Versiyon: 2.1.1
- Git durumu: Worktree dirty, kullanicinin ve onceki turlar�n degisiklikleri var
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
12. Bulk search detay satirinda `al / gel` dili kaldirildi; qty>1 ozeti `Hedef X adet � MF Y+Z`.
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

## Guncel Ek Not - 2026-04-17 Workspace Plan Dense List

- Sadece workspace modunda siparis plani detay ekrani yogun liste gorunumune cekildi.
- Render kodu `renderer/src/features/plan/WorkspacePlanView.js` altina tasindi; `window.ModularAppAdapters.plan` uzerinden yayinlanir.
- `renderer/scripts/app.js > renderOrderPlanDetail()` workspace branch'i once adapter'i dener, yoksa eski render'a fallback yapar. Klasik mod branch'i bu commit'te degismedi.
- En ucuz birim maliyetli depo grup icinde "En ucuz" rozeti alir; digerleri icin `+delta` farki gosterilir.
- Event kontrati (`data-plan-editor-open`, `data-plan-card-minus/plus/depot/remove`) ayni kaldi; yeni modul sadece HTML + accordion toggle ekler. `bindOrderPlanEntryEvents` fonksiyonuna dokunulmadi.
- Yeni CSS prefix: `.ws-plan-*`, stil yalniz `body[data-ui-mode="workspace"]` altinda aktif.
- Regresyon noktalari: (a) adapter import zinciri bozulursa workspace plan sayfasi eski kartlara dusmeli (beyaz ekran olmamali), (b) klasik modda siparis plani gorunumu aynen kalmali, (c) qty / sil / depoya git ayni handler'lara gider.

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
3. K�k neden stale cookie / bozuk session idi; sadece `search-depot` alias hotfix'i yeterli degildi.
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


## Handoff Update - 2026-04-05 Modular Compatibility Bootstrap
- index.html now loads scripts/app.js again before src/main.js.
- src/main.js was reduced to a compatibility bootstrap. It detects legacy globals and stays passive instead of hijacking the UI.
- storage.js export syntax bug was fixed.
- Recommendation: migrate one feature at a time behind compatibility checks; do not disable legacy owner flows until parity is proven.

## Handoff Update - 2026-04-05 Backend Encoding Cleanup
- Backend runtime string cleanup started because UI no longer showed the issue but logs/routes still could.
- `src/server.js`
  - clean depot names restored in `DEPOT_CLASSES`
  - added `normalizeDepotName()`, `getDepotAliases()`, `findDepotInstance()`
  - `/api/autocomplete` and `/api/search-depot` now resolve depots through normalized aliases instead of brittle raw-name matches
- `src/depots/selcuk.js`, `src/depots/nevzat.js`, `src/depots/alliance.js`
  - login/runtime strings cleaned where they affect behavior or logs
  - `btnGiris` normalized to `Giri�`
- Remaining mojibake in comments is lower priority; next agent should only clean them if touching those areas anyway.

## Handoff Update - 2026-04-05 Midstage Workspace
- User requested a cleaner architecture where root keeps markdown memory/plans while code lives under `D:\personal\eczane-app\midstage`.
- Implemented:
  - `D:\personal\eczane-app\midstage\current` as active code snapshot
  - `D:\personal\eczane-app\midstage\releases` as future version/release container
- Copied active runtime/code into `midstage/current`:
  - `main.js`, `preload.js`, `package.json`, `package-lock.json`, `config.json`
  - `renderer/`, `src/`, `scripts/`, `data/`, `_legacy/`
- Root `.md` files remain the canonical project memory.
- Future coding tasks should prefer `midstage/current` as the working directory unless the user explicitly wants root.

## Handoff Update - 2026-04-06 Root Cleanup
- Root folder was cleaned for restart of structured development.
- Moved old packaged release folders into `D:\personal\eczane-app\midstage\releases\legacy`.
- Moved historical debug logs into `D:\personal\eczane-app\_archive\debug-logs`.
- Moved `tmp/video_debug_frames` into `D:\personal\eczane-app\_archive\artifacts\video_debug_frames`.
- Moved experimental `front` tree into `D:\personal\eczane-app\_archive\experiments\front`.
- Current recommended dev target remains `D:\personal\eczane-app\midstage\current`.

## Handoff Update - 2026-04-06 Dual UI Mode Start
- User wants two UI tracks:
  - current low-risk classic UI
  - new faster B2B/workspace-oriented UI
- First implementation is in `D:\personal\eczane-app\midstage\current`.
- Added profile menu mode switch:
  - `#profileUiClassicBtn`
  - `#profileUiWorkspaceBtn`
- Added app.js state:
  - `UI_MODE_KEY`
  - `activeUiMode`
  - `getStoredUiMode()`
  - `applyUiMode()`
  - `updateUiModeButtons()`
- Added CSS driven mode layer via `body[data-ui-mode="workspace"]`.
- Current workspace mode only changes layout density/containers/sticky plan behavior; feature flows stay the same.
- Next safe migration path is to enhance workspace mode screen-by-screen without touching classic behavior.
## Handoff Ek Not - 2026-04-06 Scroll Optimizasyonu
- Workspace mode icin compact density gecisi yapildi.
- Sikistirilan alanlar: hero, depot cards, mini order plan, search bar, product card, best card, action panel, depot offers table, order plan detail cards.
- Kritik davranis degisikligi yok; akisyonlar ve drawer akisi korunarak sadece dikey yayilim azaltildi.
## Handoff Ek Not - 2026-04-06 Workspace Faz 2
- Aktif plan detay ekraninda workspace moduna ozel kompakt kart renderi eklendi.
- Klasik mod aynen korundu.
- Scroll azaltma calismasi artik hem CSS hem JS template seviyesinde ilerliyor.
## Handoff Ek Not - 2026-04-06 Workspace Faz 3
- Workspace search page artik split-view calisiyor.
- Sag kolon: best offer + quick actions.
- Alt teklif tablosu: sticky header ve ic scroll.
- Dar pencerelerde otomatik tek kolona geri donus var.
## Handoff Ek Not - 2026-04-06 Workspace Faz 4
- Scroll azaltma calismasi search loading ve variant state'e de uygulandi.
- Right column overlap riskini azaltmak icin search action panel sticky yerine static yapildi.
- Plan detail compact kartlarda mini box yerine inline meta kullaniliyor.

## Guncel Ek Not - 2026-04-06 Workspace Compactness

- Son kullanici geri bildirimi: arama ekraninda loading, varyant secimi, geri butonu ve plan kartlari hala fazla yer kapliyordu.
- Yapilan duzeltme: workspace modunda search grid ve plan detail gorunumu daha agresif sikistirildi.
- Dikkat: bu degisikliklerin kullanici tarafinda gorunmesi icin aktif Electron instance yeniden baslatilmali.
## Guncel Ek Not - 2026-04-06 Midstage Relaunch

- Kullanici uygulama calismiyor dedi; runtime logda Electron single-instance lock hatasi goruldu.
- Hotfix: midstage/current/main.js lock yoksa quit etmek yerine devam ediyor.
## Guncel Ek Not - 2026-04-06 Midstage UserData

- Runtime hata: process_singleton_win / platform_channel access denied.
- Kalici cozum: midstage Electron process icin ayri userData, ortak config icin ECZANE_CONFIG_PATH.
## Guncel Ek Not - 2026-04-06 Midstage Singleton

- Single-instance lock dev midstage instance'ini olduruyordu.
- Hotfix: 
equestSingleInstanceLock tamamen bypass edildi.
## Guncel Ek Not - 2026-04-06 Backend Spawn

- Midstage backend ayaga kalkiyor ama exec(start http://localhost:PORT) nedeniyle dusuyordu.
- Fix uygulandi: sadece explicit env ile browser aciliyor.
## Guncel Ek Not - 2026-04-06 Midstage Rollback

- Midstage instance kullanilamaz hale gelmisti.
- Acil aksiyon: root working tree tamamen midstage/current altina yeniden kopyalandi.
## Guncel Ek Not - 2026-04-16 Workspace Safe Return

- Workspace UI modu yeniden devreye alindi.
- Bu turda sadece dusuk riskli yerlesim ve yogunluk degisiklikleri var; is akislarina dokunulmadi.
## Guncel Ek Not - 2026-04-16 Clean Relaunch

- Kullanici workspace modu calismiyor dedi.
- Muhtemel nedenlerden biri coklu Electron/Node instance karisikligi; temiz relaunch yapiliyor.
## Guncel Ek Not - 2026-04-16 Workspace Safe Search Rollback

- Search ve plan ekranlari workspace modunda kiriliyordu.
- Hotfix: workspace icin safe override eklendi; calisan klasik yerlesim korunuyor.

## Guncel Ek Not - 2026-04-16 Workspace Operasyon Masasi
- Workspace modu tekrar kurgulandi.
- Search ekraninda yeni DOM kabugu: `workspaceSearchShell`, `workspacePlanRail`, `workspaceResultSummary`, `workspaceVariantSection`, `workspaceOffersSection`.
- `renderResults` ve `renderVariantSelectionLayer` workspace modunda klasik kartlari gizleyip yeni kompakt kabuga veri basar.
- `renderOrderPlanDetail` workspace modunda ayri kompakt satir listesi cizer.
- Sonraki olasi adimlar: home ekranini daha operasyonel dashboarda cekmek, bulk ekrani bu faz disinda tutmak.

## Handoff Update - 2026-04-16 Current-Modular Refactor

- Kullanici istegiyle `midstage/current` baz alinip yeni klon olusturuldu:
  - `D:\personal\eczane-app\midstage\current-modular`
- Bu klonda:
  - Mojibake temizligi runtime + docs kapsaminda yapildi
  - `scripts/check-mojibake.js` ve `scripts/fix-mojibake.js` eklendi
  - `package.json` scriptleri: `mojibake:check`, `mojibake:fix`
- Legacy uyumluluk korunarak app.js parcali modullere baglandi:
  - shared helpers -> `renderer/src/shared/LegacySharedHelpers.js`
  - pricing/planner -> `renderer/src/features/pricing/LegacyPricingEngine.js`
  - search helpers -> `renderer/src/features/search/LegacySearchUtils.js`
  - workspace shell -> `renderer/src/features/workspace/WorkspaceShell.js`
  - settings tabs -> `renderer/src/features/settings/SettingsTabs.js`
- Adapter bridge:
  - `renderer/src/main.js` icinde `window.ModularAppAdapters.*`
  - `renderer/scripts/app.js` icindeki secili fonksiyonlar adapter'a delege edildi.
- Modul dokumani:
  - `midstage/current-modular/docs/modules/MODULE_INDEX.md`
  - `search.md`, `pricing.md`, `order-plan.md`, `workspace.md`, `settings.md`, `shared.md`

## Electron Calistirma (Current-Modular)

- Baslangic:
  1. `cd D:\personal\eczane-app\midstage\current-modular`
  2. `npm start`
- Dogrulama:
  - `npm run release:check`
  - `npm run mojibake:check`

## Handoff Update - 2026-04-16 MF Hesaplayici Tutarlilik

- Kullanici ekran geri bildirimi uzerine Search MF Hesaplayici planner zinciriyle hizalandi.
- `renderer/scripts/app.js` degisiklikleri:
  - `renderStockCalc()` fallback icin `getFallbackPlannerOptions(items, qty)` kullaniyor.
  - live guncelleme icin `resolvePlannerOptions(items, qty)` kullaniyor.
  - satir detay metni `getPlannerOptionDetailText(option, qty)` uzerinden tek kaynaktan uretiliyor.
- Electron current-modular instance restart edilip logdan ayaga kalktigi dogrulandi.

## Handoff Update - 2026-04-16 History Tab Fix

- Kullanici `Arama Gecmisi` ekraninda `history || [].forEach is not a function` hatasi raporladi.
- `midstage/current-modular/renderer/scripts/app.js` icinde `fetchHistory()` normalize edildi:
  - dizi cevabi: `[]`
  - obje cevabi: `{ history: [] }`
  - obje cevabi: `{ items: [] }`
- Boylesiyle history render/insight akislari her zaman dizi alir.

- 2026-04-16: Workspace Modu search secili teklif durumu stabilize edildi. getOfferSelectionKey artik fiyat kullanmiyor; live quote refresh sonrasi secim korunuyor.

- 2026-04-16: midstage/current server.js browser auto-open kodu kaldirildi. Backend artik restartta EPERM ile dusmeden ayakta kaliyor.

- 2026-04-16: current-modular main.js guncellendi. Ayri userData: eczane-app-current-modular. Dev modda stale singleton lock current-modular acilisini tamamen bloklamiyor.

- 2026-04-16: current-modular dev launch fix ikinci asama. requestSingleInstanceLock dev modda kapatildi; packaged build davrani�i korunuyor.

- 2026-04-16: current-modular backend fiyat/plan arizalari icin runtime files current bazdan geri senkronlandi. Kritik kopyalar: src/server.js, src/depots/{selcuk,nevzat,alliance}.js, renderer/scripts/app.js.

- 2026-04-17: current-modular icinde kismi degil toplu runtime rollback uygulandi. Senkronlanan ana alanlar: main.js, preload.js, renderer/index.html, renderer/scripts, renderer/styles, src/.

- 2026-04-17: current-modular workspace search fix. addPlannerOptionToOrderPlan -> refreshOrderPlanViews artik workspace searchte sol raili ve teklif tablosu secili badge'lerini guncelliyor. MF hesaplayici icin workspace-mf-calc / input / chips stilleri eklendi.

- 2026-04-17: CODEX_STABILIZATION_PLAN.md guncellendi. Yeni plan, kullanici raporladigi uzun sure acik kalinca refresh gerektiren cookie/session timeout probleminden baslayarak resilience-first bir yol haritasi cizer.

## Guncel Ek Not - 2026-04-17 19:55
- `current-modular` workspace search ekraninda MF paneli varsayilan kapali calisir.
- `MF Hesapla` butonu paneli acar/kapatir; panel header close ve `Esc` de desteklenir.
- Yeni arama veya farkli teklif/form secimi stale acik MF panelini tasimaz; `workspaceMfContextKey` ile korunur.
- Klasik search `stockCalcPanel` degistirilmedi; degisiklik sadece workspace yuzeyindedir.

## Handoff Note - 2026-04-17
If search feels inconsistent after this point, inspect these files first:
- midstage/current-modular/renderer/scripts/auth.js
- midstage/current-modular/renderer/scripts/runtime-coordinator.js
- midstage/current-modular/renderer/scripts/app.js
- midstage/current-modular/src/server.js
- midstage/current-modular/src/depots/{selcuk,nevzat,alliance}.js
Key runtime behavior added:
- previous searches are now aborted, not just ignored
- live quote panels use scoped aborts
- initApp() starts a depot keep-alive interval calling /api/depots/keep-alive
- depot adapters track lastLoginAt and refresh stale cookie sessions

[2026-04-17 10:13:13] Implemented grouped order-plan rendering in current-modular. Do not flatten same-barcode cross-depot entries into separate top-level cards on the plan detail screen; use grouped parent card + depot child options.

## Handoff Update - 2026-04-18 Account-Based App Direction

- Kullanici ile netlestirilen yeni yon: uygulama adim adim account-based yapıya evrilecek.
- Su anki depo auth mantigi hala config/cookie/token merkezli ama artik bunun kalici veri modeli tarafina tasinmasi bekleniyor.
- `D:\personal\eczane-app\depo_https` klasoru bu gecis icin referans dokuman deposu olarak olusturuldu.
- README'ler insan okunur hale getirildi; ham login/curl/response bloklari korunuyor.
- Buradaki amac sonraki gelistiricinin "hangi depo nasil login oluyor, fiyat nereden geliyor, MF hangi field'da" sorularini tek yerden gorebilmesi.

## Handoff Update - 2026-04-18 Mimari Sonraki Adimlar

- Kullanici database/entity/server tasariminin buyuk is oldugunu ve nasil ilerleyeceginin henuz net olmadigini belirtti.
- Sonraki calismalar tek seferde buyuk rewrite olmamali; migration asamali gitmeli.
- Onerilen ilk tasarim ayrimi:
  - `Account`
  - `User`
  - `DepotConnection`
  - `DepotSession`
  - `OrderPlan`
  - `SearchHistory`
  - `PurchaseHistory`
- Kritik nokta: `DepotConnection` ile `DepotSession` ayni modelde eritilmemeli.
- Connection kalici ayar/credential alanidir; session ise yenilenebilir cookie/token artifact katmanidir.

## Handoff Update - 2026-04-18 Fiyat Dokumani Durumu

- Depo bazli fiyat ve MF field'lari not edildi.
- Canli fiyat hesaplayan depolar:
  - Selcuk
  - Nevzat
  - Alliance
- Liste fiyatina dayanan depolar:
  - Anadolu Pharma
  - Anadolu Itriyat
  - Sentez
- Perakende fiyat konusu henuz tam normalize edilmedi.
- Dikkat ceken alanlar:
  - Selcuk / Nevzat -> `etiketFiyati`
  - Sentez -> `Perakende`
  - Anadolu Pharma -> `PSFFiyat` potansiyel aday
- Bu nedenle ileride fiyat modelinde tek `price` alanina kapanmak yerine fiyat turu tasarimi gerekebilir.

## Handoff Update - 2026-04-19 V2.2 Modular Refactor Plan

- Kullanici V2.2 icin "tam modulerlik" istedi ama bunu ani cut/paste degil, planli migration olarak tanimladi.
- Yeni canonical plan workspace'i:
  - `D:\personal\eczane-app\midstage\2.2`
- Yeni kural:
  - legacy dosyadan oku
  - yeni modulu `midstage/2.2` altinda ac
  - ilk extraction turunda kaynaktan silme
  - parity gorulmeden ownership degistirme
- `renderer/scripts/app.js` halen buyuk cunku bugune kadarki modular denemeler adapter-first kaldi; V2.2 owner transferini ayri bir faz olarak ele alacak.
- Oku:
  - `midstage/2.2/README.md`
  - `midstage/2.2/V2_2_MODULAR_REFACTOR_PLAN.md`
  - `midstage/2.2/MODULE_MIGRATION_MAP.md`
- Pratik talimat:
  - `renderer/scripts/app.js`, `renderer/index.html`, `renderer/src/main.js` ilk extraction fazlarinda source-of-truth kabul edilmeli
  - yeni JS dosyalari ayni path'e degil `midstage/2.2` altina yazilmali
  - eski owner kodu bridge ve parity tamamlanmadan silinmemeli
- App.js icin temel migration gruplari:
  - runtime/shell
  - shared storage + identity
  - search
  - pricing + stock calc
  - order plan + drawer
  - bulk
  - history/routine/home
  - settings

## Handoff Update - 2026-04-19 V2.2 Working Runtime Baseline

- `D:\personal\eczane-app\midstage\2.2` artik calisan runtime baseline'ina sahip.
- Root'tan 2.2 altina kopyalanan ana alanlar:
  - `main.js`
  - `preload.js`
  - `src/`
  - `renderer/`
- Yeni `package.json` eklendi.
- Start script:
  - `node ../../node_modules/electron/cli.js .`
- Bu model 2.2'nin root dependency havuzunu kullanmasini saglar; ayri `npm install` zorunlulugu olusturmaz.
- Runtime ayrimi:
  - `main.js` icinde `userData` -> `eczane-app-v2_2`
  - dev modda single-instance lock kapali
- Standalone server bugfix:
  - `midstage/2.2/src/server.js` browser auto-open artik yalniz `ECZANE_OPEN_BROWSER=1` ise calisir
  - bu sayede `node src/server.js` smoke testinde gorulen `spawn EPERM` kapandi
- Ilk gercek extraction:
  - `renderer/src/shared/storage/LocalJsonStore.js`
  - `renderer/src/shared/products/ProductIdentity.js`
  - `renderer/src/state/PlanState.js`
- `renderer/src/main.js` artik `window.V22Modules` altinda su modulleri publish eder:
  - `storage`
  - `productIdentity`
  - `planState`
- `renderer/scripts/app.js` icinde kontrollu delegasyon aktif:
  - storage helper'lari
  - order plan / routine persistence helper'lari
  - product identity / dedupe / search identity helper'lari
- Dogrulama:
  - `npm --prefix midstage/2.2 run check` gecti
  - `node src/server.js` smoke check -> `http://localhost:3000` `200`

## Handoff Update - 2026-04-19 V2.2 Test Interface Direction

- Kullanici ek olarak terminalden backend test atabilecegi ve frontend tarafinin test izi/log uretmesini otomasyona uygun hale getirecek bir arayuz plani istedi.
- Canonical plan:
  - `D:\personal\eczane-app\midstage\2.2\TEST_INTERFACE_PLAN.md`
- Mevcut kullanilabilir temeller:
  - `scripts/test-api-search-depot.js` -> auth'li backend smoke ornegi
  - `midstage/2.2/renderer/scripts/app.js` -> `pushDiagnosticEvent`, `getDiagnosticsSnapshot`, `clearDiagnosticsBuffer`
  - settings developer paneli -> mevcut diagnostic gorunurlugu
- Onerilen mimari:
  - runtime control script'i
  - backend test CLI
  - frontend -> backend client-log relay
  - session bazli scenario runner
- Sonraki en mantikli implementasyon sirasi:
  1. `GET /api/health`
  2. `scripts/test-backend-cli.js`
  3. `POST/GET/DELETE /api/test/client-log`
  4. ilk `search-basic` smoke senaryosu

## Handoff Update - 2026-04-19 V2.2 Test Interface Faz 1 Uygulandi

- Planin ilk uygulama dilimi kodlandi.
- Yeni endpoint'ler:
  - `GET /api/health`
  - `POST /api/test/session/start`
  - `GET /api/test/session/current`
  - `POST /api/test/client-log`
  - `GET /api/test/client-log`
  - `DELETE /api/test/client-log`
- Yeni scriptler:
  - `midstage/2.2/scripts/test-auth.js`
  - `midstage/2.2/scripts/test-backend-cli.js`
  - `midstage/2.2/scripts/test-scenario-runner.js`
- `midstage/2.2/package.json` komutlari:
  - `test:health`
  - `test:backend`
  - `test:scenario`
- Frontend tarafi:
  - `renderer/scripts/app.js` icinde `initializeTestRelaySession()` ve `relayDiagnosticEvent()` eklendi
  - auth sonrasi aktif test session varsa `pushDiagnosticEvent()` olaylari backend'e akitilir
- Dogrulanan zincir:
  - izole portta server start
  - `health`
  - `session-start`
  - `client-log-add`
  - `client-logs`
- Henuz acik is:
  - gercek Electron renderer acikken relay olaylarini otomatik smoke ile dogrulamak
