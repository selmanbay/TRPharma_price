# AI_CHANGELOG - Makine Okunabilir Degisiklik Gunlugu

Bu dosya son degisikliklerin kisa ama teknik kaydidir. Yeni agent once en ustteki blo�u okumali.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-19T15:05:00
**SESSION:** Security hardening phase 1 + local account-store simulation
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/2.2/src/account-store.js` | [NEW] kullaniciya bagli local JSON hesap/depo store'u eklendi
- `midstage/2.2/src/auth.js` | legacy auth icin `userId` migration, setup/login sirasinda account aktivasyonu
- `midstage/2.2/src/auth-middleware.js` | token payload'dan `userId` req.user'a tasindi
- `midstage/2.2/src/server.js` | auth rate limit, `127.0.0.1` bind, user-scoped depot config, user-scoped history, startup account seeding
- `midstage/2.2/main.js` | `inject-depot-cookies` hostname allowlist'i korunup `open-url-in-chrome` sadece `http/https` ile sinirlandi
- `midstage/2.2/preload.js` | `getDepotCookies` bridge'i kaldirildi
- `midstage/2.2/package.json` | build files icinden `data/**/*` ve `scripts/**/*` cikarildi
- `src/server.js` | auth rate limit + `127.0.0.1` bind eklendi
- `src/auth.js` | legacy auth icin `userId` migration ve token payload zenginlestirildi
- `src/auth-middleware.js` | `userId` req.user'a eklendi
- `main.js` | `inject-depot-cookies` allowlist + `open-url-in-chrome` protokol kisiti
- `preload.js` | `getDepotCookies` bridge'i kaldirildi
- `renderer/scripts/app.js` | variant kartinda `originalName` escape edildi
- `midstage/2.2/renderer/scripts/app.js` | variant kartinda `originalName` escape edildi
- `package.json` | build icinden root `config.json` ve runtime data dosyalari cikarildi
- `.gitignore` | root ve `midstage/2.2` altindaki auth/history/local-account dosyalari ignore listesine eklendi

**[ADDED/REMOVED]**
- **ADDED:** `local-accounts.json` ile DB oncesi user-scoped depo credential simulasyonu
- **ADDED:** auth endpoint brute-force korumasi
- **ADDED:** localhost-only server bind
- **REMOVED:** preload uzerinden ham depot cookie okuma yuzeyi
- **REMOVED:** packaged app icine data/test helper dahil olmasi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Repo icindeki eski `config.json` ve `midstage/2.2/config.json` hala hassas veri iceriyor; build ve runtime akisinda kullanimi azaltildi ama secret rotation ayrica yapilmali.
2. `local-accounts.json` kullaniciya bagli depo baglantilarini simule eder; gercek DB tasariminda bunun karsiligi `Account -> DepotConnection` olacaktir.
3. `query token` fallback auth middleware'de halen duruyor; SSE yeniden aktif kullanilacaksa header tabanli baska bir auth stratejisine tasinmasi mantikli.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-19T14:05:00
**SESSION:** V2.2 rebased onto current-modular baseline + test interface reapplied
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/2.2/main.js` | `current-modular` tabani geri alindi; V2.2 icin ayri `userData` ve dev lock bypass yeniden eklendi
- `midstage/2.2/preload.js` | `current-modular` baseline ile hizalandi
- `midstage/2.2/src/**` | backend runtime `midstage/current-modular` tabanindan yeniden senkronlandi
- `midstage/2.2/renderer/**` | renderer runtime `midstage/current-modular` tabanindan yeniden senkronlandi
- `midstage/2.2/src/server.js` | `keep-alive` ve workspace parity korunarak `health` + test session/client-log endpoint'leri geri eklendi
- `midstage/2.2/renderer/scripts/app.js` | workspace/runtime coordinator tabani korunarak diagnostic relay hook tekrar eklendi
- `midstage/2.2/renderer/src/main.js` | `window.ModularAppAdapters` korunup `window.V22Modules` tekrar baglandi
- `midstage/2.2/package.json` | dependency metadata current-modular runtime beklentileriyle hizalandi
- `midstage/2.2/README.md` | V2.2'nin artik `current-modular` tabanli oldugu netlestirildi
- `midstage/2.2/V2_2_MODULAR_REFACTOR_PLAN.md` | durum ve baseline notlari guncellendi
- `README.md` | root proje ozetinde V2.2 baseline duzeltmesi not edildi
- `AI_CONTEXT.md` | kritik current-modular rebase notu eklendi
- `AI_AGENT_HANDOFF.md` | sonraki agent icin baseline uyarisi eklendi
- `AI_CHANGELOG.md` | bu kayit eklendi

**[ADDED/REMOVED]**
- **ADDED:** V2.2 icin dogru `current-modular` parity tabani
- **ADDED:** current-modular ustunde yeniden uygulanan test interface katmani
- **PRESERVED:** workspace/operasyonel gorunum ve `runtimeCoordinator`
- **REMOVED:** V2.2'nin eski/root runtime tabanina dayanmasi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. V2.2 extraction yaparken referans kaynak artik `midstage/current-modular` olmalidir; root/current baseline'a geri dusme.
2. `renderer/scripts/app.js` halen owner dosya; bu tur davranis tasimasi degil dogru baseline duzeltmesi + test katmani reapply yapildi.
3. Smoke test backend seviyesinde gecti; Electron GUI parity icin bir sonraki turda manuel/yarı otomatik UI smoke mantiklidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-19T12:40:00
**SESSION:** V2.2 test interface phase 1 implementation
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/2.2/src/server.js` | health endpoint ve test session/client-log endpoint'leri eklendi
- `midstage/2.2/renderer/scripts/app.js` | aktif test session algilanirsa diagnostic olaylari backend'e relay eden hook eklendi
- `midstage/2.2/package.json` | `test:health`, `test:backend`, `test:scenario` scriptleri eklendi
- `midstage/2.2/scripts/test-auth.js` | [NEW] test token helper
- `midstage/2.2/scripts/test-backend-cli.js` | [NEW] health/session/client-log/search/login/quote komutlari
- `midstage/2.2/scripts/test-scenario-runner.js` | [NEW] ilk scenario runner (`search-basic`)
- `midstage/2.2/README.md` | uygulanmis test arayuzu komutlari eklendi
- `midstage/2.2/TEST_INTERFACE_PLAN.md` | plan durumu `Faz 1 uygulandi` olarak guncellendi
- `AI_CONTEXT.md` | test interface faz 1 notlari eklendi
- `AI_AGENT_HANDOFF.md` | test interface implementation notlari eklendi
- `AI_CHANGELOG.md` | bu kayit eklendi

**[ADDED/REMOVED]**
- **ADDED:** backend health + test session + client-log API'leri
- **ADDED:** terminal backend CLI
- **ADDED:** renderer diagnostic relay hook
- **ADDED:** ilk scenario runner
- **PRESERVED:** mevcut diagnostics buffer ve settings developer paneli

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `client-log` relay auth sonrasinda aktif olur; login/setup oncesi olaylar henuz ayni zincirde toplanmiyor.
2. `search-basic` scenario su an backend odakli smoke'tur; tam Electron UI smoke sayilmaz.
3. Port 3000'de stale server olabilecegi icin testlerde izole port kullanmak daha guvenlidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-19T11:05:00
**SESSION:** V2.2 test interface planning for terminal backend smoke + frontend diagnostic relay
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/2.2/TEST_INTERFACE_PLAN.md` | [NEW] terminal backend CLI, frontend diagnostic relay, test session ve scenario runner plani yazildi
- `midstage/2.2/README.md` | V2.2 test etme arayuzu referansi eklendi
- `AI_CONTEXT.md` | V2.2 test arayuzu notu ve uygulanacak ilk sira eklendi
- `AI_AGENT_HANDOFF.md` | Sonraki agent icin test interface yonu ve mevcut temel noktalar eklendi
- `AI_CHANGELOG.md` | bu kayit eklendi

**[ADDED/REMOVED]**
- **ADDED:** `TEST_INTERFACE_PLAN.md`
- **ADDED:** backend terminal smoke + frontend client-log relay icin hedef mimari
- **ADDED:** `sessionId` bazli test oturumu kavrami
- **PRESERVED:** mevcut root scriptleri ve frontend diagnostics mekanizmasi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Test arayuzu backend smoke ile frontend log relay'i ayni session id altinda birlestirmeli; iki ayrik sistem gibi tasarlama.
2. V2.2 test CLI tasarlanirken exit code ve `--json` cikti ilk gunden dusunulmeli.
3. Frontend diagnostic relay yalnız test modunda backend'e akmali; normal runtime'da gürültü üretmemeli.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-19T10:35:00
**SESSION:** V2.2 working runtime baseline + first modular extraction slice
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/2.2/package.json` | [NEW] V2.2 icin ayri dev package; Electron CLI root `node_modules` uzerinden cagrilir
- `midstage/2.2/main.js` | V2.2 ayri `userData` alani ve dev single-instance davranisi eklendi
- `midstage/2.2/preload.js` | runtime baseline kopyasi
- `midstage/2.2/src/*` | calisan backend/runtime baseline kopyasi
- `midstage/2.2/src/server.js` | browser auto-open default kapatildi; standalone `spawn EPERM` bug'i kapandi
- `midstage/2.2/renderer/*` | calisan renderer baseline kopyasi
- `midstage/2.2/renderer/src/shared/storage/LocalJsonStore.js` | [NEW] local storage + plan/routine persistence extraction
- `midstage/2.2/renderer/src/shared/products/ProductIdentity.js` | [NEW] barcode/identity/dedupe/search identity extraction
- `midstage/2.2/renderer/src/state/PlanState.js` | [NEW] V2.2 plan state facade
- `midstage/2.2/renderer/src/main.js` | `window.V22Modules` publisher eklendi
- `midstage/2.2/renderer/scripts/app.js` | ilk delegasyonlar aktif edildi: storage + product identity helper'lari
- `midstage/2.2/README.md` | calistirma ve ilk extraction durumu eklendi
- `AI_CONTEXT.md` | V2.2 calisan baseline ve smoke check notlari eklendi
- `AI_AGENT_HANDOFF.md` | V2.2 runtime/deligasyon detaylari eklendi
- `AI_CHANGELOG.md` | bu kayit eklendi

**[ADDED/REMOVED]**
- **ADDED:** `midstage/2.2` altinda calisan runtime kopyasi
- **ADDED:** `window.V22Modules.storage/productIdentity/planState`
- **ADDED:** storage ve product identity icin ilk calisan modular bridge
- **REMOVED:** standalone server calistiginda zorunlu browser auto-open

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. V2.2 icinde `app.js` halen owner dosya; bu tur yalniz ilk helper dilimleri delegate edildi.
2. Sonraki extraction icin en mantikli alan search state/render veya pricing helper'laridir; ayni copy-first kural korunmali.
3. V2.2 `package.json` root `node_modules` bagimliligina dayanir; bu bilincli secimdir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-19T09:40:00
**SESSION:** V2.2 modular refactor planning + copy-first migration workspace
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/2.2/README.md` | [NEW] V2.2 workspace amaci, copy-first kural ve beklenen son durum yazildi
- `midstage/2.2/V2_2_MODULAR_REFACTOR_PLAN.md` | [NEW] tam modulerlik icin fazli migration plani, ownership kurali ve hedef klasor yapisi tanimlandi
- `midstage/2.2/MODULE_MIGRATION_MAP.md` | [NEW] `renderer/scripts/app.js`, `renderer/index.html` ve `renderer/src/main.js` kaynaklarinin V2.2 hedef modullerine haritasi yazildi
- `README.md` | V2.2 workspace ve plan belgeleri eklendi
- `AI_CONTEXT.md` | V2.2 plan workspace ve no-delete extraction kurali not edildi
- `AI_AGENT_HANDOFF.md` | Gelecek agent icin V2.2 migration protokolu ve okunacak belgeler eklendi
- `AI_CHANGELOG.md` | V2.2 plan kaydi eklendi
- `CODEX_STABILIZATION_PLAN.md` | stabilizasyon planina V2.2 modulerlik uygulama modeli notu eklendi

**[ADDED/REMOVED]**
- **ADDED:** `midstage/2.2` altinda canonical V2.2 plan dokumani
- **ADDED:** `copy-first migration` ve `ilk extraction turunda kaynaktan silme yok` kurali
- **ADDED:** `app.js` fonksiyon gruplari icin hedef modul haritasi
- **ADDED:** `current-modular` ile `V2.2` arasindaki farkin acik tanimi
- **PRESERVED:** mevcut legacy owner dosyalar; bu turda davranis tasimasi veya silme yapilmadi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. V2.2 extraction yaparken okudugun dosyaya yazma; yeni modul hedefi `midstage/2.2/**` olmalidir.
2. `renderer/scripts/app.js` ilk extraction turunda kucultulmeyecek; parity gorulmeden delete/cut adimi yapma.
3. `renderer/index.html` ve `renderer/src/main.js` bugun referans kaynaklardir; V2.2 owner dosyalari ayni path'te degil yeni workspace'te acilmalidir.

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-18T12:30:00
**SESSION:** Depot HTTP docs cleanup + account-based app preparation notes
**AGENT:** Codex

**[MODIFIED_FILES]**
- `depo_https/alliance/readme.txt` | Alliance login/search/detail/price alanlari insan okunur sekilde duzenlendi; ham bloklar korundu
- `depo_https/anadoluitriyat/readme_a.txt` | Anadolu Itriyat README aciklama katmani eklendi; curl/response korundu
- `depo_https/anadolupharma/readmeapharma.txt` | Karisik notlar temizlenip yalniz Anadolu Pharma odakli anlatim yazildi; ornek response korundu
- `depo_https/selcuk/readmeselcuk.txt` | Selcuk login/search/detail/live price alanlari acik dille duzenlendi
- `depo_https/sentez/readme.txt` | HTML tablo parse mantigi ve login/fiyat kolonlari aciklandi; ham bloklar korundu
- `AI_CONTEXT.md` | Account-based gecis hazirligi, veri modeli endisesi ve perakende fiyat arastirma durumu not edildi
- `AI_AGENT_HANDOFF.md` | Account-based yonelim, depo_http klasoru amaci ve onerilen entity ayrimi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `depo_https/` README'lerinde "ne ise yarar", "genel akis", "kisa yorum" katmanlari
- **PRESERVED:** ham login/curl/response bloklari
- **ADDED:** account-based migration icin ilk kavramsal ayrim notu (`DepotConnection` vs `DepotSession`)
- **ADDED:** fiyat turlerinin ileride normalize edilmesi gerektigine dair hafiza notu

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. README duzenlemeleri dokumantasyon amaclidir; ham HTTP ornekleri silinmemeli, cunku yeni backend/entity tasariminda referans olacaklar.
2. Account-based migration tek turda buyuk rewrite seklinde yapilmamali; mevcut config tabanli sistemden kademeli gecis gerekecek.
3. Fiyat modeli tasarlanirken perakende/depo/net/canli fiyat alanlari tek kolona zorlanmamali; depo bazli semantik farklar var.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-17T21:10:00
**SESSION:** Workspace order plan dense list view
**AGENT:** Claude

**[MODIFIED_FILES]**
- `midstage/current-modular/renderer/src/features/plan/WorkspacePlanView.js` | [NEW] Workspace modu icin yogun liste render modulu; urun grubu + en ucuz depo rozeti + delta fark + accordion
- `midstage/current-modular/renderer/src/main.js` | `window.ModularAppAdapters.plan = workspacePlanView` kaydi eklendi
- `midstage/current-modular/renderer/scripts/app.js` | `renderOrderPlanDetail()` workspace branch'i adapter delegation akisina alindi; adapter yoksa eski render'a fallback
- `midstage/current-modular/renderer/styles/main.css` | `.ws-plan-*` stil bloku eklendi (toolbar, grup, depo row, stepper, marker, responsive breakpoint)
- `midstage/current-modular/docs/modules/order-plan.md` | Workspace view adapter notu eklendi
- `AI_CONTEXT.md` | 2026-04-17 Workspace Plan Yogun Liste notu eklendi
- `AI_AGENT_HANDOFF.md` | Dense list handoff + regresyon noktalari yazildi

**[ADDED/REMOVED]**
- **ADDED:** `renderer/src/features/plan/WorkspacePlanView.js` (`renderWorkspacePlanDetail(container, ctx)`)
- **ADDED:** `window.ModularAppAdapters.plan` adapter kaydi
- **ADDED:** `ws-plan-*` CSS namespace (sadece `body[data-ui-mode="workspace"]` altinda aktif)
- **ADDED:** Urun basligi seviyesinde accordion; cok depolu urunlerde en ucuz rozeti + `+delta` fark bilgisi
- **PRESERVED:** Klasik mod plan detay ekrani aynen; `workspace-plan-*` legacy render adapter yoksa fallback olarak korundu
- **PRESERVED:** Data-attribute event kontrati (`data-plan-editor-open`, `data-plan-card-minus/plus/depot/remove`) degismedi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Adapter olarak yayinlaniyor; bozulursa workspace branch'i eski `workspace-plan-*` render'ina dusmeli, beyaz ekran olmamali.
2. Klasik mod (`isWorkspaceMode()` false) bu commit'te degismedi; regresyon denetimi klasik siparis plani gorunumunde de yapilmali.
3. Event binding hala app.js icindeki `bindOrderPlanEntryEvents()`; modul yalnizca HTML + accordion toggle uretir, baska handler eklemeyin.
4. Yeni CSS sinifi eklerken `ws-plan-*` prefix'i korunmali ve stil yalniz workspace dataset'inde gecerli olmali.

---

### @ARCHIVED_CHANGE
**TIMESTAMP:** 2026-04-16T19:35:00
**SESSION:** History payload normalization fix
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/current-modular/renderer/scripts/app.js` | `fetchHistory()` endpoint cevabini normalize edecek sekilde guncellendi (`[]`, `{history:[]}`, `{items:[]}` desteklenir)

**[ADDED/REMOVED]**
- **ADDED:** history payload shape guard
- **REMOVED:** dizi-disindakini dogrudan liste gibi kullanma varsayimi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. History endpoint cevabi farkli shape donerse UI tarafi daima `Array` ile calismalidir.
2. `buildHistoryInsights()` ve history tablolari icin normalize edilmis dizi disinda veri gecirmeyin.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-16T03:05:00
**SESSION:** MF calculator consistency fix + README startup update
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/current-modular/renderer/scripts/app.js` | Search MF Hesaplayici fallback/live akisi planner zinciriyle hizalandi (`getFallbackPlannerOptions` + `resolvePlannerOptions`); satir detay metni `getPlannerOptionDetailText` uzerinden tekillestirildi
- `README.md` | current-modular electron baslatma ve kontrol komutlari eklendi; MF hesaplama davranisi notu eklendi
- `AI_CONTEXT.md` | MF Hesaplayici tutarlilik fix notu eklendi

**[ADDED/REMOVED]**
- **REMOVED:** stock calc icinde direkt `calcMfOptions` + `resolveQuotedOptions` bagimliligi
- **ADDED:** planner-level hesaplama zinciriyle tutarli stock calc davranisi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. MF hesap akisi degistirilirken qty=1 davranisinin birim fiyat kalmasi korunmali.
2. Stock calc, workspace tablo ve bulk planner ayni helper ailesini kullanacak sekilde tutulmali.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-16T02:55:00
**SESSION:** Current-modular clone + mojibake pipeline + incremental modular adapters
**AGENT:** Codex

**[MODIFIED_FILES]**
- `midstage/current-modular/package.json` | `mojibake:check` ve `mojibake:fix` scriptleri eklendi
- `midstage/current-modular/scripts/check-mojibake.js` | Mojibake guard script eklendi
- `midstage/current-modular/scripts/fix-mojibake.js` | Mojibake fixer script eklendi
- `midstage/current-modular/renderer/index.html` | Runtime Turkce metin mojibake duzeltmeleri
- `midstage/current-modular/src/server.js` | Runtime yorum/alias metin duzeltmeleri
- `midstage/current-modular/src/depots/selcuk.js` | Asama yorum metinleri duzeltildi
- `midstage/current-modular/src/depots/nevzat.js` | Asama yorum metinleri duzeltildi
- `midstage/current-modular/renderer/scripts/app.js` | Shared/pricing/search/workspace/settings alanlari adapter delegasyonuna alindi
- `midstage/current-modular/renderer/src/main.js` | `window.ModularAppAdapters` bridge kaydi genisletildi
- `midstage/current-modular/renderer/src/shared/LegacySharedHelpers.js` | Shared helper extraction
- `midstage/current-modular/renderer/src/features/pricing/LegacyPricingEngine.js` | Pricing/planner extraction
- `midstage/current-modular/renderer/src/features/search/LegacySearchUtils.js` | Search helper extraction
- `midstage/current-modular/renderer/src/features/workspace/WorkspaceShell.js` | Workspace shell extraction
- `midstage/current-modular/renderer/src/features/settings/SettingsTabs.js` | Settings tabs extraction
- `midstage/current-modular/docs/modules/*` | Modul tanitim dokumantasyonu eklendi
- `AI_CONTEXT.md` | Current-modular refactor + electron baslatma notu eklendi
- `AI_AGENT_HANDOFF.md` | Current-modular handoff + electron calistirma adimlari eklendi

**[ADDED/REMOVED]**
- **ADDED:** `window.ModularAppAdapters.shared/pricing/search/workspace/settings`
- **ADDED:** `docs/modules/MODULE_INDEX.md` ve modul bazli md dosyalari
- **ADDED:** Mojibake guard/fix pipeline
- **PRESERVED:** Legacy global entry points (`showPage`, `homeSearch`, `doSearch`)

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `renderer/scripts/app.js` halen ana feature owner; adapter delegasyonu sadece secili bolumlerde aktif.
2. Yeni module extraction sonrasi regression testi icin `npm run mojibake:check` ve `npm run release:check` standart kalmali.
3. Aktif calisma hedefi bu tur icin `midstage/current-modular`; root markdown hafizasi korunuyor.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T17:20:00
**SESSION:** Order plan inline editor � click card to open edit actions
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Aktif plan detay kartlarina tiklayinca acilan inline edit katmani eklendi; qty +/- ve explicit aksiyon butonlari bu katmanda gosteriliyor
- `renderer/styles/main.css` | `plan-detail-inline*` ve `plan-detail-item-editable` stilleri eklendi
- `AI_CONTEXT.md` | Aktif plan kart click davranisi guncellendi
- `AI_AGENT_HANDOFF.md` | Inline edit katmani ve qty duzenleme davranisi not edildi

**[ADDED/REMOVED]**
- **ADDED:** `activePlanDetailEditorKey`
- **ADDED:** `updateOrderPlanItemQuantity()`
- **ADDED:** plan detail inline edit paneli

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Aktif plan detay ekraninda kart govdesi artik urun acmaz; inline edit panelini toggle eder.
2. Qty degisimi su an kayitli `effectiveUnit` uzerinden toplami yeniden hesaplar; ileride live requote istenirse bu helper degistirilmelidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T17:10:00
**SESSION:** Order plan detail UX � card body no longer opens product
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Plan detay kartlarindaki govde click/keyboard ile urun acma davranisi kaldirildi; yalnizca explicit aksiyon butonlari aktif
- `renderer/styles/main.css` | `plan-detail-card-clickable` stilleri kaldirildi
- `AI_CONTEXT.md` | Plan detay kart govdesinin pasif oldugu not edildi
- `AI_AGENT_HANDOFF.md` | Plan detay ekraninda yalnizca butonlarla aksiyon alinmasi gerektigi not edildi

**[ADDED/REMOVED]**
- **REMOVED:** `data-plan-detail-card` click/keydown open behavior
- **REMOVED:** `plan-detail-card-clickable` hover/focus stilleri

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Plan detay ekraninda kart govdesine tiklamak artik asla urun acmamalidir; sadece `Urunu Ac` butonu bu isi yapar.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T17:05:00
**SESSION:** Order plan detail hotfix � render hardened against malformed plan entries
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | `renderOrderPlanDetail()` try/catch ile guclendirildi; plan verisi render oncesi tekrar normalize ediliyor ve bozuk kayitlar sayfayi patlatmiyor
- `AI_CONTEXT.md` | Plan detay sayfasi icin g�venli render notu eklendi
- `AI_AGENT_HANDOFF.md` | Plan detay sayfasi blank-screen hotfix not edildi

**[ADDED/REMOVED]**
- **ADDED:** `renderOrderPlanDetail()` icinde defensive normalize + fallback error card
- **ADDED:** `order-plan-error` diagnostics eventi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `Plani Incele` akisi tekrar bos ekran verirse ilk bakilacak yer `renderOrderPlanDetail()` icindeki normalize/render zinciri ve diagnostics `order-plan-error` kaydidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:55:00
**SESSION:** Order plan card parity � MF detail mirrored to home plan card
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Ana sayfadaki kisa plan kartina da detay ekranindakiyle uyumlu MF/planlama satiri eklendi
- `renderer/styles/main.css` | Yeni `plan-item-detail` stili eklendi
- `AI_CONTEXT.md` | Plan ozet karti ve detay karti arasindaki bilgi parity not edildi
- `AI_AGENT_HANDOFF.md` | Ana sayfa plan kartinda MF satirinin da beklendigi not edildi

**[ADDED/REMOVED]**
- **ADDED:** Home plan card icinde `plan-item-detail`
- **ADDED:** MF varsa `MF <mfStr>`, yoksa `Normal alim` metni

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Plan detay ekrani ve ana sayfa plan karti artik ayni bilgi parity'sini korumali; biri degisirse digeri de guncellenmeli.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:45:00
**SESSION:** Search depot hotfix � Selcuk/Nevzat re-login fallback restored
**AGENT:** Codex

**[MODIFIED_FILES]**
- `src/depots/selcuk.js` | Arama istegi timeout veya bozuk cookie nedeniyle dusunce cookie temizle + login yenile + tek sefer retry davranisi geri eklendi; search timeout 10s oldu
- `src/depots/nevzat.js` | Arama istegi redirect loop veya bozuk cookie nedeniyle dusunce cookie temizle + login yenile + tek sefer retry davranisi geri eklendi; search mantigi `_requestSearch()` yardimcisine toplandi
- `AI_CONTEXT.md` | Selcuk/Nevzat arama hatasinin kok nedeni ve cozum not edildi
- `AI_AGENT_HANDOFF.md` | Ayn� hotfix ve dogrulama sonucu eklendi

**[ADDED/REMOVED]**
- **ADDED:** `SelcukDepot._requestSearch()` icinde catch-level re-login retry
- **ADDED:** `NevzatDepot._requestSearch()` merkezi search helper'i
- **REMOVED:** Nevzat tarafinda stale cookie kaldiginda sessiz redirect loop'ta kalma davranisi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Selcuk ve Nevzat tekrar sonuc vermiyorsa ilk bakilacak yer stale cookie / timeout / redirect loop'tur; name-alias hotfix tek basina yeterli degildir.
2. Bu iki depoda `search()` artik login bozulursa bir kez otomatik yeniler; bu davranisi kaldirmayin.
3. Canli dogrulama: `8683060010220 -> Selcuk fiyat 600,00`, `8699522705009 -> Nevzat fiyat 138,78`.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:20:00
**SESSION:** Bulk inline panel � open state hardened
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Bulk inline panel icin `inlineOpen` state eklendi; panel acma davranisi artik state-temelli ve render-on-open olacak sekilde guclendirildi
- `AI_CONTEXT.md` | Bulk inline panel state davranisi not edildi
- `AI_AGENT_HANDOFF.md` | Inline panel debug noktasi ve `inlineOpen` state bilgisi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `state.inlineOpen`
- **ADDED:** `openInlinePanel()` icinde zorunlu `renderInlinePanel()` cagrisi
- **ADDED:** panel render sonunda `panel.hidden = false`

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Bulk inline panel artik sadece DOM class'i ile degil `state.inlineOpen` ile kontrol edilir.
2. Inline panel acilmama bug'i tekrar olursa ilk bakilacak yer `renderBulkResultCard()` icindeki `openInlinePanel / renderInlinePanel / state.inlineOpen` zinciridir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:10:00
**SESSION:** Search depot hotfix � Selcuk/Nevzat instance resolution repaired
**AGENT:** Codex

**[MODIFIED_FILES]**
- `src/server.js` | `/api/search-depot` icinde depot instance secimi alias tabanli hale getirildi; Selcuk/Nevzat ve encoding varyantlari icin eslesme guclendirildi
- `AI_CONTEXT.md` | search-depot alias hotfix not edildi
- `AI_AGENT_HANDOFF.md` | Selcuk/Nevzat instance resolution bug'i ve kontrol noktasi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `aliasesByDepot` hotfix blo�u � `search-depot` route icinde dogrudan depot ad varyantlarini tanir

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `search-depot` hattinda depot instance secimi name-eslesmesine baglidir; encoding farklari Selcuk/Nevzat gibi depolari sessizce dusurebilir.
2. `src/server.js` icindeki `aliasesByDepot` hotfix blo�u kaldirilacaksa once tum depot adlari tek encoding formatina normalize edilmelidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:00:00
**SESSION:** Search rollback correction � doSearch aligned with legacy procedure
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | `doSearch()` fonksiyonu `_legacy/doSearch-v1.js` prosedurune tekrar hizalandi; loading/watchdog/inline-loading kaynakli ek yan davranislar search icinden cikarildi
- `AI_CONTEXT.md` | Legacy procedure'e geri donus not edildi
- `AI_AGENT_HANDOFF.md` | `doSearch()` icin referans kaynagin `_legacy/doSearch-v1.js` oldugu aciklandi

**[ADDED/REMOVED]**
- **REMOVED:** `doSearch()` icindeki watchdog cleanup ve parcali inline loading yan davranislari
- **REMOVED:** legacy prosedurden sapan search-finalize akisleri
- **RESTORED:** `_legacy/doSearch-v1.js` ile ayni finalize mantigi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Kullanici talebiyle `doSearch()` artik legacy prosedure gore birebir davranmalidir; search'te yeni deneysel katman eklemeyin.
2. Search ile ilgili degisiklik yapilacaksa ilk referans `_legacy/doSearch-v1.js` olmalidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T15:50:00
**SESSION:** Search hotfix � restored missing active depot bootstrap in doSearch
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Search rollback sonrasi eksik kalan `loadDepotStatus() / cachedConfig / activeDepots` bootstrap blogu geri eklendi; aktif depo listesi olmadan aramanin baslayip loading'de takilma bug'i kapatildi
- `AI_CONTEXT.md` | Search bootstrap hatasi ve cozum not edildi
- `AI_AGENT_HANDOFF.md` | doSearch icinde aktif depo hazirlama blogunun kritik oldugu not edildi

**[ADDED/REMOVED]**
- **ADDED:** rollback sonrasi geri konan active depot hazirlama adimi
- **REMOVED:** aktif depo listesi olusmadan aramaya devam etme durumu

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `doSearch()` icindeki `cachedConfig` / `activeDepots` blogu kaldirilirsa search loading'de takilabilir veya sessizce bos donebilir.
2. Search rollback yaparken legacy kod parcalarinin tumu birlikte alinmalidir; parca parca kopyalama regresyon uretir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T15:40:00
**SESSION:** Search rollback � reverted to depot-based parallel search
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | `doSearch()` SSE/SearchEngine akisi kaldirildi; eski guvenilir paralel `/api/search-depot` akisi geri alindi; sonuc kartlari gorunurken `otherDepots` altinda inline loading gosterimi eklendi
- `renderer/index.html` | `searchInlineLoading` alani eklendi
- `renderer/styles/main.css` | kucuk spinner ve inline teklif loading stilleri eklendi
- `src/server.js` | `getConfiguredDepotById()` alias mantigi eklendi; encoding kaynakli depot-name eslesme sorunlari tolere edilir
- `src/search-engine.js` | provider `result.error` degeri artik `onError` callback'ine aktarilir
- `AI_CONTEXT.md` | search rollback ve teklif-alti loading davranisi not edildi
- `AI_AGENT_HANDOFF.md` | search-smart'in su an aktif yol olmadigi ve doSearch'in tekrar `search-depot` kullandigi not edildi

**[ADDED/REMOVED]**
- **REMOVED:** normal search icin aktif `EventSource('/api/search-smart')` baglantisi
- **REMOVED:** search-smart bos sonucunda bulk fallback ihtiyaci
- **ADDED:** normal search sonuc tablosu alti loading gostergesi
- **ADDED:** eski paralel search lifecycle + watchdog

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Kullanici istegiyle normal arama eski metoda geri alindi; search-smart halen server'da kalsa da UI tarafinda aktif yol degildir.
2. Kampanya/MF sorunlari tekrar olursa ilk bakilacak yer `doSearch()` icindeki `/api/search-depot` parallel akisi olmalidir.
3. `searchInlineLoading` sadece sonuc kartlari gorunurken acik kalir; arama bitince kapanmalidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T15:20:00
**SESSION:** Search Recovery � legacy depot fallback + inline offer loading
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Search bos donerse `searchOneBulkQuery()` ile ikinci asama fallback eklendi; teklif tablosu gorunur haldeyken kucuk inline loading gostergesi eklendi; search lifecycle boyunca inline loading kontrolu merkezilestirildi
- `renderer/index.html` | `otherDepots` altina `searchInlineLoading` alani eklendi
- `renderer/styles/main.css` | inline search loading ve kucuk spinner stilleri eklendi
- `src/search-engine.js` | provider `{ error, results: [] }` donerse artik `onError` callback'i tetiklenir; sessiz hata nedeniyle yanlis `bulunamadi` durumu azaltildi
- `src/server.js` | `getConfiguredDepotById()` alias mantigi ile encoding kaynakli depo ad eslesme sorunlarini tolere eder
- `AI_CONTEXT.md` | search fallback ve teklif alti loading davranisi not edildi
- `AI_AGENT_HANDOFF.md` | search-smart -> search-depot fallback zinciri ve debug noktasi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `setSearchInlineLoading(visible, text)`
- **ADDED:** `attemptLegacySearchFallback(query, searchId)`
- **ADDED:** search sonucu gorunurken ikinci kademe depo cevaplari icin tablo alti loading
- **ADDED:** provider result.error -> onError propagation

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Search bos donse bile artik hemen `bulunamadi` denmez; ikinci kademe `/api/search-depot` fallback denenir.
2. `searchInlineLoading` yalniz sonuc gorunur haldeyken acik kalmalidir; tam ekran spinner ile ayni anda uzun sure gorunmemelidir.
3. `getConfiguredDepotById()` icindeki alias mantigi, encoding bozuk adlar yuzunden depot instance bulunamamasi riskini azaltir; kaldirmadan once tum isimler normalize edilmelidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T15:00:00
**SESSION:** Search UX � loading overlay no longer blocks partial results
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Search SSE akisina watchdog timer eklendi; `done` hic gelmese bile loading state sonsuza kadar acik kalmaz; ilk sonuc geldiginde tam ekran loading kapatilir ve mevcut sonuc kullaniciya birakilir
- `AI_CONTEXT.md` | Search loading/timeout davranisi not edildi
- `AI_AGENT_HANDOFF.md` | Watchdog mantigi ve spinner regression kontrol noktasi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `pendingSearchWatchdogTimer`
- **ADDED:** `SEARCH_WATCHDOG_MS = 8000`
- **ADDED:** partial-result timeout davranisi � ilk sonuc geldiyse spinner kapanir, gec kalan depolar kullaniciyi bloklamaz
- **REMOVED:** ilk sonuc geldikten sonra uzun sure tam ekran loading gostermeye devam etme davranisi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Search SSE `done` hic gelmeyebilir; watchdog korumasi bu yuzden kritik.
2. Ilk gecerli sonuc geldikten sonra loading tekrar tam ekran acilmamali.
3. Timeout durumunda elde sonuc varsa error state'e dusulmez; mevcut sonuc korunur.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T14:40:00
**SESSION:** Bulk Planner UX � clickable card opens inline management layer
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Bulk search sonuc kartlarina inline plan yonetim katmani eklendi; buton/input disindaki kart alani tiklaninca secili teklif icin detay paneli acilir; satir secimi, miktar degisimi ve plan ekleme ayni state uzerinden senkron kalir
- `renderer/styles/main.css` | Bulk inline panel, kart expanded state ve responsive stiller eklendi
- `AI_CONTEXT.md` | Bulk kart davranisi ve inline panel semantigi not edildi
- `AI_AGENT_HANDOFF.md` | Bulk kartin yeni tiklanabilir alan kurallari ve korunmasi gereken event davranisi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `closeExpandedBulkCards(exceptCard)` helper
- **ADDED:** bulk kart icinde `bulk-inline-panel`
- **ADDED:** secili offer icin `Urunu Ac`, `Depoya Git`, `Kapat` aksiyonlari
- **ADDED:** kart geneli tiklama ile inline panel acma davranisi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Bulk kartta satir secimi ile panel acilmasi ayni anda calisir; row click davranisi kaldirilirsa secili depo senkronu bozulur.
2. `button`, `input` ve panel ic aksiyonlari kart geneli click handler'ina bubble etmemelidir.
3. Bulk panel ayrik state degil, mevcut `state.options / state.selectedKey / state.qty` ile beslenir; ikinci bir pricing state eklemeyin.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T14:20:00
**SESSION:** Autocomplete Reliability � lightweight Selcuk suggestion path
**AGENT:** Codex

**[MODIFIED_FILES]**
- `src/depots/selcuk.js` | Selcuk autocomplete icin fiyat/MF istemeyen hafif `autocompleteSearch()` yolu eklendi; agir `search()` akisindan ayrildi; `GetUrunler` istegi `_requestSearch()` yardimcisi altinda merkezilestirildi
- `src/server.js` | `/api/autocomplete` artik depot bazli `autocompleteSearch()` destekliyorsa onu kullanir; Selcuk fast-path suggestion ekraninda gereksiz MF/fiyat zincirine girmez
- `AI_CONTEXT.md` | Search/autocomplete ayrimi ve Selcuk suggestion fast-path not edildi
- `AI_AGENT_HANDOFF.md` | Autocomplete regression kokeni ve korunmasi gereken yeni hafif yol eklendi

**[ADDED/REMOVED]**
- **ADDED:** `SelcukDepot.autocompleteSearch(query)`
- **ADDED:** `SelcukDepot._searchProducts(query)`
- **ADDED:** `SelcukDepot._requestSearch(query, allowRelogin)`
- **REMOVED:** autocomplete sirasinda `Selcuk.search()` uzerinden gereksiz fiyat/MF cagrisi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Suggestion ekraninda Selcuk icin agir `search()` akisini tekrar kullanmak performans ve reliability regression'idir.
2. Autocomplete suggestion'lari fiyat karari icin degil, hizli urun bulma icindir; bu katmanda MF hesaplamasi yapilmaz.
3. Normal search fiyati ile autocomplete sonucu bilincli olarak ayridir; autocomplete sadece hizli isim/barkod listesi dondurur.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T13:45:00
**SESSION:** Search Stability � SSE false-error fix + resilient retry state
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | SSE tabanli `doSearch()` akisi debug edildi; stream normal kapanirken `EventSource.onerror` ile yanlis hata karti acma bug'i kapatildi; yeni aramada mevcut sonuclarin gereksiz erken gizlenmesi kaldirildi; `resetSearchDetailState()` ile arama state reseti merkezilestirildi; partial-result durumunda stream kopsa bile UI success'te tutuluyor
- `renderer/index.html` | Search hata karti ve arama ekrani gorunur metinleri temizlendi; mojibake search kopyalari duzeltildi
- `AI_CONTEXT.md` | Search SSE akisinin yeni garanti davranisi ve false-error riski not edildi
- `AI_AGENT_HANDOFF.md` | Search debug bulgulari ve sonraki agent icin SSE kapanis semantigi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `streamCompleted` guard � `done` sonrasi gelen SSE close olayi hata sayilmaz
- **ADDED:** partial-result guard � stream kopsa bile elde sonuc varsa hata karti acilmaz
- **REMOVED:** search baslangicinda sonuclarin kosulsuz gizlenmesi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Search artik SSE (`/api/search-smart`) kullaniyor; `EventSource.onerror` normal stream kapanisinda da tetiklenebilir.
2. `done` event'i geldikten sonra acilan hata karti bug kabul edilir; `streamCompleted` guard'i korunmali.
3. Search UI yeni aramada eski sonucu gecici korur; tekrar beyaz ekran olursa ilk bakilacak yer `evtSource.onerror` ve `showSearchErrorState` akisidir.
4. Bulk search hala `/api/search-depot` uzerinden ayrik calisir; search ekrani ile karistirilmamali.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T14:00:00
**SESSION:** Autocomplete Performance � lower debounce + Selcuk-first fast path
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Autocomplete debounce 300ms -> 120ms cekildi; loading gostergesi gecikmeli hale getirildi; suggestion cache eklendi; gorunen autocomplete metinleri duzeltildi
- `src/server.js` | `/api/autocomplete` artik once Selcuk uzerinden hizli yol dener, Selcuk sonuc vermezse tum depolara fallback yapar
- `AI_CONTEXT.md` | Autocomplete hizlandirma kurallari not edildi
- `AI_AGENT_HANDOFF.md` | Yeni autocomplete akisinin performans ve fallback mantigi eklendi

**[ADDED/REMOVED]**
- **ADDED:** query-bazli kucuk suggestion cache
- **ADDED:** gecikmeli loading skeleton (yalniz gercekten gecikirse gorunur)
- **REMOVED:** her tus vurusunda gereksiz 300ms bekleme
- **REMOVED:** her autocomplete isteginde tum depolari kosulsuz tarama

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Autocomplete performansi icin Selcuk-first fast path korunmali.
2. Selcuk sonuc vermezse fallback yine tum depolar olmalidir; aksi halde suggestion coverage duser.
3. UI tarafinda loading metni hemen gosterilmez; ancak istek 120ms ustu surerse gorunur.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T13:30:00
**SESSION:** Search Engine � Provider Registry Mimarisi
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `src/search-engine.js` [NEW] | SearchEngine sinifi � her depo bir provider olarak kayit olur, tum aktif providerlar paralel sorgulanir, sonuclar callback ile stream edilir.
- `src/server.js` | SearchEngine import + initDepots'a provider registration eklendi + `/api/search-smart` SSE endpoint eklendi
- `src/auth-middleware.js` | requireAuth: SSE icin query param token fallback eklendi (EventSource header gonderemez)
- `renderer/scripts/app.js` | doSearch() 6 ayri authFetch yerine tek SSE baglantisi kullaniyor. _activeEventSource ile race condition korunuyor.
- `_legacy/doSearch-v1.js` [NEW] | Eski doSearch yedegi � geri alma proseduru dahil
- `_legacy/server-search-v1.js` [NEW] | Eski /api/search-depot endpoint yedegi

**[ADDED/REMOVED]**
- **ADDED:** src/search-engine.js � Provider Registry pattern
- **ADDED:** /api/search-smart � SSE endpoint (server.js)
- **ADDED:** _legacy/ � s�r�m geri alma yedekleri
- **MODIFIED:** doSearch() � 6x authFetch � 1x EventSource
- **MODIFIED:** auth-middleware � query param token fallback
- **PRESERVED:** /api/search-depot � bulk search hala kullaniyor (degismedi)

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. SearchEngine provider fonksiyonlari depot.search(query) wrapperdir � adapter degisikligi gerekmez
2. SSE auth: EventSource custom header gonderemez, token query param olarak gider (?token=xxx)
3. _activeEventSource: Art arda arama yapildiginda onceki SSE baglantisi kapatilir (race condition)
4. /api/search-depot KORUNDU � bulk search (searchOneBulkQuery) bunu kullaniyor, silme
5. Geri alma: _legacy/ klasorundeki dosyalardaki proseduru takip et

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-03T10:44:00
**SESSION:** v2.1.2 - Stabilizasyon Faz 3 (Utils Modulu + Config Cache)
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `renderer/scripts/utils.js` | [YENi] Stateless saf utility fonksiyonlar buraya tasindu: parseMf, formatCurrency, extractBarcode, parseQRCode, isBarcodeQuery, normalizeDrugName, slugifyName, normalizeImageUrl, isUsableImageUrl, getImageFallbackSvg, dedupeStoredItems, runConcurrent
- `renderer/index.html` | utils.js auth.js'den once yukleniyor (line 551)
- `src/config-store.js` | _configCache in-memory cache eklendi; loadConfig() cagrisi disk yerine RAM'den okur; saveConfig() cache'i de gunceller; invalidateConfigCache() ile zorla yenileme

**[ADDED/REMOVED]**
- **ADDED:** renderer/scripts/utils.js (6.5KB, 14 pure utility fonksiyon)
- **ADDED:** _configCache in-memory cache (config-store.js)
- **ADDED:** invalidateConfigCache() export'u

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. utils.js'deki fonksiyonlar app.js'de HALa TANIMLIYKEN utils.js'e de eklendi - cift tanim var.
   Cozum: Faz 3 eksik kalan adim: app.js'den bu fonksiyonlari silmek gerekiyor.
   Simdiye kadar yapilmadi cunku cift tanim fonksiyonel bozukluk olusturmuyor (en son tanimlanan kazaniyor).
2. config cache invalidasyon: Electron restart olmaksizin harici config degisikligi cache'i atlatiyor.
   Cozum: initDepots sonrasinda invalidateConfigCache() cagrisi gerekebilir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-03T01:10:00
**SESSION:** v2.1.1 - Teklif Secimi UX + UTF-8 Temizligi + Canli MF Stabilizasyonu
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Arama sonucunda varsayilan secili plan teklifi yeniden en ucuz teklif olacak sekilde duzeltildi; depo satirina ayri `Plana Sec` butonu eklendi; satir tiklama ve buton tiklama ayni secimi koruyor; gorunen bozuk para birimi karakterleri `TL` tabanli gosterime cekildi; MF sonucu once fallback sonra canli fiyat ile yeniden ciziliyor
- `renderer/styles/main.css` | `btn-plan-select`, `depot-actions` ve `sc-live-badge` stilleri eklendi; sahte `Click ile plana ekle` pseudo metni kaldirildi
- `src/server.js` | `POST /api/quote-option` endpoint'i ile quantity bazli canli fiyat sorgusu acildi
- `src/depots/selcuk.js` | `quoteOption()` ile miktar bazli fiyat hesaplama acildi
- `src/depots/nevzat.js` | `quoteOption()` ile miktar bazli fiyat hesaplama acildi
- `src/depots/alliance.js` | `quoteOption()` ve `calculatePrice()` zinciri eklendi; canli fiyat icin gereken ham alanlar artik saklaniyor
- `AI_CONTEXT.md` | Quantity bazli canli fiyat, Chrome zorunlulugu ve secili depo davranisi not edildi
- `AI_AGENT_HANDOFF.md` | Sonraki agent icin guncel riskler ve dogru devam noktasi yazildi

**[ADDED/REMOVED]**
- **ADDED:** Teklif tablosunda ayri `Plana Sec` butonu
- **ADDED:** Selcuk, Nevzat ve Alliance icin quantity bazli canli quote altyapisi
- **ADDED:** MF panelinde fallback-first, live-rerender akisi
- **REMOVED:** MF satirlarina CSS ile eklenen `Click ile plana ekle` metni
- **REMOVED:** Gorunen mojibake para birimi gosterimleri

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Electron icinde depo login kalici degil; `Depoya Git` davranisi Chrome tabanli kalmali.
2. Varsayilan plan secimi en ucuz tekliften gelir ama kullanici secimi `currentSelectedOfferKey` uzerinden korunur.
3. MF paneli canli fiyat alamazsa fallback liste gorunmeye devam etmeli; UI asla bos kalmamali.
4. Yeni gorunen UI metinlerini ASCII-safe tutmak daha guvenli; eski arsivlerde mojibake olabilir.

---

### @ARCHIVED_CHANGE_017
**TIMESTAMP:** 2026-04-03T00:45:00
**SESSION:** v2.1.1 - Chrome Tabanli Depo Gecisi Temizligi
**AGENT:** Codex

**[SUMMARY]**
- `Chrome Demo` karti kaldirildi.
- `Depoya Git` akisi tekrar kalici olarak Chrome tabanli hale getirildi.
- Alliance icin auto-post denemeleri temizlenip `QuickOrder` fallback'i birakildi.

---

### @ARCHIVED_CHANGE_016
**TIMESTAMP:** 2026-04-02T23:40:00
**SESSION:** v2.1.1 - Inline Siparis Miktari + MF Depo Tiklama
**AGENT:** Codex

**[SUMMARY]**
- Hizli islem paneline plan miktari kontrolu eklendi.
- MF sonuc satirlari tiklanabilir hale getirildi.
- `setSearchActionQty()` miktar alanlarini senkron tutan merkezi helper olarak kullanildi.
### @LATEST_CHANGE_2026_04_03_0128
**TIMESTAMP:** 2026-04-03T01:28:00
**SESSION:** v2.1.1 - Plan Akisi Stabilizasyonu + Bos Ekran Koruma + Turkce UI Temizligi
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Arama bos ekran bug'i icin gecikmeli rerender korumasi eklendi; config yukleme hatasi kontrollu ele alindi; eksik kalan `addPlannerOptionToOrderPlan` ve `removeOrderPlanItem` geri eklendi; plan ekleme akisi tekrar baglandi; plan kayitlari istenen adet mantigina normalize edildi; ana plan ve detay plan ekranlari `adet` tabanli gosterime cekildi; detay kartlari tiklanabilir yapildi; detay ekrana `Sil` butonu eklendi
- `renderer/scripts/auth.js` | Login ve setup overlay metinleri runtime tarafinda dogru Turkce metinlerle duzeltildi
- `renderer/styles/main.css` | Plan detay kartlari icin tiklanabilir hover/focus stilleri eklendi; plan detay aksiyonlari sarilabilir hale getirildi
- `AI_CONTEXT.md` | Son davranislar, riskler ve quantity mantigi not edildi
- `AI_AGENT_HANDOFF.md` | Sonraki agent icin guncel devam noktasi ve beklenen davranis yazildi

**[ADDED/REMOVED]**
- **ADDED:** Arama sonucunda minimum bekleme suresi sonrasi otomatik rerender fallback'i
- **ADDED:** Eksik kalan plan ekleme ve plan silme merkezi fonksiyonlari
- **ADDED:** Plan detay ekraninda tiklanabilir kart davranisi
- **ADDED:** Plan detay ekraninda `Sil` aksiyonu
- **REMOVED:** Plan ekranindaki kafa karistiran `hedef / teslim` gosterimi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Electron icinde depo login kalici degil; `Depoya Git` davranisi Chrome tabanli kalmali.
2. Siparis plani artik kampanya batch miktarini degil, kullanicinin istedigi adedi saklar ve gosterir.
3. `renderer/scripts/app.js` buyuk ve stateful; arama/render zincirindeki syntax hatalari tum ekrani bos gosterebilir.
4. Runtime Turkce metin duzeltmeleri var; static HTML icinde hala eski bozuk yazi kalintilari olabilir.

---

## 2026-04-05 - Active Plan Drawer
- Aktif siparis plani kart tiklamasi alt inline panel yerine sagdan acilan drawer olarak degistirildi.
- Drawer icinde depo secimi, miktar stepper, MF/canli quote ozeti ve plan guncelle akisi eklendi.
- Plan kalemi barkoduyla depolar yeniden toplanip mevcut pricing helper'lariyla resolve ediliyor.

- Active plan sag drawer tasarimi iyilestirildi; kart hiyerarsisi, sticky aksiyon alani ve depo secim listesi daha okunur hale getirildi.

- Aktif plan kartlarina hizli aksiyonlar geri eklendi: adet azalt/artir, depoya git ve sil kart uzerinde gorunur.


## 2026-04-05 - Modular Compatibility Bootstrap
- renderer/index.html icinde legacy scripts/app.js yeniden aktif edildi; core feature akisi tekrar legacy runtime uzerinden calisiyor.
- renderer/src/main.js compatibility mode olarak yeniden yazildi; legacy globals varsa override etmiyor, yoksa fallback window actions sagliyor.
- renderer/src/core/storage.js icindeki gecersiz export syntax temizlendi.

## 2026-04-05 - Backend Encoding Cleanup
- `src/server.js` icinde runtime depot isimleri temizlendi: `Sel�uk Ecza`, `Anadolu �triyat`.
- Depot instance bulma icin `normalizeDepotName()`, `getDepotAliases()` ve `findDepotInstance()` eklendi; bozuk alias kalintilari artik eslesmeyi bozmayacak.
- `src/depots/selcuk.js`, `src/depots/nevzat.js` ve `src/depots/alliance.js` icindeki login/runtime hata mesajlari ve form submit metinleri temizlendi.
- Amac yorumlari degil, davranisi etkileyen sabitleri duzeltmekti; backend log ve alias tabanli route eslesmeleri daha guvenli hale getirildi.

## 2026-04-05 - Midstage Workspace Layout
- Calisan kod tabani `D:\personal\eczane-app\midstage\current` altina kopyalandi.
- Kopyalanan aktif kod alanlari: `main.js`, `preload.js`, `package.json`, `package-lock.json`, `config.json`, `renderer/`, `src/`, `scripts/`, `data/`, `_legacy/`.
- Root klasorde `.md` hafiza ve plan dosyalari tutulmaya devam ediyor.
- Gelecek release/surum klasorleri icin `D:\personal\eczane-app\midstage\releases` hazirlandi.
- Bundan sonraki aktif gelistirme hedef yolu: `D:\personal\eczane-app\midstage\current`

## 2026-04-06 - Root Workspace Cleanup
- K�k dizin sadele�tirildi; eski release klas�rleri `D:\personal\eczane-app\midstage\releases\legacy` alt�na ta��nd�.
- Eski debug loglar� ve ge�ici video frame ��kt�lar� `_archive` alt�na ta��nd�:
  - `D:\personal\eczane-app\_archive\debug-logs`
  - `D:\personal\eczane-app\_archive\artifacts\video_debug_frames`
- Eski deneysel `front` alan� `D:\personal\eczane-app\_archive\experiments\front` alt�na ta��nd�.
- Root art�k daha �ok �u yap� ile kullan�l�yor:
  - haf�za / plan `.md` dosyalar�
  - aktif legacy-root kodu
  - yeni aktif geli�tirme kopyas� i�in `midstage/current`

## 2026-04-06 - Cift UI Modu Baslangici
- `midstage/current` icinde iki gorunum modu icin ilk katman eklendi:
  - `Klasik Arayuz`
  - `Workspace Modu`
- Profil menusu uzerinden mod secimi yapiliyor ve secim `localStorage` ile korunuyor.
- Workspace modu su an davranis degil, once layout katmani olarak eklendi:
  - daha genis navbar ve sayfa konteynerleri
  - home hero/arama alani daha operasyonel hizaya cekildi
  - ops-grid iki kolonlu is masasi gibi davranmaya basladi
  - siparis plani karti sticky hale geldi
- Uygulama akisi bozulmadi; bu ilk adim sadece gorunur ve geri alinabilir bir gorunum modu altyapisidir.
- 2026-04-06: Workspace modunda scroll azaltildi. Hero, arama ust alani, en iyi teklif karti, hizli islem paneli, depo teklif tablosu ve aktif siparis plani kartlari daha kompakt hale getirildi; mini plan listesi ic scroll ile sinirlandi, plan detay ozet alani sticky yapildi.
- 2026-04-06: Workspace modu ikinci faz. Aktif siparis plani detay kartlari kompakt modla yeniden duzenlendi; buyuk bilgi kutulari yerine mini metrik hucreleri eklendi, aksiyonlar sag blokta toplandi, scroll ihtiyaci daha da azaltildi.
- 2026-04-06: Workspace modu ucuncu faz. Search ekrani split-view hale getirildi; urun karti solda, en iyi teklif ve hizli islem blogu sagda konumlandi. Depo teklif tablosu ic scroll ve sticky header ile yogun karar ekranina donusturuldu.
- 2026-04-06: Workspace modu dorduncu faz. Back button, loading alani ve farkli urun formlari secimi kompaktlastirildi. Varyant secimi masaustunde iki kolonlu hale getirildi; aktif plan kartlari da daha kisa satir mantigina yaklastirildi.

## 2026-04-06 Workspace Compactness Pass

- midstage/current icinde workspace modu icin arama ekrani yeniden sikistirildi.
- Search sayfasinda stockCalcPanel tam genislikten cikarilip sol kolona alindi.
- Workspace modunda Ana Sayfa butonu, loading alani ve varyant secim katmani daha kompakt hale getirildi.
- Varyant kartlari ve plan detay kartlari icin daha yogun masaustu gorunumu eklendi.
- pplyUiMode() mod degisince aktif sayfayi yeniden render edecek sekilde guclendirildi; gorunur degisikliklerin aninda uygulanmasi saglandi.
## 2026-04-06 Midstage Relaunch Hotfix

- midstage/current Electron acilisi stale single-instance lock nedeniyle engelleniyordu.
- main.js icinde 
equestSingleInstanceLock akisi yumusatildi; lock alinmasa bile uygulama devam ederek pencereyi acabiliyor.
## 2026-04-06 Midstage UserData Isolation

- midstage/current Electron acilisi root uygulama ile userData cakistigi icin baslayamiyordu.
- Midstage icin ayri userData yolu tanimlandi: eczane-app-midstage.
- Config ise ECZANE_CONFIG_PATH ile ana eczane-app/config.json dosyasindan okunmaya devam ediyor.
## 2026-04-06 Midstage Single Instance Disabled

- Midstage Electron instance icin 
equestSingleInstanceLock tam olarak devre disi birakildi.
- Nedeni: Chromium singleton lock dev ortaminda platform_channel fatal hatasi uretiyordu.
## 2026-04-06 Backend Spawn EPERM Fix

- midstage/current/src/server.js icinde server ayaga kalkarken tarayici acma girisimi spawn EPERM ile backendi dusuruyordu.
- Browser auto-open davranisi varsayilan olarak kapatildi; sadece ECZANE_OPEN_BROWSER=1 ise calisacak.
## 2026-04-06 Midstage Rollback To Working Root

- midstage/current icindeki kirik launch ve UI denemeleri geri cekildi.
- Calisan root kod tabani main.js, preload.js, 
enderer/, src/, scripts/, data/, _legacy/ dahil olacak sekilde midstage/current ile yeniden senkronlandi.
- Hedef: midstage'i tekrar calisan baz haline getirmek.
## 2026-04-16 Workspace Mode Reintroduced Safely

- midstage/current icinde workspace UI modu yeniden ama dusuk riskli sekilde geri eklendi.
- Profile menuye Klasik Arayuz ve Workspace Modu secenekleri eklendi.
- Secim localStorage ile kalici tutuluyor ve mod degisince aktif sayfa yeniden render ediliyor.
- Ilk asama sadece layout yogunlastirma ve ekran yerlesimi uzerine kuruldu; feature akislarina dokunulmadi.
## 2026-04-16 Clean Relaunch For Workspace Test

- Ayni anda birden fazla Electron/Node instance acik oldugu icin workspace testi guvenilmez hale gelmisti.
- Tum electron,node surecleri temizlenip tek bir midstage/current instance ile yeniden baslatma karari alindi.
## 2026-04-16 Workspace Safe Search Rollback

- Workspace modu search/order ekranlarinda fazla agresif layout zorladigi icin gorunum bozuluyordu.
- Gecici cozum: workspace search ve plan sayfalari safe mode alindi.
- Yani aki? klasik mantikta kalirken sadece daha yogun ve daha temiz gorunum korunuyor.

## 2026-04-16 - Workspace Modu Operasyon Masasi V1
- `midstage/current` icinde workspace modu CSS override olmaktan cikarilip arama ekraninda ayri render kabugu ile calisacak hale getirildi.
- `page-search` icine yeni workspace kabugu eklendi: sol sabit mini plan rail, kompakt sonuc ozeti, kompakt varyant secimi ve operasyon tablosu formatinda depo teklifleri.
- Workspace arama sonucu artik buyuk yesil en ucuz teklif karti ve buyuk hizli islem panelini kullanmiyor; secili teklif bilgisi rail + sonuc ozeti + tabloya dagitildi.
- Workspace teklif tablosu ilk etapta fallback planner option ile gelir, qty/MF gereken durumda `resolvePlannerOptions()` ile canli quote sonucu ayni tabloda guncellenir.
- Workspace plan detay ekrani daha kompakt satir bazli listeye cekildi; `Birim / Barkod / Depo`, adet adimlari, `Depoya Git` ve `Sil` ayni satirda tutuldu.

- 2026-04-16: Workspace search teklif secimi stabil hale getirildi. Offer selection key icinden fiyat cikarildi; canli quote geldikten sonra secili depo ilk satira geri dusmuyor.

- 2026-04-16: midstage/current server restart sorunu giderildi. src/server.js icindeki otomatik browser-open spawn kodu kaldirildi; backend restart sirasinda EPERM ile dusmuyor.

- 2026-04-16: current-modular icin ayri Electron userData yolu eklendi (eczane-app-current-modular). Dev modda single-instance lock kaynakli acilis cakismalari yumusatildi.

- 2026-04-16: current-modular dev ortaminda single-instance lock tamamen kapatildi. Stale Chromium lock nedeniyle electron acilisi bloklanmiyor.

- 2026-04-16: current-modular calismayan runtime cekirdegi, current icindeki calisan baz ile yeniden senkronlandi. server.js, selcuk.js, nevzat.js, alliance.js ve renderer/scripts/app.js current -> current-modular kopyalandi.

- 2026-04-17: current-modular icin daha genis runtime rollback yapildi. current bazindan main.js, preload.js, renderer/index.html, renderer/scripts, renderer/styles ve src dizinleri yeniden senkronlandi.

- 2026-04-17: current-modular workspace search ekraninda Siparis Planina Ekle sonrasi sol aktif plan rail aninda yenilenir hale getirildi. refreshOrderPlanViews icinde workspace search rerender eklendi. Workspace MF paneline eksik kalan temel stiller eklendi.

- 2026-04-17: CODEX_STABILIZATION_PLAN.md uzun s�reli oturum/cookie timeout, backend-health, search-consistency, plan-state, workspace mimarisi ve otomasyon test odaklariyla tamamen yenilendi.

## Guncel Ek Not - 2026-04-17 19:55
- `midstage/current-modular` workspace search icinde MF panel varsayilan olarak kapali hale getirildi.
- `MF Hesapla` butonu workspace modunda gercek toggle oldu; panel ac/kapat davranisi eklendi.
- Yeni arama, farkli form secimi ve farkli depo secimi stale acik MF panelini tasimayacak sekilde baglam anahtari eklendi.
- Workspace MF paneline kapatma butonu ve `Esc` ile kapatma destegi eklendi.
- Klasik `stockCalcPanel` davranisi degistirilmedi.

## 2026-04-17 - current-modular stabilization slice
- authFetch now combines timeout + caller AbortController and classifies manual cancels as bort.
- Search requests in current-modular now actively abort previous /api/search-depot calls before starting a new search.
- Workspace quote, stock-calc quote and plan drawer quote flows now use scoped abort controllers so stale live pricing calls do not bleed into newer UI states.
- Added 
enderer/scripts/runtime-coordinator.js as the first extracted runtime helper module for scoped request lifecycle + tiny event bus.
- Added depot ensureSession() support for Selcuk, Nevzat and Alliance with lastLoginAt tracking.
- Added backend /api/depots/keep-alive route and frontend keep-alive worker to silently refresh stale depot sessions while the app stays open.

[2026-04-17 10:13:13] current-modular: Order plan detail now groups same-barcode items under one product card and renders depot-specific options as child rows in both classic and workspace modes.
