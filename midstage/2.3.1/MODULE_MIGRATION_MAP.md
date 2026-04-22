# Module Migration Map

Bu belge, mevcut legacy owner'lardan okunacak kodun V2.2 altinda hangi hedef modullere kopyalanacagini gosterir.

Ana prensip:

- kaynak okunur
- yeni modul `midstage/2.2` altinda yazilir
- kaynak ilk extraction turunda silinmez

## Kaynak Ownership Kurali

- `renderer/scripts/app.js` ilk extraction fazlarinda read-source kabul edilir
- `renderer/index.html` legacy launch source kabul edilir
- `renderer/src/main.js` historical compatibility reference kabul edilir
- `midstage/current-modular/**` referans/ornek alanidir
- `midstage/2.2/**` tek write-target alandir

## 1. Runtime ve Shell

Kaynak alanlar:

- `renderer/scripts/app.js:52-184`
- `renderer/scripts/app.js:2337-2468`

Kaynak fonksiyonlar:

- `pushDiagnosticEvent`
- `getDiagnosticsSnapshot`
- `clearDiagnosticsBuffer`
- `setupElectronDiagnosticsBridge`
- `showPage`
- `toggleProfileMenu`
- `closeProfileMenu`
- `homeSearch`
- `loadDepotStatus`
- `initApp`
- `getUpdateStatusPresentation`

Hedef dosyalar:

- `midstage/2.2/renderer/src/runtime/DiagnosticsRuntime.js`
- `midstage/2.2/renderer/src/runtime/NavigationRuntime.js`
- `midstage/2.2/renderer/src/runtime/ProfileMenuRuntime.js`
- `midstage/2.2/renderer/src/bootstrap/AppBootstrap.js`

Not:

- `showPage()` ve `initApp()` parity gorulmeden legacy owner'dan silinmez

## 2. Lokal Storage, Kimlik ve Ortak Veri Yardimcilari

Kaynak alanlar:

- `renderer/scripts/app.js:351-594`
- `renderer/scripts/app.js:1224-1242`

Kaynak fonksiyonlar:

- `readStoredJson`
- `writeStoredJson`
- `getOrderPlan`
- `saveOrderPlan`
- `getRoutineList`
- `saveRoutineList`
- `normalizeOrderPlanItem`
- `normalizeRoutineItem`
- `buildVariantImageMarkup`
- `getItemBarcode`
- `getBarcodeHints`
- `resolveItemBarcode`
- `getItemIdentityKey`
- `chooseCanonicalProductName`
- `comparePreferredItems`
- `dedupeSearchItems`
- `getSearchIdentity`

Hedef dosyalar:

- `midstage/2.2/renderer/src/shared/storage/LocalJsonStore.js`
- `midstage/2.2/renderer/src/shared/products/ProductIdentity.js`
- `midstage/2.2/renderer/src/state/PlanState.js`

Not:

- bu alan en guvenli ilk extraction adayidir

## 3. Search Durum ve Hata Yonetimi

Kaynak alanlar:

- `renderer/scripts/app.js:263-350`
- `renderer/scripts/app.js:595-1174`
- `renderer/scripts/app.js:2143-2336`

Kaynak fonksiyonlar:

- `resetSearchDetailState`
- `hideSearchResultSections`
- `clearSearchErrorState`
- `setSearchInlineLoading`
- `classifySearchFailure`
- `showSearchErrorState`
- `bindSearchErrorActions`
- `scheduleRender`
- `doSearch`
- `renderResults`
- `renderVariantSelectionLayer`
- `renderDetailResults`
- `setupAutocomplete`
- `escRegex`
- `onDrugSelected`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/search/SearchOrchestrator.js`
- `midstage/2.2/renderer/src/features/search/SearchErrorView.js`
- `midstage/2.2/renderer/src/features/search/SearchResultsView.js`
- `midstage/2.2/renderer/src/features/search/VariantSelectionView.js`
- `midstage/2.2/renderer/src/features/search/AutocompleteController.js`
- `midstage/2.2/renderer/src/state/SearchState.js`

Not:

- `doSearch()` yeni modulun ilk bridge entry point'i olmaya adaydir

## 4. Search Action Panel ve Teklif Secimi

Kaynak alanlar:

- `renderer/scripts/app.js:1243-1578`

Kaynak fonksiyonlar:

- `refreshOrderPlanViews`
- `addPlannerOptionToOrderPlan`
- `getOfferSelectionKey`
- `resolveSelectedOfferItem`
- `setSelectedOffer`
- `removeOrderPlanItem`
- `updateOrderPlanItemQuantity`
- `getPlannerOption`
- `getDesiredPlanQty`
- `shouldUseMfForQty`
- `syncSearchActionQtyInputs`
- `updateSearchActionQtyUi`
- `setSearchActionQty`
- `renderSearchActionPanel`
- `getActiveBestSelection`
- `updateBestPlanMenu`
- `updateBestOfferCard`
- `updateSearchActionMeta`
- `compareDepotItems`
- `comparePlannerOptions`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/search/SearchActionPanel.js`
- `midstage/2.2/renderer/src/features/pricing/OfferSelection.js`
- `midstage/2.2/renderer/src/features/order-plan/OrderPlanStore.js`

Not:

- bu alan hem arama hem plan state'ine dokundugu icin V2.2'de acik kontratla ayrilmalidir

## 5. Pricing, MF ve Quote Zinciri

Kaynak alanlar:

- `renderer/scripts/app.js:1579-1962`

Kaynak fonksiyonlar:

- `buildUnitOptions`
- `calcMfOptions`
- `getFallbackPlannerOptions`
- `getPlannerOptionDetailText`
- `getBulkOfferDetailText`
- `buildQuoteCacheKey`
- `fetchQuotedOption`
- `resolveQuotedOptions`
- `resolvePlannerOptions`
- `buildMfChips`
- `renderStockCalcOptions`
- `renderStockCalc`
- `initStockCalc`
- `toggleStockCalc`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/pricing/PricingEngine.js`
- `midstage/2.2/renderer/src/features/pricing/QuoteResolver.js`
- `midstage/2.2/renderer/src/features/stock-calc/StockCalcView.js`

Not:

- bu alan V2.2'nin en kritik parity risklerinden biridir

## 6. Depoya Git ve Yardimci UI

Kaynak alanlar:

- `renderer/scripts/app.js:2063-2143`
- `renderer/scripts/app.js:1175-1223`
- `renderer/scripts/app.js:4285-4287`

Kaynak fonksiyonlar:

- `buildChromeDepotTarget`
- `copyAndOpenDepot`
- `showToast`
- `esc`
- `exportOrderPlanCsv`
- `applyHumanUiCopy`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/depot-browser/DepotBrowser.js`
- `midstage/2.2/renderer/src/shared/ui/ToastService.js`
- `midstage/2.2/renderer/src/shared/ui/HumanCopy.js`
- `midstage/2.2/renderer/src/features/order-plan/OrderPlanExport.js`

Not:

- `Depoya Git` davranisi Chrome tabanli kalir, Electron icine alinmaz

## 7. Settings ve Update Durumu

Kaynak alanlar:

- `renderer/scripts/app.js:2469-2866`

Kaynak fonksiyonlar:

- `buildGeneralSettingsMarkup`
- `buildDepotSettingsMarkup`
- `buildDeveloperSettingsMarkup`
- `bindSettingsTabActions`
- `refreshSettingsGeneralStatus`
- `renderSettings`
- `triggerUpdateCheck`
- `testDepotLogin`
- `saveDepot`
- `deleteDepot`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/settings/SettingsView.js`
- `midstage/2.2/renderer/src/features/settings/SettingsTabs.js`
- `midstage/2.2/renderer/src/features/settings/DepotSettingsService.js`
- `midstage/2.2/renderer/src/features/settings/UpdateStatusPresenter.js`

Not:

- mevcut `current-modular` denemesindeki settings extraction burada referans olarak okunabilir ama hedef dosya yine `midstage/2.2` altinda acilmalidir

## 8. Order Plan Detail ve Drawer

Kaynak alanlar:

- `renderer/scripts/app.js:2875-3439`

Kaynak fonksiyonlar:

- `addCurrentToOrderPlan`
- `clearOrderPlan`
- `addCurrentToRoutineList`
- `removeRoutineItem`
- `openSavedProduct`
- `openOrderPlanDetail`
- `getPlanDrawerEntry`
- `getSelectedPlanDrawerOption`
- `applyPlanDrawerOptions`
- `refreshPlanEditorQuotes`
- `closePlanEditorDrawer`
- `renderPlanEditorDrawer`
- `openPlanEditorDrawer`
- `renderOrderPlanDetail`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/order-plan/OrderPlanView.js`
- `midstage/2.2/renderer/src/features/order-plan/RoutineListStore.js`
- `midstage/2.2/renderer/src/features/plan-drawer/PlanEditorDrawer.js`

Not:

- drawer ve detail render ayni dosyada kalmamali; V2.2 bunu ayiracak

## 9. Bulk Search

Kaynak alanlar:

- `renderer/scripts/app.js:3440-3866`

Kaynak fonksiyonlar:

- `closeExpandedBulkCards`
- `searchOneBulkQuery`
- `renderBulkResultCard`
- `runBulkSearch`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/bulk-search/BulkSearchOrchestrator.js`
- `midstage/2.2/renderer/src/features/bulk-search/BulkResultCardView.js`
- `midstage/2.2/renderer/src/state/BulkState.js`

Not:

- bulk search, normal search ile helper paylasabilir ama owner dosyasi ayrik kalmali

## 10. Home, Routine ve History

Kaynak alanlar:

- `renderer/scripts/app.js:3867-4279`

Kaynak fonksiyonlar:

- `renderHomeOrderPlan`
- `renderRoutineList`
- `buildHistoryInsights`
- `renderHistoryInsights`
- `renderHomeDashboard`
- `saveHistory`
- `fetchHistory`
- `formatHistoryDateParts`
- `openHistorySearch`
- `renderHomeHistory`
- `renderHistory`
- `deleteHistory`

Hedef dosyalar:

- `midstage/2.2/renderer/src/features/home/HomeDashboardView.js`
- `midstage/2.2/renderer/src/features/history/HistoryView.js`
- `midstage/2.2/renderer/src/features/history/HistoryInsights.js`
- `midstage/2.2/renderer/src/features/routine/RoutineListView.js`

## 11. Index ve Bootstrap Ownership

Kaynak alanlar:

- `renderer/index.html`
- `renderer/src/main.js`

Hedef dosyalar:

- `midstage/2.2/renderer/index.html`
- `midstage/2.2/renderer/src/bootstrap/AppBootstrap.js`

Not:

- `renderer/src/main.js` bugunku haliyle passive compatibility bootstrap'tir
- V2.2 bunu referans olarak okur ama ayni dosyayi owner olarak kullanmaz
- yeni bootstrap `midstage/2.2` altinda ayri acilir

## 12. Gecis Kurali

Her modul icin is sirasi sabittir:

1. source haritasini belgeye yaz
2. yeni hedef dosyayi `midstage/2.2` altinda olustur
3. gerekli kodu kopyala ve sinirlari netlestir
4. modul dokumani guncelle
5. bridge ekle
6. parity kontrolu yap
7. ancak sonra legacy owner'i kucult

