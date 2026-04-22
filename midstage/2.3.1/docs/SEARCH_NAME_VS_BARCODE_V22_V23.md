# İsim vs barkod araması — V2.2 × V2.3 mantık haritası

Bu doküman `midstage/2.2/renderer/scripts/app.js` (`doSearch`, `renderResults`, `scheduleRender`, varyant katmanı) ile `midstage/2.3/renderer/scripts/app-actions.js` (`runSearch`, `openVariantDetail`), `search-domain.js`, `utils.js` davranışını **sıra ve metot** düzeyinde eşleştirir.

---

## 1) Ortak tanımlar (her iki sürüm)

| Kavram | Dosya | Kural |
|--------|--------|--------|
| `isBarcodeQuery` | `utils.js` | `^\d{13,}$` — sorgu **yalnızca rakam** ve **en az 13 hane** |
| `parseQRCode` | `utils.js` | GS1 / `0869…` / iç gömülü `869\d{10}` → mümkünse 13 haneli GTIN |
| `getItemBarcode(item, fallbackQuery)` | V2.2 `app.js` / V2.3 `search-domain.js` | `barkod` → `extractBarcode(kodu)` → (fallback) barkod benzeri sorgu |
| Kimlik anahtarı | V2.2 `dedupeSearchItems` / V2.3 `buildVariantGroups` | Barkod varsa `BARCODE_{gtin}`, yoksa `NAME_{normalizeDrugName(ad)}` |

---

## 2) Sıralı akış — V2.2 (`doSearch`)

1. `query = selectedBarcode \|\| input.value.trim()`
2. `cleanBarcode = parseQRCode(query)` — **yalnızca** `cleanBarcode && cleanBarcode.length === 13` ise `query = cleanBarcode` ve input güncellenir (`app.js` ~1376–1379).
3. `isBarcode = isBarcodeQuery(query)` — **bu nihai** `query` üzerinden (`scheduleRender` içinde `isBarcodeQuery(query)` ile aynı mantık).
4. Tüm aktif depolara **aynı** `q=encodeURIComponent(query)` ile paralel istek.
5. Her depo yanıtında: `scheduleRender(..., query, searchId, isBarcode)`.
   - **Barkod**: throttle yok → anında `renderResults`.
   - **Metin**: `RENDER_BATCH_MS` (~120ms) throttle.
6. Metin + varyant seçilmemiş: ek olarak `MIN_GATHER_TIME` (~1.5s) sonunda `renderResults` tetiklenebilir.
7. `renderResults`:
   - `dedupeSearchItems(items, query)`
   - `isBarcode \|\| selectedVariant != null` → detay (`renderDetailResults`) veya filtre
   - Aksi → varyant grupları (`renderVariantSelectionLayer`)
8. Varyant kartı tıklanınca (`renderVariantSelectionLayer`):
   - `g.barcode` varsa: `selectedBarcode = g.barcode`, input = barkod, **`doSearch()`** (tüm depolarda **barkod** araması).
   - Yoksa: `selectedVariant = g.id`, `renderResults(allItems, query)` (mevcut birleşik sonuç üzerinde filtre).

---

## 3) Sıralı akış — V2.3 (`runSearch`)

1. `sanitizeSearchInput` (V2.3 ek güvenlik; V2.2’de doğrudan trim).
2. **Kanonik sorgu (V2.2 ile hizalı + düzeltme, 2026-04-21)**  
   - Önce `rawTrim` = sanitize çıktısı.  
   - `parseQRCode(rawTrim)` çıktısı **13 hane ve** `isBarcodeQuery(ps)` ise → `cleanQuery = ps` (**V2.2’nin `length===13` şartı**).  
   - Değilse ve ham girişte 13+ rakam varsa → `normalizeProductBarcode(rakamlar)` ile GTIN; `isBarcodeQuery` true ise barkod modu (**boşluklu barkod / kirli giriş** kapanır).  
   - Aksi halde `cleanQuery = rawTrim` (metin araması).
3. `isBarcode` = yukarıdaki adımda hesaplanan bayrak (`isBarcodeQuery(cleanQuery)` veya GTIN düzeltmesi sonrası).
4. `state.searchQuery` / `currentDetailQuery` = `cleanQuery`.
5. `searchAcrossDepotsProgressive(cleanQuery, …)` — depo bazlı streaming birleştirme.
6. Ara snapshot: metin ise `MIN_GATHER_TIME_MS` / `SEARCH_RENDER_BATCH_MS` ile `applySearchSnapshot`; barkod ise anında.
7. `finally`: metin aramasında tek GTIN tespiti → `searchAcrossDepots(fanBc)` ile **ikinci aşama** (V2.2’de varyant tıklayınca yapılan tam barkod aramasına paralel), `dedupeOffersByKey`, `applySearchSnapshot(merged, { final: true })`.
8. `applySearchSnapshot`: `buildVariantGroups(items, cleanQuery)`; `isBarcode \|\| groups.length<=1` → doğrudan detay sayfası.
9. `openVariantDetail` (V2.2 varyant tıklama ile hizalı, 2026-04-21): grupta barkod / `BARCODE_` anahtarı varsa `searchAcrossDepots(kanonBarkod)` + dedupe + `searchQuery`/`currentDetailQuery` barkoda çekilir.

---

## 4) Metot eşlemesi (V2.2 → V2.3)

| V2.2 | V2.3 |
|------|------|
| `doSearch` | `runSearch` (`app-actions.js`) |
| `scheduleRender` + `renderResults` | `scheduleSnapshotRender` + `applySearchSnapshot` |
| `dedupeSearchItems` | `dedupeOffersByKey` + `buildVariantGroups` içi kimlik |
| `renderVariantSelectionLayer` onclick | `openVariantDetail` (async barkod fan-out) |
| `isBarcodeQuery(query)` nihai `query` | `isBarcodeQuery(cleanQuery)` + GTIN kanon adımı |
| `parseQRCode` sadece 13 hane ise değiştir | Aynı + `normalizeProductBarcode` ile rakam-only düzeltme |

---

## 5) Bilinçli farklar (ürün kararı / mimari)

- V2.3’te **sanitize** adımı var; V2.2’de yok.
- V2.3 birleşik arama **bridge** (`searchAcrossDepotsProgressive`) üzerinden; V2.2 tek dosyada `authFetch` döngüsü — semantik aynı, kod konumu farklı.

---

## 6) Kapanan hata sınıfları (2026-04-21)

1. **`parseQRCode(...) \|\| normalizedInput`**: Metin sorguda parse çıktısı “garip” önsel seçilmesi riski → **V2.2 gibi yalnızca 13 haneli barkod çıktısında** sorgu değişir.  
2. **Boşluk / formatlı barkod**: 13+ rakam `normalizeProductBarcode` ile GTIN’e çekilmezse `isBarcode` yanlışlıkla false kalıyordu → **rakam şeridi + normalize** ile barkod modu açılır.  
3. **İsimle arama → varyant**: Sadece `group.items` ile detay → **barkod varsa `searchAcrossDepots`** (`openVariantDetail`).
