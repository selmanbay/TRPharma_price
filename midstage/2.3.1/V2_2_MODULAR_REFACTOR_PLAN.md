# V2.2 Modular Refactor Plan

Tarih: 2026-04-19
Durum: Faz 1 duzeltildi, extraction devam ediyor
Hedef workspace: `D:\personal\eczane-app\midstage\2.2`

## 1. Amac

Bu planin amaci `renderer/scripts/app.js` ve ilgili legacy renderer yapisini kontrollu sekilde tam moduler mimariye tasimaktir.

Buradaki "tam modulerlik" tanimi sunlardir:

- feature owner tek dev dosya olmayacak
- feature sinirlari acik olacak
- `index.html` yalniz bootstrap gorevi gorecek
- state, view, service ve runtime sorumluluklari ayrisacak
- dokumantasyon hangi kodun nereden okunup nereye yazildigini gosterecek

## 2. Bugunku Durumun Duz Ozeti

Bugun gercek durum su:

- V2.2 runtime tabani `midstage/current-modular` ile yeniden hizalandi
- `renderer/scripts/app.js` hala ana owner
- `renderer/index.html` operasyonel/workspace gorunumu tasiyan legacy-first script yukleme mantigi tasiyor
- `renderer/src/main.js` hem `window.ModularAppAdapters` hem `window.V22Modules` yayinliyor
- `current-modular` bazi adapter extraction'lari denedi ama ownership aktarimi tamamlanmadi

Bu nedenle `app.js` kuculmedi ve `index.html` de temiz bir bootstrap katmanina inemedi.

## 3. V2.2'nin Ana Karari

V2.2, `current-modular` gibi "legacy icinde adapter bagla" odakli degil, `copy-first migration workspace` odaklidir.

Ana kural:

1. Kaynak dosya okunur
2. Gerekli kod parcasi analiz edilir
3. Yeni modul `midstage/2.2` altinda olusturulur
4. Kaynak kod ilk adimda silinmez
5. Parity kanitlanmadan ownership kaynaktan alinmaz

## 4. Copy-First Migration Kurali

Bu kural V2.2'nin zorunlu calisma protokoludur.

### 4.1 Okuma kaynaklari

V2.2 extraction icin referans kabul edilen alanlar:

- `renderer/scripts/app.js`
- `renderer/index.html`
- `renderer/src/main.js`
- `renderer/styles/main.css`
- ilgili backend/service dosyalari
- `midstage/current-modular` altindaki onceki modular denemeler

### 4.2 Yazma hedefi

V2.2 icin yeni yazilacak modul, plan ve ara dokumanlar yalnizca su alana yazilir:

- `midstage/2.2/**`

### 4.3 Ilk extraction turunda yasak olanlar

- kaynaktan cut/paste yapip ayni anda silmek
- kaynak dosyada buyuk tasima operasyonu yapmak
- davranis degisikligi ile extraction'i ayni adimda karistirmak
- parity kanitlanmadan `app.js` ownerligini kaldirmak

### 4.4 Sonraki bridge turunda izin verilen sey

Yeni modul olustuktan sonra, gerekirse legacy owner dosyada sadece kucuk ve izlenebilir bridge degisiklikleri yapilabilir:

- yeni modul import / load
- fallback branch
- feature flag
- delegasyon cagrisi

Ama bu bridge turunda bile kaynak davranis hemen silinmez.

## 5. Hedef Klasor Yapisi

```text
midstage/2.2/
  README.md
  V2_2_MODULAR_REFACTOR_PLAN.md
  MODULE_MIGRATION_MAP.md
  renderer/
    index.html
    src/
      bootstrap/
        AppBootstrap.js
      runtime/
        DiagnosticsRuntime.js
        NavigationRuntime.js
        RuntimeCoordinator.js
        ProfileMenuRuntime.js
      state/
        AppState.js
        SearchState.js
        PlanState.js
        BulkState.js
      services/
        ApiClient.js
        DepotGateway.js
        QuoteGateway.js
        PlanGateway.js
        HistoryGateway.js
      shared/
        storage/
          LocalJsonStore.js
        products/
          ProductIdentity.js
        ui/
          ToastService.js
          HumanCopy.js
      features/
        home/
        search/
        pricing/
        stock-calc/
        order-plan/
        plan-drawer/
        bulk-search/
        settings/
        history/
        routine/
        workspace/
        depot-browser/
      ui/
        views/
        components/
    styles/
      base.css
      layout.css
      features/
```

Bu yapinin amaci `feature`, `runtime`, `state`, `service` ve `shared` sinirlarini netlestirmektir.

## 6. Ownership Modeli

### 6.1 Legacy owner

Su an icin:

- `renderer/scripts/app.js`
- `renderer/index.html`
- `renderer/src/main.js`

hala behavior owner kabul edilir.

### 6.2 V2.2 owner

V2.2 adimlarinda yeni owner adaylari `midstage/2.2` altinda olusur.

Bu dosyalar ilk basta "owner" degil, "candidate owner" kabul edilir.

Ownership degisimi ancak su sartlarla olur:

- yeni modul var
- kaynak-hedef haritasi dokumante edildi
- smoke check gecti
- bridge adimi eklendi
- parity goruldu

## 7. Fazlar

## Faz 0 - Dokuman ve Sinir Cizimi

Amac:

- V2.2 workspace acilsin
- copy-first kural yazili hale gelsin
- `app.js` parcalama haritasi netlessin

Bu fazin ciktisi:

- `midstage/2.2/README.md`
- `midstage/2.2/V2_2_MODULAR_REFACTOR_PLAN.md`
- `midstage/2.2/MODULE_MIGRATION_MAP.md`
- root hafiza dosyalarinda V2.2 notlari

## Faz 1 - Foundation ve Bootstrap Katmani

Amac:

- temiz bir modular giris noktasi hazirlamak
- runtime/service/state kabugunu once bos ama net kurmak

Hedefler:

- `renderer/index.html` icin yeni modular taslak
- `bootstrap/AppBootstrap.js`
- `runtime/RuntimeCoordinator.js`
- `state` klasoru
- temel `services/ApiClient.js`

Kurallar:

- heniz search/pricing davranisi tasinmayacak
- sadece yeni owner iskeleti olusacak

## Faz 2 - Shared Yardimcilar ve Lokal Storage

Amac:

- tekrar kullanilan saf helperlari once ayirmak
- state saklama kontratini tek yere toplamak

Ilk adaylar:

- `readStoredJson`
- `writeStoredJson`
- `getOrderPlan`
- `saveOrderPlan`
- `getRoutineList`
- `saveRoutineList`
- urun kimlik ve barkod helper'lari
- dedupe / canonical name helper'lari

Hedef moduller:

- `shared/storage/LocalJsonStore.js`
- `shared/products/ProductIdentity.js`
- `state/PlanState.js`

## Faz 3 - Search Orchestration ve Search UI

Amac:

- arama state'ini ve search render zincirini `app.js` disina almak

Tasinacak alanlar:

- arama baslatma
- search error state
- variant selection
- detail result render
- autocomplete

Hedef moduller:

- `features/search/SearchOrchestrator.js`
- `features/search/SearchErrorView.js`
- `features/search/SearchResultsView.js`
- `features/search/AutocompleteController.js`
- `state/SearchState.js`

Kural:

- `doSearch()` legacy owner olarak kalabilir ama ilk bridge asamasinda yeni orchestrator'u cagirir
- eski logic parity gorulmeden silinmez

## Faz 4 - Pricing, MF ve Stock Calc

Amac:

- fiyat hesaplama ve planner mantigini UI renderindan ayirmak

Tasinacak alanlar:

- offer selection
- planner option hesaplari
- quoted option cache
- live quote resolve
- MF chip/model mantigi
- stock calc render ve event zinciri

Hedef moduller:

- `features/pricing/PricingEngine.js`
- `features/pricing/QuoteResolver.js`
- `features/pricing/OfferSelection.js`
- `features/stock-calc/StockCalcView.js`

## Faz 5 - Order Plan ve Drawer

Amac:

- plan mutasyonlari ile plan UI'nin birbirinden ayrilmasi

Tasinacak alanlar:

- plan ekleme
- plan silme
- plan qty guncelleme
- plan drawer state
- order plan detail render

Hedef moduller:

- `features/order-plan/OrderPlanStore.js`
- `features/order-plan/OrderPlanView.js`
- `features/plan-drawer/PlanEditorDrawer.js`
- `state/PlanState.js`

## Faz 6 - Bulk, History, Routine, Settings, Home

Amac:

- daha net feature ownership elde etmek

Tasinacak alanlar:

- bulk search
- history render ve fetch
- routine list
- settings markup ve actions
- home dashboard

Hedef moduller:

- `features/bulk-search/*`
- `features/history/*`
- `features/routine/*`
- `features/settings/*`
- `features/home/*`

## Faz 7 - Index ve Main Ownership Transfer

Amac:

- `index.html` ile `main` ownership'ini legacy'den modular tarafa cevirmek

Hedef durum:

- `renderer/index.html` yalniz bootstrap yukler
- modular app primary owner olur
- legacy runtime shim/fallback katmanina duser

Bu faza gecmek icin once:

- search
- pricing
- order-plan
- settings
- history

alanlarinda parity gorulmus olmali

## Faz 8 - Legacy Slimming ve Son Temizlik

Amac:

- `app.js` icindeki owner logic'i adim adim daraltmak
- bridge/shim katmani disinda ana davranisi tutmamak

Bu faz en son yapilacak.

Kural:

- ilk extraction adimi ile son cleanup adimi ayni turda yapilmaz

## 8. `app.js` Neden Hala Buyuk

Bu soru V2.2 planinin merkezindedir.

`app.js` halen buyuk cunku:

- gecmis modular denemeler parity kaybi urettigi icin legacy owner korundu
- extraction'lar adapter seviyesinde kaldi
- `index.html` hala legacy-first yukleme yapiyor
- `renderer/src/main.js` override etmeyen pasif bootstrap olarak birakildi

V2.2 bunu su sekilde cozer:

- owner degisimi ile extraction'i ayirir
- once `midstage/2.2` altinda yeni modulleri olusturur
- sonra bridge kurar
- en son legacy owneri kucultur

## 9. Dokumantasyon Kurali

Her extraction adimi sunlari guncellemelidir:

- `midstage/2.2/MODULE_MIGRATION_MAP.md`
- ilgili modul README veya modul aciklamasi
- `AI_CONTEXT.md`
- `AI_AGENT_HANDOFF.md`
- `AI_CHANGELOG.md`

Ama her adimda tum repo dokumani dagitilmaz; yalniz sorumluluk degisen yerler guncellenir.

## 10. Faz Bazli Dogrulama

Her fazda en az su kontrol yapilir:

- syntax check
- ilgili ekran smoke testi
- parity kontrolu
- fallback davranisi
- source->target haritasi guncel mi kontrolu

## 11. V2.2 Tamamlanma Kriteri

V2.2 bitti denebilmesi icin:

1. `renderer/scripts/app.js` ana feature owner olmayacak
2. `renderer/index.html` sade bootstrap dosyasi olacak
3. `renderer/src/main.js` passive compatibility dosyasi olmaktan cikacak veya bootstrap altina tasinacak
4. arama, fiyat, plan, bulk, history, settings ve workspace ayri modullerde calisacak
5. kaynak->hedef->bridge zinciri dokumante olacak
6. parity kaniti olmadan hicbir legacy owner silinmis olmayacak
