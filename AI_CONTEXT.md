# AI_CONTEXT - Eczane App Proje Hafizasi

Bu dosya sonraki agentin hizli toparlanmasi icin guncel teknik notlari tutar.

---

## Guncel Not - 2026-04-19 Security Hardening + Local Account Store

- 2026-04-21 (V2.3 isim aramasi — varyant seciminde V2.2 barkod fan-out):
  - V2.2 `renderVariantSelectionLayer`: kartta `g.barcode` varsa arama kutusuna barkod yazip `doSearch()` (tum depolar barkod sorgusu).
  - V2.3 `openVariantDetail` sadece `group.items` (ilk metin aramasinin depo alt kumesi) ile detaya gidiyordu.
  - Cozum: `app-actions.js` `openVariantDetail` async — `group.barcode` veya `BARCODE_` key’den kanonik barkod, `normalizeProductBarcode` + `isBarcodeQuery` ise `searchAcrossDepots(rawBc)` + `dedupeOffersByKey`; `searchQuery` / `currentDetailQuery` barkoda cekilir, `currentVariantKey` = `BARCODE_{rawBc}`, `searchGroups` barkod sonuclariyla yeniden kurulur; secili depo mumkunse onceki `bestItem` depo eslesmesiyle korunur. Barkod yoksa eski NAME-only davranis.

- 2026-04-21 (V2.3 detay — coklu depo plan / many-to-many + adet):
  - Sorun: `isPlanEntryPresent` ve `getPlanSnapshotForIdentity` barkod eslesmesinde **depo kontrolu atlaniyordu** → tek depoda plandaki urun tum depolarda «Plana eklendi», adet guncellemesi yanlis satira gidebiliyordu.
  - Cozum: `operation-identity.js` + `operation-state.js` + `app-v23` fallback: barkod + plan satiri **secili depo** ile eslesmeli; `bridge.isPlanEntryPresent` deps `depotMeta`.
  - Detay UI: `getPlanBarcodeAggregate` ile rozet (`Planda (N depo)` / tek satir adet), capraz depo ipucu, tabloda satir bazli «Planda» rozeti; sidebar «Bu depoda planda».
  - Adet: mevcut `setDesiredQty` + `applyPlanQtyFromDetailSelection` secili depo satirini yamalar; baska depo «Plana ekle» `upsertPlanOperationItem` ile ayri satir.

- 2026-04-21 (V2.3 UX mikro-iyilestirme + kirik kapama):
  - `detail-ui.js`: karar tablosunda MF hucresi artik `mfStr || malFazlasi || MalFazlasi` okur (bazi depolarda bos MF etiketi kirigi kapandi).
  - `app-actions.js` + `app-v23.js`: yeni `addOfferToPlan(key)` eklendi; detay tablosundan secmeden dogrudan satir bazli plana ekleme.
  - Karar tablosu aksiyonlari: `Bu Depoyu Sec` yanina `Plana Ekle` (ve satir zaten plandaysa `Bu depoda planda`) butonu eklendi; many-to-many depo planlama akisi hizlandi.

- 2026-04-21 (V2.3 detay ekrani — plan/onay aksiyonlari + plan kart slider):
  - Detay sol aksiyonlar: secili teklif plan satiri varsa `Plandan sil`, `Onaya gonder` / `Onayi kaldir` butonlari eklendi (`removeSelectedOfferFromPlan`, `approveSelectedOfferFromDetail`, `removeSelectedOfferApproval`).
  - Onay gorunurlugu: detay rozetine ek olarak bu aksiyonlar plan satiri baglaminda acik hale getirildi.
  - Sol "Siparis plani ozeti" alanı kart tabanli yatay slider'a cevrildi (`detail-plan-summary-track`), saga/sola kaydirma ve `Buyut/Kucult` toggle eklendi (`scrollDetailPlanSummary`, `toggleDetailPlanSummarySize`).
  - `state.detailPlanSummaryExpanded` ile genis kart modu korunur; CSS `main.css` icinde `v23-plan-summary-*` siniflari eklendi.

- 2026-04-21 (V2.3 ilk sorgu — isim vs barkod, V2.2 `doSearch` ile parity):
  - V2.2: `parseQRCode` ciktisi yalnizca **13 hane** ise `query` barkoda cekilir; sonra `isBarcodeQuery(query)`.
  - V2.3 bug: `cleanQuery = parseQRCode(...) || normalizedInput` metin sorguda parse ciktisini zorlayabiliyordu.
  - Cozum: `app-actions.js` `runSearch` — 13 hane + `isBarcodeQuery(ps)` ise barkod; degilse hamda 13+ rakam varsa `normalizeProductBarcode` + `isBarcodeQuery`; `bridge.runSearch` deps: `normalizeProductBarcode` (`app-v23.js`). Harita: `midstage/2.3/docs/SEARCH_NAME_VS_BARCODE_V22_V23.md`.

- 2026-04-21 (V2.3 detay — plan adedi ile hero/MF adet senkronu + seçili teklif kartı):
  - Sorun: Rozette "Planda • 7 adet" iken `state.desiredQty` varsayılan 1 kaldi; hero "Hedef" ve MF hesaplayici plan ile uyusmuyordu.
  - Cozum: `computeDetailPlanKeys` + `renderDetailPage` basinda planda satir varsa `state.desiredQty` plan satirindaki `desiredQty` ile esitlenir. Plandayken `setDesiredQty` / `changeDesiredQty` (window, app-v23) `patchPlanOperationItem` + `finalizePlanMutation` ile plan satirini gunceller; baska sayfada eski bridge davranisi korunur.
  - `detail-ui` + `detail-hero.css`: "Seçili teklif" blogu `v23-offer-lux-card` gradient cerceve + ic yuzey ile premium kutu.

- 2026-04-21 (V2.3 MF hesaplayici chip UI — V2.2 ile hizalama):
  - Sorun: `detail-ui` MF chip ana etiketi `3+1` (mf pattern) idi; `mf.total` katlari (4,8,12...) hep ayni pattern ile gosterildigi icin kullanicida "tekrarli 3+1" algisi. V2.2 `buildMfChips`: ana sayi = hedef adet, alt = `X al -> Y`.
  - Cozum: chip yapisinda `mf-chip-val` = `s.qty`, `mf-chip-label` = `buy al → qty`, kampanya ozeti `title` ile.
  - `desiredQtyInput`: her `renderDetailPage` sonunda `addEventListener('change')` birikmesi → `onchange` tek atama (guncelleme/stale listener riski).
  - `hasMfOptions` / `selectedMf`: sadece `mfStr` degil `malFazlasi` / `MalFazlasi` ile `parseMf` / `mapMfModel` tutarliligi.

- 2026-04-21 (V2.3 MF calculatePlanning — V2.2 ile parity):
  - Sorun: `offer-domain.js` `calculatePlanning` sadece `deps.parseMf` kullaniyordu; `app-v23` bridge `parseMf` gondermeyip `orderEngine` + `mapMfModel` gonderiyordu → MF hic uygulanmiyor, siparis/teslim/birim hep duz birim fiyat gibi kaliyordu.
  - Cozum: `resolveParseMf(deps)` — sirayla `parseMf`, sonra `orderEngine.parseMf`, sonra `mapMfModel` ile OrderDataEngine sekline donusturme.

- 2026-04-21 (V2.3 barkod PK tutarliligi — plan / onay / bulk / snapshot):
  - `normalizePlanItem` + `normalizeApprovalItem`: barkod `normalizeProductBarcode` + `extractBarcode(kodu)`; plan/onay `key` GTIN ise barkod PK.
  - `getOrderPlan` dedupe map anahtarinda depo `resolveDepotIdentity` ile normalize.
  - `plan-domain.js` + `app-v23` fallback `groupPlanItems`: grup anahtari `planLineGroupKey` / `planItemGroupKey` (normalize barkod varsa o, yoksa `item.key`).
  - `samePlanLineKey` + onay `approvalItems` / `getApprovalItemsForCurrentView` filtreleri: `BARCODE_` prefix ve GTIN normalize ile `scope.key` uyumu.
  - `upsertApprovalFromPlanItem`: ayni urun satirini `samePlanLineKey` + depo ile ayiklar.
  - `operation-state` `getPlanSnapshotForIdentity`: `buildPlanKeyCandidates` ucuncu arguman olarak `isBarcodeQuery` (app-v23 deps eklendi); `resolveOperationStateForItem` snapshot `key` sirasinda barkod once.
  - `search-domain` `normalizeDepotItem`: plan snapshot icin `planSnapKey` barkod varsa `BARCODE_{normalize}`.
  - Bulk satir + bulk drawer: `planKey` / `drawerPlanKey` barkod icin `BARCODE_` + normalize `resolvedBarcode`.

- 2026-04-21 (V2.3 plan onay listesi secim — window + depot anahtar):
  - `toggleApprovalSelection` / `setApprovalSelectionAll` globalde yoktu; onclick hic calismiyordu — `window.*` olarak `app-v23.js` sonuna eklendi.
  - `getApprovalSelectionKey` ve `toggleApprovalSelection` artik `resolveDepotIdentity` ile ayni `key::depot` sozlesmesini kullanir; plan-ui satirda `depotId || depot` gecilir.
  - `setApprovalSelectionAll(true)` sadece `getApprovalItemsForCurrentView()` (planApprovalScope filtreli) kalemleri secer.
  - `Seçilenlerle Devam Et` `selectedApprovalCount === 0` iken `disabled`; onay tik ikonu secili satirda belirgin (`approval-check` CSS mock + main).
  - `openPlanApproval` / `closePlanApproval` secim dizisini sifirlar (bayat secim birikmesin).
  - **Ikinci tur (inline onclick kirilmasi):** `plan-ui` onay satirlari/toolbar `onclick` + `escJs` ile `&`, `"`, satir sonu vb. iceren `key`/`depo` degerlerinde HTML/JS attribute parse hatasina dusup secimi sessizce kiriyordu. Cozum: `data-plan-approval-*` + `encodeURIComponent`; `#page-plan` uzerinde `attachPlanApprovalDelegatedHandlers` (click + keydown Enter/Space) — `app-v23.js` `renderPlanPageV2` sonunda baglanir.

- 2026-04-21 (V2.2 vs V2.3 onay / plan — mimari fark + plan patch bug):
  - **V2.2** (`midstage/2.2/renderer/scripts/app.js`): Siparis plani yalnizca `normalizeOrderPlanItem` + `key`/`depot` string eslesmesi; `approvalStatus`, `eczane.approval.queue.v1`, "Onaya Gonder" / onay listesi UI **yok**.
  - **V2.3**: `DrugOperationEntity`, onay kuyrugu, `queuePlanItemForApproval`, rozetler (`operation-state` "Onayda" = plan satirinda `approvalStatus === 'approved'` — gonderim anlaminda kullaniliyor).
  - **Bug:** `plan-mutations.js` `patchPlanOperationItem` / `deletePlanOperationItem` V2.2 tarzi `item.key === key && (depotId||depot) === targetDepot` kullaniyordu; depo etiketi vs kanonik `depotId` veya `BARCODE_` / GTIN key farki yuzunden yama **hic uygulanmiyordu** → plan dosyasi guncellenmiyor, kuyruk/rozet/ secim davranisi tutarsiz hissediliyordu.
  - **Cozum:** `isSamePlanRecord` injeksiyonu — `app-v23.js` `isSamePlanRecordForMutation`: `samePlanLineKey` + `resolveDepotIdentity` ile satir bulma.

- 2026-04-21 (V2.3 plan "planda mi" — barkod PK + detay MF yerlesimi):
  - `utils.js`: `normalizeProductBarcode()` eklendi (rakam temizle, 13+ hanede son 13 GTIN).
  - `operation-identity.js` `isPlanEntryPresent`: kanonik barkod eslesmesi varsa **depo filtresi olmadan** true (aynı urun baska depoda plandaysa detayda "plana ekli" gorunur). `matchesPlanIdentity` artik `buildPlanKeyCandidates` icin yanlis olan `item.barkod` yerine arama baglami `deps.barcode` kullanir.
  - `operation-state.js` `getPlanSnapshotForIdentity`: ayni kanonik barkod kurali; `resolveOperationStateForItem` `options.resolvedBarcode` ile detay/bulk satirinda `barkod` bos olsa bile plan sorgusu yapilir.
  - `app-v23.js`: detayda `resolvedBarcode = getItemBarcode(...)`, plan anahtari `BARCODE_${resolvedBarcode}`; bulk satir ve drawer icin de `getItemBarcode` ile barkod gecilir; `normalizePlanItem` barkodu `kodu` uzerinden `extractBarcode` ile tamamlar; `normalizeDepotItem` deps ile `getItemBarcode` kullanir (`search-domain.js`).
  - `detail-ui.js`: MF rozeti barkodun altina tasindi (`v23-detail-hero__mf-under`).

- 2026-04-21 (V2.3 detay hero UI — en uygun etiketi + stok + barkod/gorsel):
  - `detail-ui.js` + `styles/detail-hero.css`: Arama detay hero'da stok KPI kutusu kaldirildi (stok bilgisi sol "Seçili teklif" sheet'te duruyor).
  - "En uygun maliyet" ust etiketi yalnizca secili satirin `calculatePlanning(..., desiredQty).effectiveUnit` degeri tum depo satirlari icinde minimum oldugunda gosterilir; baska depo secilince etiket kaybolur, fiyat ayni blokta kalir.
  - Urun fotosu 120px kutuya buyutuldu; barkod metni chip yerine fotograf altina (`v23-detail-hero__identity-visual` / `v23-detail-hero__barcode`) tasindi.

- 2026-04-21 (V2.3 arama barkod fan-out + plan eslesmesi barkod):
  - Sorun: Depo A'nin tam urun adiyla metin aramasi yapildiginda backend sadece o depodan satir donduruyor; kullanici ayni barkodu tasiyan diger depolarin fiyatlarini da gormek istiyor.
  - Cozum: `app-actions.js` `runSearch` icinde ilk progressive arama bittikten sonra, sorgu zaten barkod degilse ve birlesik sonuclarda **tek** gecerli barkod tespit edilirse ikinci tur `searchAcrossDepots(barkod)` ile tum depolar sorgulanir; sonuclar `dedupeOffersByKey` ile birlestirilir.
  - Plan snapshot / "plana ekli": `operation-identity.js` `isPlanEntryPresent` ve `operation-state.js` `getPlanSnapshotForIdentity` artik sadece `key` adaylari degil, **ayni barkod** (`barcode` / `barkod`) uzerinden de eslesir (depo filtreleri ayni).
  - `app-v23.js` `bridge.runSearch` deps: `searchAcrossDepots` ve `getItemBarcode` baglandi (aksi halde fan-out calismazdi).
  - Bilincli sinir: Birden fazla farkli barkod donerse otomatik fan-out yapilmaz (belirsiz urun); ileride varyant secimi veya kullanici secimi gerekebilir.

- 2026-04-20 (V2.3 clean entity foundation - search/plan/approval lock):
  - `midstage/2.3/renderer/src/domain/BaseEntity.js` eklendi. Ortak normalize davranislari taban sinifa alindi.
  - `DrugEntity` ve `UserEntity` artik `BaseEntity` inheritance kullanir hale getirildi.
  - Yeni entity: `midstage/2.3/renderer/src/domain/DrugOperationEntity.js`
    - Tek ilac operasyon modelinde Search + Plan + Approval alanlarini birlestirir.
    - Canonical alanlar: `name`, `barcode`, `desiredQty`, `unitPrice/effectiveUnit`, `mfString`, `imageUrl`, `approvalStatus`, `depotId`.
    - Export edilen standart cikislar: `toSearchItem()`, `toPlanItem()`, `toApprovalItem()`.
  - `renderer/scripts/app-v23.js` domain bridge genisletildi:
    - `DrugOperationEntity` dinamik import'a eklendi
    - `createDrugOperationEntity()` fallback-safe adapter eklendi
  - Runtime entegrasyon:
    - `normalizePlanItem` artik once `DrugOperationEntity` ile canonical plan item uretir.
    - `normalizeApprovalItem` artik once `DrugOperationEntity` ile canonical approval item uretir.
    - `buildPlanPayloadFromOffer` plan payload'ini entity uzerinden standardize eder.
    - `normalizeDepotItem` arama sonucunu plan snapshot ile birlestirir (`inPlan`, `planQty`, `approvalStatus`) ve entity tabanli search item map'i dener.
  - Sonuc: arama/plan/onay akislarinda ilac operasyon veri kontrati tek modele yaklasti; ileride ilac bazli akilli kurallar ve user-scoped veri katmani icin zemini temizler.
- 2026-04-20 (V2.3 app binding step-1 - operation state surface):
  - `app-v23.js` icine ortak operasyon durumu helperlari eklendi:
    - `resolveOperationStateForItem`
    - `resolveGroupOperationState`
    - `renderOperationStateBadges`
  - Bu helperlar plan snapshot + mevcut item state'i birlestirerek `inPlan` ve `approvalStatus` durumunu tek noktadan okur.
  - Ilk baglanan UI yuzeyleri:
    - arama varyant kartlari (`renderVariantsPage`)
    - ilac detay hero (`renderDetailPage`)
    - toplu arama tablo satiri (`renderBulkPage`)
    - toplu arama drawer teklif karti (`renderBulkDrawer`)
  - Sonuc: kullanici ayni ilaci tekrar aradiginda/incelediginde "Planda / Onayda" durumunu ekranlar arasi tutarli gorur; entity tabanli operasyon modeli UI'ya baglanmaya baslandi.
- 2026-04-20 (V2.3 app binding step-2 - runtime state synchronization lock):
  - Plan/onay mutasyonlarinin search ve bulk cache'lerinde stale state birakmasini engellemek icin `app-v23.js` icine runtime sync katmani eklendi.
  - Yeni helperlar:
    - `synchronizeSearchItemOperationState`
    - `synchronizeRuntimeOperationState`
  - `getPlanSnapshotForIdentity` ve `resolveOperationStateForItem` plan listesi parametresi alacak sekilde genisletildi (tekrarli storage okuma maliyeti azaltildi).
  - Kritik baglama noktasi:
    - `saveOrderPlan` artik her yazimdan sonra runtime state'i senkronlar.
    - `saveApprovalQueue` artik her yazimdan sonra runtime state'i senkronlar.
  - Sonuc: `Plana Ekle`, `Onaya Gonder`, `Onayi Kaldir`, `Alternatif Depo Sec`, `Qty degistir`, `Sil` gibi mutasyonlardan sonra
    search-variants / search-detail / bulk-row / bulk-drawer katmanlari tek operasyon state kontratinda kalir.
- 2026-04-20 (V2.3 app binding step-3 - unified plan mutation pipeline):
  - Plan/onay mutasyonlari artik tek finalize akisiyla kapanir:
    - `finalizePlanMutation`
    - `renderCurrentOperationSurface`
  - Plan mutasyon owner helperlari eklendi:
    - `upsertPlanOperationItem`
    - `patchPlanOperationItem`
    - `deletePlanOperationItem`
  - Eski API uyumlulugu korunarak `addPlanItem/updatePlanItem/removePlanItem` bu owner helperlara delegasyon yapar.
  - Aksiyonlar yeni pipeline'a baglandi:
    - `addSelectedOfferToPlan`
    - `addBulkRowToPlan`
    - `addBulkOfferToPlan`
    - `changePlanQty`
    - `removePlanItemAndRender`
    - `queuePlanItemForApproval`
    - `removePlanApproval`
    - `removeApprovalItem`
    - `selectPlanAlternative`
    - `completeApprovalSelection`
  - Sonuc: plan + onay + search/bulk yansimalari tek mutasyon cikis noktasina baglandi; tekrar eden manuel `updateNavSummary + render*` daginikligi azaldi ve davranislar standartlasti.
- 2026-04-20 (V2.3 modular extraction step-4 - app-v23 split + security guards):
  - `app-v23.js` icindeki buyuk bloklar ayri owner script'lere tasinmaya baslandi:
    - yeni modul: `renderer/scripts/operation-state.js` (`window.V23OperationState`)
    - yeni modul: `renderer/scripts/plan-mutations.js` (`window.V23PlanMutations`)
    - yeni modul: `renderer/scripts/security-guards.js` (`window.V23SecurityGuards`)
  - `app-v23.js` artik bu alanlarda owner degil, bridge delegator:
    - operation state snapshot/badge/runtime-sync
    - plan mutasyon pipeline (finalize/upsert/patch/delete)
  - `mock.html` script sirasi guncellendi:
    - `utils` -> `security-guards` -> `plan-domain` -> `plan-ui` -> `operation-state` -> `plan-mutations` -> `app-v23`
  - V2.2 hardening notlariyla uyumlu frontend guard eklendi:
    - `openUrl()` sadece `http/https` URL acabilir (`isSafeHttpUrl`)
    - `runSearch()` input'u kontrol karakterlerinden temizler ve uzunluk sinirlar (`sanitizeSearchInput`)
  - Security alignment dokumani eklendi:
    - `midstage/2.3/SECURITY_ALIGNMENT.md`
  - Sonuc: `app-v23.js` parcalanma sureci kalici hale geldi; moduler owner + bridge + security guard modeli sabitlendi.
- 2026-04-20 (V2.3 modular extraction step-5 - search UI owner):
  - Yeni modul eklendi: `renderer/scripts/search-ui.js` (`window.V23SearchUI`)
    - `renderSearchLoadingState`
    - `renderSearchDraftState`
    - `renderBulkDropzoneArt`
    - `renderVariantsPage`
  - `app-v23.js` icindeki asagidaki render ownerlari bridge delegasyona cekildi:
    - `renderSearchLoadingState`
    - `renderSearchDraftState`
    - `renderBulkDropzoneArt`
    - `renderVariantsPage`
  - `mock.html` script sirasi `search-ui.js` icerecek sekilde guncellendi.
  - Sonuc: search yuzeyinin HTML owner'i app orchestrator'dan ayrildi; `app-v23.js` daha ince orchestrator rolune yaklasti.
- 2026-04-20 (V2.3 modular extraction step-6 - bulk UI owner):
  - Yeni modul eklendi: `renderer/scripts/bulk-ui.js` (`window.V23BulkUI`)
    - `renderBulkPage(ctx, deps)`
    - `renderBulkDrawer(ctx, deps)`
  - `app-v23.js` icindeki bulk page ve bulk drawer markup owner'i bridge delegasyona cekildi.
  - Orchestrator artik bulk ekraninda yalnizca:
    - operasyon state/proxy hesaplama (`rowPlanAdded`, `rowOperationState`, `drawerPlanAdded`)
    - state hazirlama
    - module render cagrisi
    islerini yapiyor.
  - `mock.html` script sirasi `bulk-ui.js` eklenecek sekilde guncellendi.
  - Sonuc: bulk UI da search/plan ile ayni owner prensibine girdi; `app-v23.js` icindeki HTML yukunu ciddi oranda azalttik ve contract-first modul yapisini genislettik.
- 2026-04-20 (V2.3 modular extraction step-7 - shell UI owner):
  - Yeni modul eklendi: `renderer/scripts/shell-ui.js` (`window.V23ShellUI`)
    - `renderLoginPage(ctx, deps)`
    - `renderHomePage(ctx, deps)`
    - `renderSettingsPage(ctx, deps)`
  - `app-v23.js` icinde:
    - `renderLoginPage`
    - `renderHomePage`
    - `renderSettingsPage`
    owner markup bloklari bridge delegasyona cekildi.
  - Login submit akisi (`setup/login/bootstrap`) orchestrator'da birakildi; sadece HTML owner modullesecek sekilde ayrildi.
  - `mock.html` script sirasi `shell-ui.js` eklenecek sekilde guncellendi.
  - Sonuc: dashboard/login/settings katmaninda da owner ayrimi tamamlandi; `app-v23.js` giderek "state + orchestration" rolune yaklasti.
- 2026-04-20 (V2.3 modular extraction step-8 - detail UI owner):
  - Yeni modul eklendi: `renderer/scripts/detail-ui.js` (`window.V23DetailUI`)
    - `renderDetailPage(ctx, deps)`
  - `app-v23.js` icindeki `renderDetailPage` HTML owner'i bridge delegasyona cekildi.
  - Orchestrator bu akista yalnizca:
    - detail state/projection hesaplama
    - plan snapshot + operation state hazirlama
    - event wiring (`backButton`, `desiredQtyInput change`)
    islerini tutar hale getirildi.
  - `mock.html` script sirasi `detail-ui.js` eklenecek sekilde guncellendi.
  - Sonuc: search detail yüzeyi de owner modüle ayrildi; `app-v23.js` icindeki en buyuk render bloklardan biri daha cikartilarak clean orchestrator hedefine yaklasildi.
- 2026-04-20 (V2.3 modular extraction step-9 - search domain owner):
  - Yeni modul eklendi: `renderer/scripts/search-domain.js` (`window.V23SearchDomain`)
  - `app-v23.js` icindeki search-domain owner fonksiyonlari bridge delegasyona cekildi:
    - `sortDepotItems`
    - `getItemBarcode` / `getBarcodeHints` / `resolveItemBarcode`
    - `getItemIdentityKey`
    - `chooseCanonicalProductName`
    - `buildVariantGroups`
    - `normalizeDepotItem`
    - `normalizeDepotResults`
    - `searchDepot`
    - `searchAcrossDepotsProgressive`
    - `searchAcrossDepots`
  - Orchestrator artik bu katmanda yalnizca state/deps inject eder ve akisi yonetir.
  - `mock.html` script sirasi `search-domain.js` eklenecek sekilde guncellendi.
  - Sonuc: search tarafindaki domain hesap + normalize + progressive depo tarama sorumlulugu app orchestrator'dan ayrilarak net bir owner module'a gecirildi.
- 2026-04-20 (V2.3 modular extraction step-10 - app runtime owner):
  - Yeni modul eklendi: `renderer/scripts/app-runtime.js` (`window.V23AppRuntime`)
  - `app-v23.js` icindeki auth/session/bootstrap owner fonksiyonlari bridge delegasyona cekildi:
    - `getToken`, `getStoredUser`, `setSession`, `clearSession`, `authFetch`
    - `fetchSetupStatus`, `login`, `setup`, `ensureAuth`
    - `loadAppMeta`, `loadConfig`, `loadHistory`, `configuredDepotIds`
  - Orchestrator artik bu katmanda is kurali owner'i degil; state + deps inject ederek runtime module cagiriyor.
  - `mock.html` script sirasi `app-runtime.js` eklenecek sekilde guncellendi.
  - Sonuc: app giris akisi ve bootstrap sorumlulugu da moduler owner'a alinmaya baslandi; `app-v23.js` dosya boyutu/karmaşıkligi daha da azaldi.
- 2026-04-20 (V2.3 modular extraction step-11 - operation identity owner):
  - Yeni modul eklendi: `renderer/scripts/operation-identity.js` (`window.V23OperationIdentity`)
  - `app-v23.js` icindeki identity/matching owner fonksiyonlari bridge delegasyona cekildi:
    - `resolveDepotIdentity`
    - `matchesDepotIdentity`
    - `buildPlanKeyCandidates`
    - `matchesPlanIdentity`
    - `findPlanItemByIdentity`
    - `isPlanEntryPresent`
  - Bu adimla plan/search/onay arasindaki key + depot eslestirme mantigi tek modulde toplandi.
  - `mock.html` script sirasi `operation-identity.js` icerecek sekilde guncellendi.
  - Sonuc: `app-v23.js` basindaki kritik kimlik ve toleransli eslestirme kodlari owner modula gecirildi; orchestrator sadeleşmesi devam etti.
- 2026-04-20 (V2.3 modular extraction step-12 - navigation runtime owner):
  - Yeni modul eklendi: `renderer/scripts/navigation-runtime.js` (`window.V23NavigationRuntime`)
  - `app-v23.js` icindeki nav/page orchestration owner fonksiyonlari bridge delegasyona cekildi:
    - `updateNavSummary`
    - `switchPage`
    - `bindTopNavV2` (ve `bindTopNav` wrapper)
  - Top-nav arama suggestion + enter/search icon + shortcut + draft-state davranislari module owner'a tasindi.
  - `mock.html` script sirasi `navigation-runtime.js` icerecek sekilde guncellendi.
  - Sonuc: UI orchestration katmaninda nav logic de app orchestrator'dan ayrildi; `app-v23.js` fonksiyon yogunlugu azalmaya devam etti.
- 2026-04-20 (V2.3 modular extraction step-13 - offer domain owner):
  - Yeni modul eklendi: `renderer/scripts/offer-domain.js` (`window.V23OfferDomain`)
  - `app-v23.js` icindeki teklif/planning owner fonksiyonlari bridge delegasyona cekildi:
    - `calculatePlanning`
    - `getOfferDisplayName`
    - `getOfferDepotLabel`
    - `buildPlanPayloadFromOffer`
  - Boylece detail/bulk/plan alternatif akislari ayni teklif->plan payload kontratini artik ayri bir domain owner uzerinden kullanmaya basladi.
  - `mock.html` script sirasi `offer-domain.js` icerecek sekilde guncellendi.
  - Sonuc: yalniz UI degil, kritik fiyat hesaplama ve payload standardizasyonu da monolitten ayrildi; `app-v23.js` daha gercek bir orchestrator rolune yaklasti.

- 2026-04-20 (V2.3 render stability): `midstage/2.3/renderer/scripts/app-v23.js` icinde plan yeniden-cizim cagrilari tek helper altinda toplandi (`renderPlanSurfaces`).
- Sebep: ayni akis icinde `renderPlanPageV2()` ve legacy `renderPlanPage()` karisik kullanildigi icin plan toolbar/approval UI gibi V2.3 yuzeyleri bazi aksiyonlardan sonra eski gorunume donebiliyordu.
- Uygulanan guvenli kural:
  - plan mutasyonlarinda tek render entrypoint kullanilir
  - aktif sayfa plan degilse gereksiz tam plan render zorlanmaz
  - plan drawer aciksa ayni helper drawer'i da taze tutar
- Bu turda feature kesilmedi; sadece render orchestration tekillestirildi.
- 2026-04-20 (V2.3 nav binding cleanup): cift top-nav binding riski azaltildi.
  - `bindTopNav()` artik legacy kopya dinleyici kurmak yerine dogrudan `bindTopNavV2()` delegasyonu yapiyor.
  - `bindTopNavV2()` icine idempotent guard eklendi (`data-bound-top-nav`) ve tekrar cagri durumunda duplicate listener birikmesi engellendi.
  - UI metinlerinde kalan mojibake karakterleri (`Â·`) temizlendi.
- 2026-04-20 (V2.3 low-risk consolidation): legacy `renderPlanPage()` artik uyumluluk shim'i ve `renderPlanPageV2()` delegasyonu olarak birakildi.
  - Sebep: V2.3 plan owner tekil kalsin; eski template'in tekrar devreye girme riski kalksin.
  - `DOMContentLoaded` tarafinda da tek giris noktasi korunmasi icin `bindTopNavV2()` dogrudan cagrisi yerine `bindTopNav()` cagrildi.
  - Bu adim feature davranisini degistirmedi; sadece owner ve entrypoint tekillestirme yapti.
- 2026-04-20 (V2.3 startup micro-cleanup): `bootstrapApp()` icindeki gereksiz home cift-render temizlendi.
  - once `renderHomePage()` + `switchMock('home')` birlikte calisiyordu.
  - simdi tek render yolu (`switchMock('home')`) kullaniliyor; davranis ayni, ilk acilis daha temiz.
- 2026-04-20 (V2.3 low-risk drawer fixes):
  - `renderBulkDrawer()` icinde tanimsiz `groupIndex` kullanimlari kaldirildi; secili grup indeksi tek degiskende hesaplanip buton aksiyonlarina veriliyor.
  - boylece bulk drawer teklif kartlarinda `Bu Depoyu Sec` / `Plana Ekle` tiklarinda olasi runtime hata riski kapandi.
  - `closeDrawer()` artik `planDrawerKey` state'ini temizliyor.
  - `closeBulkDrawer()` artik `bulkDrawerIndex` state'ini `-1`e cekiyor.
  - `openBulkDrawer()` gecersiz index verilirse emniyetli sekilde erken donuyor.
- 2026-04-20 (V2.3 dead code cleanup): plan onay ekraninda kullanilmayan `renderApprovalScaffold` helper'i kaldirildi; aktif onay render yolu tek helperda toplandi.
- 2026-04-20 (V2.3 search consistency pass):
  - Search akisina latest-only koruma eklendi (`searchRunId`).
  - `runSearch()` icinde eski arama tamamlandiginda yeni aramayi ezmesini engelleyen run-id guard ve abort handling eklendi.
  - `searchAcrossDepots()` / `searchDepot()` artik `AbortSignal` kabul ediyor; iptal edilen istekler search zincirinde sessizce durduruluyor.
  - Suggestion akisina da run-id + stale-query guard eklendi (`suggestionRunId`):
    - eski suggestion cevabi yeni input'u ezmiyor
    - input kisalinca veya arama tetiklenince suggestion request'i abort ediliyor
  - Hedef: hizli yazma/arama tekrarinda stale UI ve yanlis sayfaya atlama riskini azaltmak.
- 2026-04-20 (V2.3 search layer -> 2.2 method alignment):
  - `runSearch()` tek-shot `await searchAcrossDepots()` modelinden cikarildi.
  - 2.2'deki metoda benzer sekilde:
    - aktif depolar tek tek paralel cagrilir (`/api/search-depot`)
    - sonuc geldikce `allItems` birikir
    - batch render (`SEARCH_RENDER_BATCH_MS=120`) uygulanir
    - non-barcode aramada min gather suresi (`MIN_GATHER_TIME_MS=1500`) korunur
    - son depot tamamlandiginda final snapshot render edilir
  - Front UI katmani korunmustur: `search-variants` / `search-detail` sayfa ve kart yapilari degismedi.
  - Ama method 2.2 davranisina yaklastirildi: progressive aggregation + finalization + hata sinifina gore varyant ekranina donus.
- 2026-04-20 (V2.3 approval list flow fix):
  - Onay listesi sadece plan satirinda flag set etmiyordu; queue store ile tam senkron degildi.
  - Yeni helperlar eklendi:
    - `upsertApprovalFromPlanItem`
    - `removeApprovalQueueEntry`
    - `completeApprovalSelection`
  - `Onaya Gonder` artik plan satirini `approved` yaparken approval queue'ya upsert eder.
  - `Onayi Kaldir` ve plan satiri silme akislari queue'dan ilgili kaydi da temizler.
  - Onayli satir qty degisirse queue kaydi da guncellenir (adet/toplam/birim stale kalmaz).
  - Alternatif depo seciminde onay durumu korunur; eski depo queue kaydi silinir, yeni secilen depoya tasinir.
  - `Secilenlerle Devam Et` butonu artik aktif:
    - secili kayitlar icin depot acilisini tetikler
    - secili kayitlari queue'dan dusurur
    - onay modundan normal plan gorunumune doner.
- 2026-04-20 (V2.3 "Plana Ekle" unified state fix):
  - `midstage/2.3/renderer/scripts/app-v23.js` icinde gecici `row.planAdded` flag modelinden cikildi; kaynak olarak dogrudan `orderPlan` alindi.
  - Yeni helper: `isPlanEntryPresent(key, depotId, depot, planItems?)`.
  - Bu helper ile 3 yuzey tek davranisa cekildi:
    - Ilac detay sidebar'daki ana `Plana Ekle` butonu
    - Toplu arama tablo satirindaki `Plan` aksiyonu
    - Toplu arama drawer teklif kartlarindaki `Plana Ekle` butonu
  - Eger kalem zaten plandaysa buton otomatik yesil vurgu + `Plana Eklendi` metnine doner; tek bir ekranda degil tum akislarda ayni gorunur.
  - Ama yine tiklanabilir birakildi (replace/update davranisi korunur), yani feature kaybi olmadan geri bildirim tutarli hale getirildi.
  - Ek kok neden/fix: bazi akislar `BARCODE_...` / `NAME_...` key'i uretirken `normalizePlanItem` kayitta key'i barkod/isim formatina normalize ettigi icin varlik kontrolu mismatch oluyordu.
  - Bunun icin `buildPlanKeyCandidates` eklendi ve `isPlanEntryPresent` key-prefix donusumlerini (`BARCODE_`, `NAME_`) toleransli eslestirecek sekilde guncellendi.
- 2026-04-20 (V2.3 modularization kickoff - entity bridge):
  - `mock.html + scripts/app-v23.js` runtime'inda `renderer/src` altindaki domain classlari (v2.2 ile ayni owner yapisi) aktif kullanilmiyordu.
  - `app-v23.js` icine `bootstrapDomainBridge` eklendi ve asenkron dynamic import ile su classlar baglandi:
    - `DrugEntity`
    - `DepotEntity`
    - `OrderDataEngine`
    - `UserEntity`
  - Domain bridge fallback-safe tasarlandi: import ya da class map fail olursa legacy helper akislari calismaya devam eder.
  - Ilk entegrasyon noktalari:
    - user normalize/login/setup/me akislarinda `UserEntity` tabanli standardizasyon
    - config -> aktif depo listesi cikarmada `DepotEntity.isReadyForSearch()`
    - ham depo sonucu normalize asamasinda `DrugEntity` tabanli standart alan map'i
    - MF parse/hesaplama girisinde `OrderDataEngine.parseMf()` delegasyonu
  - Bu adim "big-bang" refactor degil; davranis kirilmadan monolit icinde domain gateway acma adimidir.
- 2026-04-20 (V2.3 modularization step-2 - unified search entity pipeline):
  - Search, variant ve bulk akislarinda `/api/search-depot` yanitlari artik tek normalize entrypoint uzerinden geciyor:
    - `searchDepot` -> `normalizeDepotResults` -> `normalizeDepotItem` (`DrugEntity` destekli)
  - `runSearch()` icindeki manuel fetch/map zinciri kaldirildi; progressive akis `searchAcrossDepotsProgressive` helper'ina toplandi.
  - Boylece hem klasik arama hem toplu arama ayni entity-normalized item yapisini kullanmaya basladi.
  - Varyant identity standardi guclendirildi:
    - `getItemIdentityKey()` artik varsa dogrudan `entityId` kullanir
    - fallbackte `normalizedName` kullanimi eklendi
  - Sonuc: search + variant + bulk tarafinda field drift azaltildi ve tek data kontratina yakinlasildi (ad/name, barkod/barcode, fiyat/fiyatNum senkronu).
- 2026-04-20 (V2.3 modularization step-3 - plan/order standard payload + engine-aligned math):
  - Plana ekleme akislarinda tekrarlayan payload olusturma kodu tek helper'a cekildi:
    - `buildPlanPayloadFromOffer`
  - Bu helper su yuzeylerde ortak kullanima alindi:
    - detay ekrani (`addSelectedOfferToPlan`)
    - bulk satir ekleme (`addBulkRowToPlan`)
    - bulk drawer teklif ekleme (`addBulkOfferToPlan`)
    - plan alternatif depo secimi (`selectPlanAlternative`)
  - Hesaplama standardi `calculatePlanning` icinde `OrderDataEngine.calculateBestOptions` ile hizalandi (fallback legacy hesap korunuyor).
  - Plan qty degisiminde (`changePlanQty`) artik yalniz `totalCost = effectiveUnit * qty` degil;
    - `orderQty/receiveQty/totalCost/effectiveUnit` bir arada yeniden hesaplanip kaydediliyor.
  - Sonuc: entityler arasi veri haberlesmesi plan tarafinda da tek kontrata yaklastirildi; akislarda hesap/alan drift riski azaldi.
- 2026-04-20 (V2.3 modularization completion - plan domain extraction):
  - Plan katmanindaki domain hesap/gruplama kodu `app-v23.js` icinden ayrilmaya baslandi ve ayri script owner'a alindi:
    - yeni dosya: `midstage/2.3/renderer/scripts/plan-domain.js`
  - Cikarilan owner fonksiyonlari:
    - `groupPlanItems`
    - `groupPlanItemsByDepot`
    - `buildPlanDrawerOptions`
  - `app-v23.js` artik bu fonksiyonlari `window.V23PlanDomain` bridge'i uzerinden cagiriyor, bridge yoksa legacy fallback koruyor.
  - `mock.html` yukleme sirasi guncellendi:
    - `utils.js`
    - `plan-domain.js`
    - `app-v23.js`
  - Sonuc: plan ekrani ve drawer option hesaplari monolitten ayrilan ilk net feature-domain parcasi oldu; davranis kirilmadan moduler owner modeli kuruldu.
- 2026-04-20 (V2.3 modularization completion - plan UI extraction + runtime contract guide):
  - Yeni UI owner modulu eklendi: `midstage/2.3/renderer/scripts/plan-ui.js` (`window.V23PlanUI`)
    - `renderPlanPage(ctx)`
    - `renderPlanDrawer(ctx)`
  - `app-v23.js` icindeki `renderPlanPageV2` ve `renderPlanDrawer` artik once `V23PlanUI` bridge'ini kullanir; bridge yoksa legacy fallback devrede kalir.
  - `mock.html` yukleme sirasi moduler owner'lar icin guncellendi:
    - `utils.js` -> `plan-domain.js` -> `plan-ui.js` -> `app-v23.js`
  - Gercek moduler calisma prensibini ekip icin kalici yapmak amaciyla yeni dokuman eklendi:
    - `midstage/2.3/MODULAR_RUNTIME_GUIDE.md`
  - Bu adimla V2.3 runtime'ta orchestrator (`app-v23.js`) + domain owner + UI owner ayrimi calisan sekilde kuruldu.
- 2026-04-20 (V2.3 hotfix - Onaya Gonder queue identity mismatch):
  - Sorun: bazi kayitlarda depo kimligi `depotId`, bazilarinda etiket (`depot`) formatinda geldigi icin
    `queuePlanItemForApproval` ve approval queue eslesmeleri kacabiliyordu.
  - Uygulanan duzeltme:
    - `resolveDepotIdentity`, `matchesDepotIdentity`, `matchesPlanIdentity`, `findPlanItemByIdentity` helperlari eklendi.
    - `queuePlanItemForApproval` artik plan kaydini kimlik tolerant sekilde bulup queue'ya upsert ediyor.
    - `normalizeApprovalItem` icinde `depotId` canonical hale getirildi.
    - `removeApprovalQueueEntry` eslesmesi kimlik tolerant hale getirildi.
    - `buildPlanPayloadFromOffer` cikisinda `depotId` canonical hale getirildi.
  - Sonuc: `Onaya Gonder` aksiyonu sonrasinda kayitlar Onay Listesi'ne tutarli sekilde dusuyor.

- `midstage/2.2` artik depo baglantilarini global `config.json` yerine kullaniciya bagli `data/local-accounts.json` uzerinden simule edebiliyor.
- Bu store bugunku "DB yok ama account-based gibi davranalim" katmanidir:
  - `auth.json` kullaniciyi temsil eder
  - `local-accounts.json` kullanici + depo connection kaydini temsil eder
  - setup/login sonrasi ilgili hesap aktive edilir
  - startup sirasinda legacy auth kaydindan hesap otomatik seed edilir
- Pratik model simdiden su hale geldi:
  - `User/Auth`
  - `Account`
  - `DepotConnection`
  - `History (user-scoped)`
- Kritik security hardening maddeleri uygulandi:
  - root ve `midstage/2.2` server artik varsayilan olarak `127.0.0.1` uzerinden bind olur
  - `/api/auth/setup` ve `/api/auth/login` icin brute-force rate limit eklendi
  - preload'dan `getDepotCookies` kaldirildi
  - Electron `inject-depot-cookies` sadece izinli depot host'larina cookie set edebilir
  - `open-url-in-chrome` sadece `http/https` URL kabul eder
  - variant secim kartinda depot urun adlari escape edilerek basilir
  - build paketlerinden runtime data ve test helper dosyalari cikarildi
- Halen acik ama ikinci tur konusu olan maddeler:
  - repo icindeki eski canli secret/config verilerinin rotate edilmesi
  - query-string token fallback'inin kaldirilmasi
  - gercek user/admin authorization modeli

## Guncel Not - 2026-04-19 V2.2 Current-Modular Rebase

- `midstage/2.2` ilk kurulurken eski/root runtime tabanindan alinmis, bu da workspace/operasyonel gorunum parity'sini bozmustu.
- Kritik duzeltme yapildi: `midstage/2.2/main.js`, `preload.js`, `src/**`, `renderer/**` artik `midstage/current-modular` tabanindan yeniden senkronlandi.
- Bu sayede 2.2 artik `runtimeCoordinator`, workspace search shell, workspace plan rail, UI mode chip'leri ve son operasyonel gorunumleri koruyan dogru tabani kullaniyor.
- V2.2'ye ozel katmanlar bu dogru tabanin ustune geri eklendi:
  - `window.V22Modules` publisher
  - `GET /api/health`
  - `POST /api/test/session/start`
  - `GET /api/test/session/current`
  - `GET/POST/DELETE /api/test/client-log`
  - renderer diagnostic relay hook
- `midstage/2.2/package.json` dependency metadata'si current-modular runtime beklentileriyle hizalandi.
- Smoke check: izole portta `health`, `session-start`, `client-log-add`, `client-logs` basarili.

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
- Bulk search detay metninde `al / gel` dili kullanilmaz; ozet `Hedef X adet � MF Y+Z` formatindadir.
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
- Se�ili satir tabloda `is-selected` sinifi ile vurgulanir ve `Secili Siparis Deposu` pill'i gorunur.

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

## Search Engine (v1.0 � 2026-04-05)

### Mimari
- `src/search-engine.js` � Provider Registry Pattern
- Her depo bir **search provider** olarak kayit olur: `searchEngine.register(id, {name, searchFn})`
- Providerlar `activate(id)` / `deactivate(id)` ile yonetilir
- `search(query, {onResult, onDone, onError})` � tum aktif providerlar **paralel** sorgulanir

### SSE Endpoint
- `GET /api/search-smart?q=...&token=...`
- `Content-Type: text/event-stream`
- Event tipleri:
  - `results` � {depotId, depot, depotUrl, results[]}
  - `error` � {depotId, depot, error}
  - `done` � {} (tum providerlar tamamlandi)

### Frontend Entegrasyonu
- `doSearch()` � `new EventSource(sseUrl)` � tek baglanti, tum depolar
- `_activeEventSource` � onceki SSE baglantilarini kapatir (race condition)
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

### Depo Ekleme Prosed�r�
1. `src/depots/yeni-depo.js` yaz � `search(query)` methodu olan sinif
2. `server.js` � `DEPOT_CLASSES`'a 1 satir ekle
3. Config'de credentials tanimla � otomatik olarak engine'e kayit olur

### Geri Alma
- `_legacy/doSearch-v1.js` � eski frontend kodu + prosedur
- `_legacy/server-search-v1.js` � eski server search endpoint'leri

## Guncel Not - 2026-04-05 Active Plan Drawer
- Aktif plan detay kartlari artik sag panel plan duzenleyici aciyor.
- Duzenleyici barkod uzerinden depo tekliflerini yeniden topluyor, qty degisince resolvePlannerOptions ile MF/canli fiyat guncelliyor.
- Kaydet aksiyonu plan kaydini secilen depo ve istenen adet ile yeniden yazar.

- Active plan drawer UI refresh: daha genis sag panel, ust toplam karti, daha net depo kartlari ve sticky aksiyon alani.

- Active plan cards now keep quick actions on-card while full editing still opens in right drawer.


## Guncel Not - 2026-04-05 Modular Compatibility
- Yeni modular renderer yapisi tam feature parity seviyesinde degil.
- Mevcut yaklasim: legacy app.js feature owner olarak geri aktif, renderer/src/main.js compatibility bootstrap olarak calisiyor.
- Bundan sonraki modular migration'lar per-feature ve legacy parity korunarak yapilmali.

## Guncel Not - 2026-04-05 Backend Encoding
- UI duzgun gorunse bile backend tarafinda depo adlari ve hata metinlerinde mojibake kalintilari vardi.
- Runtime etkileyen kisimlar temizlendi: `DEPOT_CLASSES` isimleri, login error stringleri, `btnGiris`, depot alias eslesmeleri.
- `server.js` icinde depot instance bulma artik normalize edilmis isimlerle yapiliyor; `Sel�uk/ Selcuk / Sel�uk` varyantlari ayni depoya resolve edilir.
- Yorumlarda kalan bozuk metinler ikincil onemdedir; asil davranis riski tasiyan stringler temizlenmistir.

## Guncel Not - 2026-04-05 Midstage Klasorleme
- Aktif kod tabani artik `D:\personal\eczane-app\midstage\current` altinda da tutuluyor.
- Root klasor proje hafizasi, planlar ve ust seviye belgeler icin korunuyor.
- `midstage/releases` gelecekte version/release klasorleri acmak icin hazir.
- Bundan sonraki kod odakli islerde hedef workspace olarak `midstage/current` kullanilmasi tercih edilmeli.

## Guncel Not - 2026-04-06 Root Temizligi
- Root klasorde gorunen eski release klasorleri artik `midstage/releases/legacy` altinda.
- Eski debug loglari ve gecici artefaktlar `_archive` altina alindi; root daha temiz hale getirildi.
- Deneysel `front` klasoru `_archive/experiments/front` altina tasindi.
- Yeni feature ve aya�a kald�rma calismalarinda temel hedef klasor `D:\personal\eczane-app\midstage\current` olmalidir.

## Guncel Not - 2026-04-06 Cift UI Modu
- Kullanici talebine gore modular dusunceyle iki UI modu yaklasimi baslatildi.
- Ilk uygulama `midstage/current` uzerinde profile menuye eklendi:
  - `Klasik Arayuz`
  - `Workspace Modu`
- Mod secimi `body[data-ui-mode]` ile stil bazli yonetiliyor ve `localStorage` ile kalici tutuluyor.
- Bu asamada sadece layout/stil katmani eklendi; ana feature akislari ayni kaldi.
- Sonraki adimlar:
  1. Workspace modunda search ekranini daha tablo-merkezli hale getirmek
  2. Aktif siparis plani + karsilastirma ekranini split-view mantigina yaklastirmak
## Guncel Ek Not - 2026-04-06 UI Yogunlastirma
- Aktif gelistirme klasoru: midstage/current.
- Workspace modu, daha az scroll icin optimize edildi.
- Home hero, mini siparis plani, search sonuc ust alani ve plan detay ekranlari daha kompakt.
- Plan detay ozet bandi sticky, mini plan listesi ise sinirli yukseklikte ic scroll ile calisiyor.
## Guncel Ek Not - 2026-04-06 Workspace Faz 2
- Workspace modunda order plan detail kartlari artik kompakt render ediliyor.
- Mini metric grid: Birim, Barkod, Depo.
- Aksiyonlar sag blokta toplandi; drawer akisi korunuyor.
## Guncel Ek Not - 2026-04-06 Workspace Faz 3
- Search ekraninda workspace mode split-view etkin.
- Product solda, best offer ve quick actions sagda.
- Depot offers table ic scroll + sticky header ile viewport icine sigdirildi.
## Guncel Ek Not - 2026-04-06 Workspace Faz 4
- Search page: loading, variant selection ve back button daha kompakt.
- Variant cards workspace modunda iki kolonlu masaustu listesine dondu.
- Order plan detail kartlari ek olarak inline meta satirina cekildi.

## Guncel Ek Not - 2026-04-06 Workspace Compactness

- Workspace modu aktifken search ve plan ekranlari daha yogun masaustu duzenine cekildi.
- stockCalcPanel artik search grid icinde sol kolonda yer aliyor; tam genislikte gereksiz bosluk birakmiyor.
- Workspace gorunumu mod degisiminde yeniden render ediliyor; kullanici klasik/workspace gecisinde aninda fark gormeli.
## Guncel Ek Not - 2026-04-06 Midstage Relaunch

- Midstage calisma klasorunde bazen stale single-instance lock olusuyor.
- Gecici olarak main.js lock alinmasa da acilisi surdurecek sekilde yumusatildi.
## Guncel Ek Not - 2026-04-06 Midstage UserData

- Midstage calisma instance'i artik ayrik Electron userData klasoru kullanir.
- Boylece ana uygulama ile singleton ve Chromium profile lock cakismasi azaltildi.
## Guncel Ek Not - 2026-04-06 Midstage Singleton

- Midstage calisma instance'inda single-instance davranisi gecici olarak kapatildi.
- Hedef: gelistirme akisinda Electron acilisini kararl? hale getirmek.
## Guncel Ek Not - 2026-04-06 Backend Spawn

- Kullanici ront geliyor backend yok semptomu verdi.
- Teshis: server.js listen callback icindeki browser launch denemesi spawn EPERM ile backendi dusuruyordu.
## Guncel Ek Not - 2026-04-06 Midstage Rollback

- Kullanici geri cekme istedi; midstage/current kodu root calisan kodla yeniden hizalandi.
- Bundan sonraki gelistirme yeniden calisan baz uzerinden yapilacak.
## Guncel Ek Not - 2026-04-16 Workspace Safe Return

- Midstage rollback sonrasi workspace modu kaybolmustu.
- Simdi daha guvenli bir yaklasimla geri eklendi: mod secimi + body dataset + rerender + CSS yogunlastirma.
## Guncel Ek Not - 2026-04-16 Clean Relaunch

- Workspace modu test edilmeden once stale process karisikligi temizlenmeli.
- Tek instance ile relaunch yapilacak.
## Guncel Ek Not - 2026-04-16 Workspace Safe Search Rollback

- Kullanici ekran bozulmasi bildirdi.
- Split-view workspace tasarimi search/order ekranlarinda geri cekildi; safe mode ile klasik akisa donuldu.

## Guncel Not - 2026-04-16 Workspace Operasyon Masasi
- Workspace modu artik yalnizca yatay sikistirma degil; search ekraninda ayri bir render yolu kullanir.
- Yeni workspace search modeli: sol mini plan rail, orta sonuc ozeti + varyant secimi + kompakt depo karar tablosu.
- Workspace arama ekraninda klasik buyuk product/best/action kartlari kullanilmaz; klasik mod korunur.
- Workspace plan detay ekrani da ayri kompakt render branch ile cizer.

## Guncel Not - 2026-04-16 Current-Modular Refactor

- Yeni calisma klonu: `D:\personal\eczane-app\midstage\current-modular`
- Bu klonda mojibake temizligi runtime + docs kapsamiyla uygulandi.
- Guard script eklendi:
  - `npm run mojibake:check`
  - `npm run mojibake:fix`
- `renderer/scripts/app.js` icindeki secili alanlar adapter tabanli modullere tasindi.
- Adapter kaydi: `window.ModularAppAdapters` (`renderer/src/main.js`)
- Eklenen moduller:
  - `renderer/src/shared/LegacySharedHelpers.js`
  - `renderer/src/features/pricing/LegacyPricingEngine.js`
  - `renderer/src/features/search/LegacySearchUtils.js`
  - `renderer/src/features/workspace/WorkspaceShell.js`
  - `renderer/src/features/settings/SettingsTabs.js`
- Modul dokumani: `midstage/current-modular/docs/modules/*`

## Electron Baslatma Notu

- Midstage modular klonunu Electron ile baslatmak icin:
  1. `cd D:\personal\eczane-app\midstage\current-modular`
  2. `npm start`
- Opsiyonel kontrol:
  - `npm run release:check`
  - `npm run mojibake:check`

## Guncel Ek Not - 2026-04-16 MF Hesaplayici Tutarlilik Fixi

- `midstage/current-modular/renderer/scripts/app.js` icinde Search ekrani MF Hesaplayici akisi planner zinciri ile hizalandi:
  - fallback: `getFallbackPlannerOptions(items, qty)`
  - live: `resolvePlannerOptions(items, qty)`
- MF satir detay metni stock calc tarafinda tek helperdan okunuyor:
  - `getPlannerOptionDetailText(option, qty)`
- Bu degisiklikle qty=1 ve qty>1 ekran davranisi arasinda tutarlilik arttirildi.

- 2026-04-16 not: Workspace search ekraninda secili teklif kimligi fiyat tabanli olmamali. Canli quote fiyat degistirdiginde secim eski depoya resetleniyordu; stable offer key'e gecildi.

- 2026-04-16 not: midstage/current backend spawn EPERM nedeni server.js icindeki exec(start http://localhost) idi. Restart ve frontend-backend ayrismasinda bu satirlar kapatildi.

- 2026-04-16 not: current-modular artik root/current ile ayni Electron profile yolunu kullanmiyor. Dev acilista userData ayrildi, lock alinmasa da packaged degilken uygulama devam edebiliyor.

- 2026-04-16 not: current-modular packaged degilken requestSingleInstanceLock kullanmiyor. Bu klon icin gelistirme kararliligi onceliklendirildi.

- 2026-04-16 not: current-modular icinde moduler kaynaklar korunuyor ancak runtime-kritik katman gecici olarak current ile hizalandi. Hedef: feature parity geri gelsin, sonra modulerlestirme kontrollu devam etsin.

- 2026-04-17 not: current-modular kullanilabilirligini geri getirmek icin calisan current runtime kabugu topluca geri kopyalandi. Moduler kaynaklar korunuyor ama aktif runtime current parity'de tutuluyor.

- 2026-04-17 not: current-modular workspace searchte plan ekleme sonrasi sol rail stale kalabiliyordu. refreshOrderPlanViews search/workspace durumunda rail ve tablo badge'lerini tekrar render ediyor. workspace-mf-* class'lari icin CSS eklendi.

- 2026-04-17 not: Stabilizasyon planinin yeni ana ekseni session self-heal + backend health + search consistency + plan rerender + current-modular automation test altyapisidir.

## Guncel Ek Not - 2026-04-17 19:55
- Workspace MF paneli artik varsayilan olarak acik gelmez; sadece `MF Hesapla` ile acilir.
- Workspace search icinde MF acikligi urun/depo/form baglamina baglandi; stale panel tasinmasi engelleniyor.
- Workspace ve klasik MF yuzeyleri birbirinden ayrik tutulmaya devam edilmeli.

## Context Refresh - 2026-04-17
Active optimization work is now happening in D:\personal\eczane-app\midstage\current-modular.
Recent critical improvements:
- hard abort for stale search requests
- scoped abort for workspace/stockcalc/plan quote requests
- silent depot session keep-alive route + worker
- first extracted runtime helper module: 
enderer/scripts/runtime-coordinator.js
Open larger tracks still remain:
- deeper pp.js decomposition
- search/bulk parity audits after abort integration
- workspace density improvements after behavior is stable

[2026-04-17 10:13:13] Order plan UI rule: same product added from multiple depots remains stored as separate entries but is rendered as a grouped product with multiple depot options under one card.

## Guncel Ek Not - 2026-04-17 Workspace Plan Yogun Liste
- `midstage/current-modular` icinde sadece workspace modunda aktif olan yogun liste gorunumlu siparis plani detay ekrani eklendi.
- Yeni modul: `renderer/src/features/plan/WorkspacePlanView.js`, adapter olarak `window.ModularAppAdapters.plan` altinda yayinlanir.
- `renderer/scripts/app.js` icindeki `renderOrderPlanDetail()` workspace branch'i once bu adapter'i dener, adapter yoksa eski render'a fallback yapar. Klasik mod (`isWorkspaceMode()` false) aynen korundu.
- Her urun accordion olarak acilir; cok depolu urunlerde en ucuz birim maliyetli depo "En ucuz" rozeti alir, digerleri icin en ucuza gore `+delta` fark gosterilir.
- Event baglama halen `bindOrderPlanEntryEvents()` tarafindan yapilir; yeni modul sadece HTML + accordion toggle dinleyicisi ekler. Data-attribute kontratlari degismedi (`data-plan-editor-open`, `data-plan-card-minus/plus/depot/remove`).
- Yeni CSS prefix: `.ws-plan-*`. Stil yalniz `body[data-ui-mode="workspace"]` altinda gecerlidir.

## Guncel Not - 2026-04-18 Account-Based Gecis Hazirligi

- Proje artik depo bazli tekil HTTP entegrasyonundan account-based uygulama mimarisine gecis esiginde.
- Bunun anlami: depo login/session/cookie/token bilgileri gecici runtime hilesi gibi degil, hesap bazli kalici uygulama verisi olarak ele alinmali.
- `depo_https/` klasoru olusturuldu ve depo bazli HTTP akis dokumani toparlandi.
- Bu klasorde su an README duzenlenmis depolar:
  - `alliance`
  - `anadoluitriyat`
  - `anadolupharma`
  - `selcuk`
  - `sentez`
- Ham HTTP, curl, login ve response notlari korunuyor; ustune insan okunur aciklama katmani eklendi.
- Bu dokumanlar artik yeni backend/model tasariminda referans kabul edilmeli.

## Guncel Not - 2026-04-18 Veri Modeli ve Server Tarafi Endisesi

- Kullanici account-based yapıya gecisin buyuk is oldugunu acikca belirtti: database tasarimi, entity tasarimi ve server kurgusu henuz net degil.
- Bu bir bugfix isi degil; kontrollu migration isi olarak ele alinmali.
- Sonraki teknik asamalar buyuk olasilikla su basliklarda ilerleyecek:
  - account
  - user
  - depot connection
  - depot session / auth artifact
  - search history
  - order plan
  - purchase history
- Ozellikle depo baglantisi ile depo oturumu ayni sey olarak modellenmemeli.
- Onerilen kavramsal ayrim:
  - `DepotConnection`: kullanicinin o depoya ait credential ve ayar kaydi
  - `DepotSession`: cookie/token/session gibi gecici auth artifact'lari
- Mevcut root/config tabanli yapi kademeli olarak account-scope veri modeline tasinacak; ani buyuk patlama refactor riskli.

## Guncel Not - 2026-04-18 Perakende / Depo Fiyati Arastirma Durumu

- Depo bazli fiyat alanlari not edildi; her depoda ayni anlamda fiyat donmuyor.
- Canli fiyat hesaplayan depolar:
  - Selcuk
  - Nevzat
  - Alliance
- Liste response'u uzerinden fiyat veren depolar:
  - Anadolu Pharma
  - Anadolu Itriyat
  - Sentez
- Perakende fiyat acisindan en net alanlar:
  - Selcuk / Nevzat: `etiketFiyati` muhtemel referans/perakende alan
  - Sentez: HTML tabloda `Perakende` kolonu acik
  - Anadolu Pharma: detay response'unda `PSFFiyat` dikkat cekiyor, ileride perakende alan adayi olabilir
- Bu alanlar yeni veri modelinde tek `price` alanina zorla indirgenmemeli; `priceType` veya ayrik alan mantigi dusunulmeli.

## Guncel Not - 2026-04-19 V2.2 Modular Refactor Plani

- `midstage/2.2` artik tam modulerlik hedefi icin ayrik plan workspace'idir.
- Bu alan `current-modular` gibi adapter-first degil, `copy-first migration workspace` olarak tanimlandi.
- Ana kural: kaynak kod okunur ama ilk extraction turunda kaynaktan silinmez.
- `renderer/scripts/app.js`, `renderer/index.html` ve `renderer/src/main.js` ilk fazda read-source kabul edilmelidir.
- Yeni modul owner adaylari yalniz `midstage/2.2/**` altinda acilacaktir.
- Ana plan dosyasi: `midstage/2.2/V2_2_MODULAR_REFACTOR_PLAN.md`
- App.js parcalama haritasi: `midstage/2.2/MODULE_MIGRATION_MAP.md`
- V2.2 tamamlanma kriteri:
  - `app.js` feature owner olmayacak
  - `index.html` bootstrap seviyesine inecek
  - feature ownership search, pricing, order-plan, bulk, settings, history ve workspace modullerine dagilacak

## Guncel Not - 2026-04-19 V2.2 Ilk Calisan Extraction

- `midstage/2.2` artik yalniz plan degil, calisan runtime kopyasini da icerir:
  - `main.js`
  - `preload.js`
  - `src/`
  - `renderer/`
  - `package.json`
- V2.2 dev runtime root profile ile cakismasin diye ayri `userData` adi kullanir: `eczane-app-v2_2`
- Dev modda single-instance lock V2.2 icin kapatildi; amac ayni makinede root app ile cakismaz gelistirme yapabilmek
- `midstage/2.2/src/server.js` standalone calistiginda browser auto-open artik default kapali; `spawn EPERM` hotfix'i uygulandi
- Ilk gercek modular extraction su alanlarda yapildi:
  - `renderer/src/shared/storage/LocalJsonStore.js`
  - `renderer/src/shared/products/ProductIdentity.js`
  - `renderer/src/state/PlanState.js`
- `renderer/scripts/app.js` icinde delegasyon aktif olan ilk helper gruplari:
  - `readStoredJson` / `writeStoredJson`
  - order plan + routine storage helper'lari
  - product identity / dedupe / search identity helper'lari
- Syntax check:
  - `npm --prefix midstage/2.2 run check`
- Smoke check:
  - `midstage/2.2/src/server.js` ayaga kalkti ve `http://localhost:3000` -> `200` dondu

## Guncel Not - 2026-04-19 V2.2 Test Arayuzu Plani

- Kullanici terminalden backend test atabilecegi ve frontend izlerini log olarak gorebilecegi bir test etme arayuzu istedi.
- V2.2 icin canonical plan dosyasi:
  - `midstage/2.2/TEST_INTERFACE_PLAN.md`
- Bugunku gozlem:
  - backend script ornegi zaten var: `scripts/test-api-search-depot.js`
  - frontend diagnostic buffer zaten var: `pushDiagnosticEvent()`, `getDiagnosticsSnapshot()`
- Onerilen hedef katmanlar:
  - runtime control
  - backend test CLI
  - frontend diagnostic relay
  - scenario runner
- Ilk uygulanacak sira:
  1. `/api/health`
  2. backend CLI
  3. client-log relay endpoint'leri
  4. ilk smoke scenario

## Guncel Not - 2026-04-19 V2.2 Test Arayuzu Faz 1

- Asagidaki endpoint'ler eklendi:
  - `GET /api/health`
  - `POST /api/test/session/start`
  - `GET /api/test/session/current`
  - `POST /api/test/client-log`
  - `GET /api/test/client-log`
  - `DELETE /api/test/client-log`
- Asagidaki scriptler eklendi:
  - `midstage/2.2/scripts/test-auth.js`
  - `midstage/2.2/scripts/test-backend-cli.js`
  - `midstage/2.2/scripts/test-scenario-runner.js`
- `renderer/scripts/app.js` artik auth sonrasi aktif test session varsa diagnostic olaylari backend'e relay eder
- Dogrulanan smoke:
  - custom portta `health` -> `200`
  - `session-start` -> `200`
  - `client-log-add` -> `200`
  - `client-logs` icinde log kaydi gorundu
- Henuz tam E2E dogrulanmayan kisim:
  - Electron UI acik halde gercek renderer -> backend relay zinciri manuel/otomatik test edilmedi

## Guncel Not - 2026-04-20 V2.3 App Actions Extraction

- `midstage/2.3/renderer/scripts/app-actions.js` eklendi.
- Bu modul artik `app-v23.js` icindeki buyuk interaction/runtime akislarinin owner'i:
  - search/detail aksiyonlari
  - bulk search aksiyonlari
  - settings / compat aksiyonlari
  - plan quantity / alternatif secim aksiyonlari
  - titlebar binding
- `app-v23.js` bu alanlarda owner olmaktan cikip bridge delegator rolune indi:
  - `runSearch`
  - `bulkSearch`
  - `addSelectedOfferToPlan`
  - `addBulkRowToPlan`
  - `selectBulkOffer`
  - `addBulkOfferToPlan`
  - `openBulkVariant`
  - `saveDepotSettings`
  - `testDepotLogin`
  - `changePlanQty`
  - `selectPlanAlternative`
  - `bindTitlebar`
- Yeni contract notu:
  - UI/domain modulleri state mutate etmez.
  - Runtime aksiyon modulleri ise sadece explicit verilen `runtime.state` uzerinden mutation yapar.
  - Boylece global state'e dogrudan baglanmadan owner ayrimi korunur.
- `midstage/2.3/renderer/mock.html` script sirasi guncellendi ve `app-actions.js` `app-v23.js` oncesine eklendi.
- Syntax check:
  - `node --check midstage/2.3/renderer/scripts/app-actions.js`
  - `node --check midstage/2.3/renderer/scripts/app-v23.js`

## Guncel Not - 2026-04-20 V2.3 App Actions Extraction (Phase-2)

- `app-actions.js` kapsami genisletildi:
  - bulk qty mutasyonlari (`changeBulkRowQty`, `setBulkRowQty`)
  - external open flow (`openUrl`, `buildChromeDepotTarget`, `copyAndOpenDepot`, `openPlanInDepot`)
  - drawer runtime (`openDrawer/closeDrawer`, `openBulkDrawer/closeBulkDrawer`, `openPlanDrawer`)
- `app-v23.js` bu fonksiyonlarda owner olmaktan cikip bridge delegator rolune alindi.
- Plan surface temizligi:
  - `renderPlanPageV2` icindeki buyuk legacy HTML fallback bloklari kaldirildi.
  - `renderPlanDrawer` icindeki legacy fallback HTML bloklari kaldirildi.
  - Plan UI owner'i artik net sekilde `plan-ui.js` bridge tarafinda.
- Sonuc:
  - `app-v23.js` daha net orchestrator + bridge dosyasi haline geldi.
  - UI markup fallback daginikligi azaltilarak ownership tek modulde toplandi.

## Guncel Not - 2026-04-20 V2.3 Runtime Bootstrap Delegation

- `renderer/scripts/app-runtime.js` icine `bootstrapApp(runtime, deps)` eklendi.
- `app-v23.js` icindeki bootstrap akisi bridge delegasyona cekildi:
  - `loadAppMeta`
  - `ensureAuth`
  - `loadConfig`
  - `loadHistory`
  - `updateNavSummary`
  - `switchMock('home')`
- Sonuc:
  - Auth/session/bootstrap owner'ligi daha net sekilde `app-runtime` modulu altina toplandi.
  - `app-v23.js` init akisinda karar verici/orchestrator katman olarak daha ince kaldı.

## Guncel Not - 2026-04-20 V2.3 Fallback Cleanup (Phase-3)

- `app-v23.js` icinde kalan agir fallback owner bloklari daha da azaltildi:
  - `calculatePlanning` fallback'i agir MF/order-engine owner kodundan hafif default hesaplamaya indirildi.
  - `buildPlanPayloadFromOffer` fallback'i owner hesap yapmayacak sekilde `null` + warning davranisina cekildi (owner artik `offer-domain`).
  - `buildPlanDrawerOptions` fallback'i `[]` donerek owner hesaplamayi `plan-domain` modulune sabitledi.
  - `updateNavSummary` fallback'i no-op'a cekildi; owner net olarak `navigation-runtime` modulunde.
- Mimari etkisi:
  - Orchestrator dosya icinde "bridge varsa owner, yoksa tam legacy owner" modeli yerine "bridge owner, fallback hafif/default" modeline gecis hizlandi.
  - Moduler ownership cizgileri daha net hale geldi; `app-v23.js` daha saf integration shell'e yaklasti.

## Guncel Not - 2026-04-20 V2.3 Search Fallback Trim (Phase-4)

- `app-v23.js` icinde arama owner fallback zinciri hafifletildi:
  - `searchDepot` bridge yoksa full HTTP/search owner kodu calistirmiyor; hata mesajli bos sonuc donuyor.
  - `searchAcrossDepotsProgressive` bridge yoksa bos sonuc donuyor.
  - `searchAcrossDepots` bridge yoksa bos sonuc donuyor.
- Etki:
  - Search owner'i daha net sekilde `search-domain.js` altina kilitlendi.
  - Orchestrator tarafinda legacy owner geri donus maliyeti dusuruldu.

## Guncel Not - 2026-04-20 V2.3 MF Reset + Drug Screen Encoding Fix

- Yeni ilac aramasinda MF panelinde onceki ilactan kalan state sorunu giderildi.
  - `app-actions.js` icindeki `runSearch()` baslangicinda su resetler eklendi:
    - `state.desiredQty = 1`
    - `state.mfCalculatorOpen = false`
    - `state.bulkDetailContext = null`
- Encoding/mojibake iyilestirmesi:
  - `utils.js` icine `fixMojibakeText()` helper'i eklendi.
  - `search-domain.js` normalize akisinda ilac adi ve depo label'i bu helper ile temizlenir hale getirildi.
  - `app-v23.js` arama domain bridge deps'ine `fixMojibakeText` enjekte edildi.
- Detay ekrani metin encoding hotfix:
  - `detail-ui.js` icindeki bozuk UTF metinler duzgun Turkce karakterlerle guncellendi
    (orn: "SeÃ§ili" -> "Seçili", "AÃ§" -> "Aç", "SipariÅŸ" -> "Sipariş").

## Guncel Not - 2026-04-20 V2.3 Search Relevance + Detail State Lock

- Arama sonuc siralama algoritmasi gelistirildi (`search-domain.js`):
  - Yeni helperlar:
    - `normalizeSearchText`
    - `levenshteinDistance`
    - `scoreSearchSimilarity`
  - `buildVariantGroups` artik grup siralamasinda sadece en ucuz fiyat degil, oncelikle query-name benzerlik skorunu kullanir.
  - Skor bileşimi:
    - tam/eslesen ifade bonusu
    - startsWith/includes bonusu
    - token eslesme orani
    - Levenshtein mesafesine dayali yakinlik
    - barkod exact match bonusu
  - Sonuc: kullanicinin yazdigina en yakin ilac/form varyanti en ustte gelir.

- Ilaca tiklandiginda arama state sonlandirma (`app-actions.js` + `app-v23.js`):
  - `openVariantDetail` icinde aktif search run artik kapatilir:
    - `searchAbortController.abort()`
    - pending search render timer clear
    - `searchRunId` arttirilir (eski callback'ler invalid olur)
    - `searchLoading=false`, `searchDrafting=false`
  - Sonuc: detail ekrana geciste progressive arama callback'leri tekrar render tetiklemez, detail ekrani stabil kalir.

## Guncel Not - 2026-04-20 V2.3 Detail Hero Compact + Drug Image Re-Enable

- Kullanici geri bildirimi: ilac detay ekrani ust karti fazla buyuk/inefficient gorunuyordu.
- `renderer/styles/main.css` icine compact premium hero override eklendi:
  - `product-hero` daha dar padding/gap
  - media alan boyutu optimize (`product-hero-media`)
  - fiyat/qty meta alanlari daha kompakt
  - layout daha yatay ve scan-friendly hale getirildi
- V2.2 referansli ilac gorseli geri getirildi:
  - `renderer/scripts/search-domain.js` icinde image normalize akisi guclendirildi:
    - `normalizeImageUrl` + `isUsableImageUrl` ile temiz URL secimi
    - `resolveProductImage()` helper eklendi
  - `renderer/scripts/detail-ui.js` hero alanina ilac gorseli `<img>` olarak geri eklendi.
  - secili teklifte gorsel yoksa diger tekliflerden ilk gecerli gorsel fallback olarak kullaniliyor.
  - image load fail durumunda icon fallback goruntusu korunuyor.
- `app-v23.js` search-domain bridge deps'ine `normalizeImageUrl` ve `isUsableImageUrl` eklendi.

## Guncel Not - 2026-04-20 V2.3 MF Parity Fix (Consistency Runner)

- Kullanici tarafinda eklenen `midstage/2.3/scripts/test-consistency-runner.js` ile `mf-parity` sapmasi dogrulandi:
  - qty=10 ve qty=11 icin V2.3/V2.2 ayrisiyordu.
- Kok neden:
  - `renderer/scripts/offer-domain.js` icindeki MF fallback hesaplamasi `mf.buy` semantigine kaymisti.
  - V2.2 `LegacyPricingEngine` ise `mf.total` (buy+free) esik/batch semantigini kullaniyor.
- Uygulanan fix (`offer-domain.js`):
  - MF aktiflik kosulu: `targetQty < mf.buy` -> `targetQty < mf.total`
  - batch hesabi: `Math.ceil(targetQty / mf.buy)` -> `Math.ceil(targetQty / mf.total)`
- Test sonucu:
  - `mf-parity`: PASS
  - `bulk-normalization`: PASS
  - `identity-grouping`: PASS
  - `all --json`: `ok=true`, `passed=17`, `failed=0`

## Guncel Not - 2026-04-20 V2.3 Detail Hero Rebalance (Compact Premium v2)

- Kullanici geri bildirimi sonrasi ilac detay ust karti bir tur daha daraltildi ve yeniden dengelendi.
- `renderer/styles/main.css` icinde detail hero override'lari ikinci kez optimize edildi:
  - `detail-wrapper` daha dar max-genislik ve daha az padding ile guncellendi.
  - `product-hero` karti daha kisa padding/gap, daha ince radius ve daha hafif shadow ile kompaktlastirildi.
  - Baslik buyuklugu/harf araligi sadeleştirildi (`text-transform: none`) ve daha okunur scan yapisi hedeflendi.
  - Sag fiyat-adet bolgesi mini panel formatina alindi (icerik kutusu + daha kucuk kontrol elemanlari).
  - Mobil/dar ekranlar icin responsive stack kurali eklendi (`@media (max-width: 1000px)`).
- Sonuc:
  - Hero alaninda gereksiz bosluk azaldi.
  - Ust kart daha premium ama daha az yer kaplayan bir bilgi paneli davranisina getirildi.

## Guncel Not - 2026-04-20 V2.3 Detail Hero Layout Balance (Premium v3)

- Kullanici geri bildirimi: kart daha premium olmali ama "AI slop" gorunmemeli; ayrica icerik sola yigilmamali.
- `renderer/styles/main.css` detail hero alaninda layout modeli guncellendi:
  - `product-hero` flex'ten `grid` duzenine alindi (`left content + right pricing panel`).
  - Responsive kirilimlar yeniden kalibre edildi:
    - 1100px altinda iki kolon korunup sag panel olceklendi.
    - 900px altinda tek kolona gecis yapilarak erken stack kaynakli sola yigilmalar azaltildi.
  - Stil dili daha rafine edildi:
    - daha dogal border/shadow,
    - sade arkaplan,
    - tipografi ve spacing dengesi.
- Sonuc:
  - Ust kartta bilgi hiyerarsisi netlesti (sol icerik, sag fiyat-aksiyon paneli).
  - Masaustu/genis ekranlarda "her sey solda" hissi giderildi.

## Guncel Not - 2026-04-20 V2.3 Detail Hero Content Rebalance (Premium v4)

- Yeni geri bildirim uzerine "degisim fark edilmiyor / her sey sola yigiliyor" problemi icin yalniz CSS degil markup da guncellendi.
- `renderer/scripts/detail-ui.js` hero info bolumune yeni `product-hero-metrics` grubu eklendi:
  - Depo
  - Net birim
  - Stok
- `renderer/styles/main.css` tarafinda:
  - `product-hero-info` flex yerine grid yapisina alindi (`media + copy + metrics`).
  - Yeni metrik kart siniflari eklendi (`hero-metric*`).
  - Responsive kirilimlarda metrics bloğu asagida dengeli dağılacak sekilde yeniden ayarlandi.
- Sonuc:
  - Hero alani sadece sol tarafta title/badge yiginina kalmiyor, orta bolumde de bilgi dagitimi saglaniyor.
  - Premium ama yapay gorunmeyen, daha kurumsal ve dengeli bir ust kart elde edildi.

## Guncel Not - 2026-04-21 V2.3 MF hesaplayici adet chip'leri (v2.2 birebir)

- `midstage/2.2/renderer/scripts/app.js` `buildMfChips` / `renderWorkspaceMfCalc` mantigi `detail-ui.js` icine tasindi (`buildMfQtyChips`).
- Her depo satirindaki MF icin `mult=1..5`, `qty = mf.total * mult`, `buy = mf.buy * mult`, uniq + sort + en fazla 10 oneri.
- "en uygun" etiketi: her aday `qty` icin tum `items` uzerinde `calculatePlanning(item, qty).effectiveUnit` minimumu; v2.2 `calcMfOptions(items, qty)[0].effectiveUnit` ile ayni fikir.
- Secili adet chip'i `active` sinifi; parse/calculate yoksa eski sabit `[1,3,5,10,20]` fallback.
- `app-v23.js` detail UI deps'e `parseMf` eklendi.

## Guncel Not - 2026-04-21 V2.3 Detail sol sidebar (teklif + plan ozeti) sadelestirme

- `renderer/scripts/detail-ui.js` search-detail sol panel inline stillerden cikarildi; `v23-detail-sidebar*`, `v23-offer-sheet*`, `v23-plan-snippet*` siniflari ile yeniden kuruldu.
- "Net birim maliyet" satiri sagda bos gorunen ikinci satir olarak kaldirildi; yerine birim fiyat altinda tek satir `hint` (MF / depo net aciklamasi).
- Plan kartlari: kucuk thumb (`imageUrl`/`imgUrl` + normalize), isimler `formatPlanLineTitle` ile TR kelime bazli yumusatildi; meta satirinda depo + adet hiyerarsisi netlestirildi.
- Stiller: `renderer/styles/detail-hero.css` altina sol serit bloklari eklendi.

## Guncel Not - 2026-04-21 V2.3 Detail hero stylesheet baglanti

- `renderer/styles/detail-hero.css` (`.v23-detail-hero*`) daha once `mock.html` / `index.html` icine linklenmemisti; dinamik detay karti buyuk olcude stillenmiyordu.
- Fix: `mock.html` ve `index.html` head'e `./styles/detail-hero.css` eklendi (mock'ta `mock.css` sonrasi).
- `detail-hero.css`: kart gölgesi/head flex, gorsel 64px, KPI metin clamp, fiyat blogu `price-stack` ile saga hizali.
- `detail-ui.js`: fiyat etiketi + tutar `v23-detail-hero__price-stack` icinde.
- `app-v23.js`: detail UI yok fallback wrapper `v23-detail-wrapper` ile hizalandi.

## Guncel Not - 2026-04-21 V2.3 Ilac Gorseli (current-modular parity + kok bug)

- Referans: `midstage/current-modular/renderer/scripts/app.js` (`normalizeImageUrl` + `imgCandidates` / `resolveItemImage`) ve `renderer/src/domain/DrugEntity._resolveImage`.
- Kok bug: `search-domain.js` `normalizeDepotItem` icinde `...searchItem` (`DrugOperationEntity.toSearchItem`) yayimi, `normalizedBase.imageUrl` (normalize + depotUrl ile mutlak URL) uzerine **ham goreli** `DrugEntity.imageUrl` yaziyordu; `<img src>` uygulama origin'ine gore cozulup kiriliyordu veya bos gorunuyordu.
  - Fix: merge sonrasi `imageUrl` / `imgUrl` tekrar `normalizeImageUrl(..., depotUrl)` ile netlestirildi ve cozunur URL onceliklendirildi.
- `renderer/scripts/utils.js` `normalizeImageUrl`: Nevzat `/Resim` yolu icin `https://www.nevzatecza.com.tr` prefix (depo entity disinda da tutarli).
- `renderer/src/domain/DrugEntity.js`: ham gorunum alanlari genisletildi (`PicturePath` / `picturePath` dahil).
- `renderer/scripts/detail-ui.js`: `pickDetailHeroImage` — secili + tum tekliflerden gecerli URL, depo onceligi (`current-modular` `renderDetailResults` ile ayni liste); `app-v23.js` detail render deps'e `normalizeImageUrl` / `isUsableImageUrl` eklendi.

