# AI_CHANGELOG - Makine Okunabilir Degisiklik Gunlugu

Bu dosya son degisikliklerin kisa ama teknik kaydidir. Yeni agent once en ustteki bloğu okumali.

---

### @LATEST_CHANGE
**TIMESTAMP:** 2026-04-03T11:05:00
**SESSION:** Toplu Arama Fiyat Duzeltmesi
**AGENT:** Antigravity

**[MODIFIED_FILES]**
- `renderer/scripts/app.js` | calcMfOptions(): targetQty < mf.total ise MF batch zorla uygulanmaz, unit fiyat kullanilir - orn: 3 adet hedef ile MF 19+1 olan Nevzat/Selcukta artik TL 2884 degil ~TL 455 gosterilir
- `renderer/scripts/app.js` | resolveQuotedOptions(): Global _activeQuoteId guard kaldirildi - paralel bulk kart cagirilari artik birbirini iptal etmiyor; her caller kendi versiyonunu yonetiyor (renderStockCalc->_scQuoteVersion, refreshQuotes->state.quoteVersion)

**[ADDED/REMOVED]**
- **MODIFIED:** calcMfOptions - targetQty < mf.total guard eklendi
- **REMOVED:** resolveQuotedOptions'taki global _activeQuoteId / quoteId guard

**[CRITICAL_WARNINGS_FOR_NEXT_AI]**
1. calcMfOptions artik targetQty >= mf.total olmadan MF uygulamiyor. Eski davranis: 3 adet icin MF 19+1 -> 19 adet alim hesapli. Yeni davranis: 3 adet icin unit fiyat, MF 'availableMfStr' olarak gosterilir.
2. _activeQuoteId artik resolveQuotedOptions icinde yok. Sadece QUOTE_CONCURRENCY_LIMIT ve runConcurrent kullanilmakta.
3. Selcuk ve Nevzat live quote (fetchQuotedOption) hala calisir - calcMfOptions fallback duzeltildi, live override hala aktif.

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
