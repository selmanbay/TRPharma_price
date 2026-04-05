# AI_CHANGELOG - Makine Okunabilir Degisiklik Gunlugu

Bu dosya son degisikliklerin kisa ama teknik kaydidir. Yeni agent once en ustteki bloğu okumali.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T17:20:00
**SESSION:** Order plan inline editor — click card to open edit actions
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
**SESSION:** Order plan detail UX — card body no longer opens product
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
**SESSION:** Order plan detail hotfix — render hardened against malformed plan entries
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | `renderOrderPlanDetail()` try/catch ile guclendirildi; plan verisi render oncesi tekrar normalize ediliyor ve bozuk kayitlar sayfayi patlatmiyor
- `AI_CONTEXT.md` | Plan detay sayfasi icin güvenli render notu eklendi
- `AI_AGENT_HANDOFF.md` | Plan detay sayfasi blank-screen hotfix not edildi

**[ADDED/REMOVED]**
- **ADDED:** `renderOrderPlanDetail()` icinde defensive normalize + fallback error card
- **ADDED:** `order-plan-error` diagnostics eventi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `Plani Incele` akisi tekrar bos ekran verirse ilk bakilacak yer `renderOrderPlanDetail()` icindeki normalize/render zinciri ve diagnostics `order-plan-error` kaydidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:55:00
**SESSION:** Order plan card parity — MF detail mirrored to home plan card
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
**SESSION:** Search depot hotfix — Selcuk/Nevzat re-login fallback restored
**AGENT:** Codex

**[MODIFIED_FILES]**
- `src/depots/selcuk.js` | Arama istegi timeout veya bozuk cookie nedeniyle dusunce cookie temizle + login yenile + tek sefer retry davranisi geri eklendi; search timeout 10s oldu
- `src/depots/nevzat.js` | Arama istegi redirect loop veya bozuk cookie nedeniyle dusunce cookie temizle + login yenile + tek sefer retry davranisi geri eklendi; search mantigi `_requestSearch()` yardimcisine toplandi
- `AI_CONTEXT.md` | Selcuk/Nevzat arama hatasinin kok nedeni ve cozum not edildi
- `AI_AGENT_HANDOFF.md` | Aynı hotfix ve dogrulama sonucu eklendi

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
**SESSION:** Bulk inline panel — open state hardened
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
**SESSION:** Search depot hotfix — Selcuk/Nevzat instance resolution repaired
**AGENT:** Codex

**[MODIFIED_FILES]**
- `src/server.js` | `/api/search-depot` icinde depot instance secimi alias tabanli hale getirildi; Selcuk/Nevzat ve encoding varyantlari icin eslesme guclendirildi
- `AI_CONTEXT.md` | search-depot alias hotfix not edildi
- `AI_AGENT_HANDOFF.md` | Selcuk/Nevzat instance resolution bug'i ve kontrol noktasi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `aliasesByDepot` hotfix bloğu — `search-depot` route icinde dogrudan depot ad varyantlarini tanir

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. `search-depot` hattinda depot instance secimi name-eslesmesine baglidir; encoding farklari Selcuk/Nevzat gibi depolari sessizce dusurebilir.
2. `src/server.js` icindeki `aliasesByDepot` hotfix bloğu kaldirilacaksa once tum depot adlari tek encoding formatina normalize edilmelidir.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T16:00:00
**SESSION:** Search rollback correction — doSearch aligned with legacy procedure
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
**SESSION:** Search hotfix — restored missing active depot bootstrap in doSearch
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
**SESSION:** Search rollback — reverted to depot-based parallel search
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
**SESSION:** Search Recovery — legacy depot fallback + inline offer loading
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
**SESSION:** Search UX — loading overlay no longer blocks partial results
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | Search SSE akisina watchdog timer eklendi; `done` hic gelmese bile loading state sonsuza kadar acik kalmaz; ilk sonuc geldiginde tam ekran loading kapatilir ve mevcut sonuc kullaniciya birakilir
- `AI_CONTEXT.md` | Search loading/timeout davranisi not edildi
- `AI_AGENT_HANDOFF.md` | Watchdog mantigi ve spinner regression kontrol noktasi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `pendingSearchWatchdogTimer`
- **ADDED:** `SEARCH_WATCHDOG_MS = 8000`
- **ADDED:** partial-result timeout davranisi — ilk sonuc geldiyse spinner kapanir, gec kalan depolar kullaniciyi bloklamaz
- **REMOVED:** ilk sonuc geldikten sonra uzun sure tam ekran loading gostermeye devam etme davranisi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Search SSE `done` hic gelmeyebilir; watchdog korumasi bu yuzden kritik.
2. Ilk gecerli sonuc geldikten sonra loading tekrar tam ekran acilmamali.
3. Timeout durumunda elde sonuc varsa error state'e dusulmez; mevcut sonuc korunur.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T14:40:00
**SESSION:** Bulk Planner UX — clickable card opens inline management layer
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
**SESSION:** Autocomplete Reliability — lightweight Selcuk suggestion path
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
**SESSION:** Search Stability — SSE false-error fix + resilient retry state
**AGENT:** Codex

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | SSE tabanli `doSearch()` akisi debug edildi; stream normal kapanirken `EventSource.onerror` ile yanlis hata karti acma bug'i kapatildi; yeni aramada mevcut sonuclarin gereksiz erken gizlenmesi kaldirildi; `resetSearchDetailState()` ile arama state reseti merkezilestirildi; partial-result durumunda stream kopsa bile UI success'te tutuluyor
- `renderer/index.html` | Search hata karti ve arama ekrani gorunur metinleri temizlendi; mojibake search kopyalari duzeltildi
- `AI_CONTEXT.md` | Search SSE akisinin yeni garanti davranisi ve false-error riski not edildi
- `AI_AGENT_HANDOFF.md` | Search debug bulgulari ve sonraki agent icin SSE kapanis semantigi eklendi

**[ADDED/REMOVED]**
- **ADDED:** `streamCompleted` guard — `done` sonrasi gelen SSE close olayi hata sayilmaz
- **ADDED:** partial-result guard — stream kopsa bile elde sonuc varsa hata karti acilmaz
- **REMOVED:** search baslangicinda sonuclarin kosulsuz gizlenmesi

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. Search artik SSE (`/api/search-smart`) kullaniyor; `EventSource.onerror` normal stream kapanisinda da tetiklenebilir.
2. `done` event'i geldikten sonra acilan hata karti bug kabul edilir; `streamCompleted` guard'i korunmali.
3. Search UI yeni aramada eski sonucu gecici korur; tekrar beyaz ekran olursa ilk bakilacak yer `evtSource.onerror` ve `showSearchErrorState` akisidir.
4. Bulk search hala `/api/search-depot` uzerinden ayrik calisir; search ekrani ile karistirilmamali.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-05T14:00:00
**SESSION:** Autocomplete Performance — lower debounce + Selcuk-first fast path
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
**SESSION:** Search Engine — Provider Registry Mimarisi
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `src/search-engine.js` [NEW] | SearchEngine sinifi — her depo bir provider olarak kayit olur, tum aktif providerlar paralel sorgulanir, sonuclar callback ile stream edilir.
- `src/server.js` | SearchEngine import + initDepots'a provider registration eklendi + `/api/search-smart` SSE endpoint eklendi
- `src/auth-middleware.js` | requireAuth: SSE icin query param token fallback eklendi (EventSource header gonderemez)
- `renderer/scripts/app.js` | doSearch() 6 ayri authFetch yerine tek SSE baglantisi kullaniyor. _activeEventSource ile race condition korunuyor.
- `_legacy/doSearch-v1.js` [NEW] | Eski doSearch yedegi — geri alma proseduru dahil
- `_legacy/server-search-v1.js` [NEW] | Eski /api/search-depot endpoint yedegi

**[ADDED/REMOVED]**
- **ADDED:** src/search-engine.js — Provider Registry pattern
- **ADDED:** /api/search-smart — SSE endpoint (server.js)
- **ADDED:** _legacy/ — sürüm geri alma yedekleri
- **MODIFIED:** doSearch() — 6x authFetch → 1x EventSource
- **MODIFIED:** auth-middleware — query param token fallback
- **PRESERVED:** /api/search-depot — bulk search hala kullaniyor (degismedi)

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. SearchEngine provider fonksiyonlari depot.search(query) wrapperdir — adapter degisikligi gerekmez
2. SSE auth: EventSource custom header gonderemez, token query param olarak gider (?token=xxx)
3. _activeEventSource: Art arda arama yapildiginda onceki SSE baglantisi kapatilir (race condition)
4. /api/search-depot KORUNDU — bulk search (searchOneBulkQuery) bunu kullaniyor, silme
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

