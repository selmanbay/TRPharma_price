# V2.3.1 Modular Runtime Guide

Bu belge `midstage/2.3.1` icin runtime seviyesinde uygulanan moduler prensipleri tanimlar.

## Mimari Hedef

- `app.js` = orchestrator (state + akis kontrolu + DOM mount)
- Domain hesap/mapping = domain modulleri
- HTML string üretimi = UI modulleri
- Moduller arasi iletisim = explicit contract (dependency injection)

## Aktif Moduller

- `renderer/scripts/utils.js`
  - Saf, stateless yardimcilar (parse, format, barcode, concurrency)
  - Global state veya DOM bagimliligi yok

- `renderer/scripts/plan-domain.js` (`window.V23PlanDomain`)
  - Plan veri gruplama ve drawer option domain hesaplari
  - UI'dan bagimsizdir
  - Cekirdek API:
    - `groupPlanItems(plan)`
    - `groupPlanItemsByDepot(plan, depotMeta)`
    - `buildPlanDrawerOptions(input)`

- `renderer/scripts/search-domain.js` (`window.V23SearchDomain`)
  - Search domain/data owner'i (grouping, normalize, progressive depot search)
  - Cekirdek API:
    - `sortDepotItems(items)`
    - `buildVariantGroups(items, query, deps)`
    - `normalizeDepotItem(input, deps)`
    - `normalizeDepotResults(data, depotId, deps)`
    - `searchDepot(input, deps)`
    - `searchAcrossDepotsProgressive(input, deps)`
    - `searchAcrossDepots(input, deps)`

- `renderer/scripts/offer-domain.js` (`window.V23OfferDomain`)
  - Offer -> planning -> plan-payload owner'i
  - Cekirdek API:
    - `calculatePlanning(item, desiredQty, deps)`
    - `getOfferDisplayName(item, fallbackName)`
    - `getOfferDepotLabel(item, deps)`
    - `buildPlanPayloadFromOffer(input, deps)`

- `renderer/scripts/app-runtime.js` (`window.V23AppRuntime`)
  - Auth/session/bootstrap owner'i
  - Cekirdek API:
    - `getToken(tokenKey)` / `getStoredUser(userKey)`
    - `setSession(tokenKey, userKey, token, user)` / `clearSession(tokenKey, userKey)`
    - `authFetch(url, options, deps)`
    - `login(password, deps)` / `setup(displayName, password, deps)`
    - `ensureAuth(runtime, deps)`
    - `loadAppMeta(runtime, deps)` / `loadConfig(runtime, deps)` / `loadHistory(runtime, deps, limit)`
    - `configuredDepotIds(runtime, deps)` / `bootstrapApp(runtime, deps)`
    - `configuredDepotIds(runtime, deps)`

- `renderer/scripts/operation-identity.js` (`window.V23OperationIdentity`)
  - Plan/search/onay identity matching owner'i
  - Cekirdek API:
    - `resolveDepotIdentity(value, deps)`
    - `matchesDepotIdentity(item, depotToken, deps)`
    - `buildPlanKeyCandidates(key, barcode, deps)`
    - `matchesPlanIdentity(item, key, depotToken, deps)`
    - `findPlanItemByIdentity(key, depotToken, deps)`
    - `isPlanEntryPresent(input, deps)`

- `renderer/scripts/navigation-runtime.js` (`window.V23NavigationRuntime`)
  - Top-nav ve page switch owner'i
  - Cekirdek API:
    - `updateNavSummary(runtime, deps)`
    - `switchPage(pageId, runtime)`
    - `bindTopNav(runtime, deps)`

- `renderer/scripts/plan-ui.js` (`window.V23PlanUI`)
  - Plan sayfasi ve drawer HTML string owner'i
  - DOM'a dokunmaz, yalnizca input -> markup dondurur
  - Cekirdek API:
    - `renderPlanPage(ctx)`
    - `renderPlanDrawer(ctx)`

- `renderer/scripts/search-ui.js` (`window.V23SearchUI`)
  - Search surface HTML owner'i (loading/draft/variant list)
  - Cekirdek API:
    - `renderSearchLoadingState(query, deps)`
    - `renderSearchDraftState(query, deps)`
    - `renderBulkDropzoneArt()`
    - `renderVariantsPage(ctx, deps)`

- `renderer/scripts/bulk-ui.js` (`window.V23BulkUI`)
  - Bulk search table + drawer HTML owner'i
  - Cekirdek API:
    - `renderBulkPage(ctx, deps)`
    - `renderBulkDrawer(ctx, deps)`

- `renderer/scripts/shell-ui.js` (`window.V23ShellUI`)
  - Login + home + settings page HTML owner'i
  - Cekirdek API:
    - `renderLoginPage(ctx, deps)`
    - `renderHomePage(ctx, deps)`
    - `renderSettingsPage(ctx, deps)`

- `renderer/scripts/detail-ui.js` (`window.V23DetailUI`)
  - Search detail page HTML owner'i
  - Cekirdek API:
    - `renderDetailPage(ctx, deps)`

- `renderer/scripts/operation-state.js` (`window.V23OperationState`)
  - Search + plan + approval state projection owner'i
  - Cekirdek API:
    - `getPlanSnapshotForIdentity(input, deps)`
    - `resolveOperationStateForItem(item, options, deps)`
    - `resolveGroupOperationState(group, deps)`
    - `renderOperationStateBadges(state, options)`
    - `synchronizeRuntimeOperationState(runtime, deps)`

- `renderer/scripts/plan-mutations.js` (`window.V23PlanMutations`)
  - Plan mutasyon pipeline owner'i
  - Cekirdek API:
    - `finalizePlanMutation(runtime, deps, options)`
    - `upsertPlanOperationItem(item, deps)`
    - `patchPlanOperationItem(key, depotId, patch, deps)`
    - `deletePlanOperationItem(key, depotId, deps)`

- `renderer/scripts/security-guards.js` (`window.V23SecurityGuards`)
  - Runtime security guard owner'i (frontend defense-in-depth)
  - Cekirdek API:
    - `isSafeHttpUrl(url)`
    - `sanitizeSearchInput(rawValue)`

- `renderer/scripts/app-actions.js` (`window.V23AppActions`)
  - Search/detail, bulk, settings, compat ve plan aksiyon runtime owner'i
  - Cekirdek API:
    - `runSearch(query, runtime, deps)`
    - `bulkSearch(runtime, deps)`
    - `changeBulkRowQty(rowIndex, delta, runtime, deps)`
    - `setBulkRowQty(rowIndex, value, runtime, deps)`
    - `addSelectedOfferToPlan(runtime, deps)`
    - `addBulkRowToPlan(index, runtime, deps)`
    - `openUrl(url, deps)`
    - `copyAndOpenDepot(url, depotId, rawQuery, runtime, deps)`
    - `openPlanInDepot(key, depotId, runtime, deps)`
    - `openDrawer()/closeDrawer(runtime)`
    - `openBulkDrawer(index, runtime, deps)/closeBulkDrawer(runtime)`
    - `openPlanDrawer(groupKey, runtime, deps)`
    - `saveDepotSettings(depotId, deps)`
    - `testDepotLogin(depotId, deps)`
    - `changePlanQty(key, depotId, delta, runtime, deps)`
    - `selectPlanAlternative(groupKey, depotId, deps)`
    - `bindTitlebar()`

- `renderer/src/domain/*` (bridge ile runtime'a bagli)
  - `DrugEntity`, `DepotEntity`, `OrderDataEngine`, `UserEntity`
  - `app.js` icindeki `bootstrapDomainBridge` ile dynamic import edilir
  - bridge yoksa fallback legacy davranis korunur

## Moduller Arasi Sozlesme (Contract)

- Orchestrator modullerle dogrudan global degisken paylasmaz.
- Her module explicit `ctx`, `runtime` veya `deps` objesi ile veri alir.
- UI ve domain modulleri state mutasyonu yapmaz.
- Runtime action modulleri yalnizca explicit verilen `runtime.state` uzerinden mutasyon yapar; dogrudan global state owner'i olmaz.

Ornek:
- `plan-ui` -> `deps.formatCurrency`, `deps.esc`, `deps.depotBadgeHtml`
- `plan-domain` -> `calculatePlanning`, `normalizePlanItem`, `normalizeAlternativeItems`

Bu sayede test edilebilirlik ve swap edilebilirlik artar.

## Script Yukleme Sirasi

`mock.html` yukleme sirasi:
1. `utils.js`
2. `security-guards.js`
3. `operation-identity.js`
4. `app-runtime.js`
5. `navigation-runtime.js`
6. `search-domain.js`
7. `offer-domain.js`
8. `app-actions.js`
9. `plan-domain.js`
10. `plan-ui.js`
11. `search-ui.js`
12. `bulk-ui.js`
13. `shell-ui.js`
14. `detail-ui.js`
15. `operation-state.js`
16. `plan-mutations.js`
17. `app.js`

Bu siralama ile orchestrator her bridge'e deterministic sekilde erisir.

## Gercek Moduler Calisma Prensibi

- Owner netligi:
  - "Bu hesap kimde?" sorusunun tek cevabi olmali.
- UI/Domain ayrimi:
  - Domain modulu HTML bilmez.
  - UI modulu business rule bilmez.
- Bridge + fallback:
  - Yeni module kademeli alinir, runtime kirilmaz.
- Extraction olgunlastikca fallback bloklari minimize edilir:
  - owner module yoksa agir legacy hesap geri acilmaz
  - orchestrator sadece hafif/default davranis veya no-op fallback kullanir
- Kontrat-first:
  - Module fonksiyonu dogrudan global'e degil, `ctx/deps` objesine bagli olmalidir.
- Orchestrator ince tutulur:
  - Entegre eder, karar verir, mount eder.
  - Hesap ve template owner'i olmaz.

## Sonraki Zorunlu Adimlar

- `app.js` icindeki kalan fallback legacy bloklarini adim adim temizlemek
- `app.js` icinde kalan search/identity fallback owner bloklarini no-op/default seviyesine indirmek
- `app-actions.js` icin search/bulk/settings contract testleri eklemek
- `app-runtime.js` icin auth/bootstrap contract testleri eklemek
- `navigation-runtime.js` icin nav interaction smoke testleri eklemek
- `offer-domain.js` icin pricing/payload fixture testleri eklemek
- `search-domain.js` icin contract-level fixture testleri eklemek
- `bulk-ui.js` icin contract-level render fixture testleri eklemek
- `detail-ui.js` icin contract-level render fixture testleri eklemek
- `plan-domain.js` ve `plan-mutations.js` icin contract test script'i eklemek
