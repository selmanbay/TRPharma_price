# V2.3 Worklog

## 2026-04-19 - Ilk kurulum

### Kaynak alinan yerler
- `midstage/2.2/main.js`
- `midstage/2.2/preload.js`
- `midstage/2.2/src/*`
- `midstage/2.2/renderer/mock.html`
- `midstage/2.2/renderer/scripts/utils.js`

### Yapilanlar
- `midstage/2.3` klasoru `2.2` runtime tabani uzerinden ayri workspace olarak olusturuldu.
- `package.json` ve `main.js` V2.3 kimligine cekildi:
  - app id
  - product name
  - version
  - ayri `userData` klasoru
- `renderer/mock.html` yeni shell giris dosyasi olarak korundu ve sonuna `utils.js` + `app-v23.js` baglandi.
- `renderer/scripts/app-v23.js` eklendi.
  - auth kontrolu
  - home dashboard render
  - search variants/detail akisi
  - bulk search akisi
  - order plan akisi
  - settings/depot save + test-login akisi
  - gizli compat alanlari
- `src/config-store.js` ve `src/account-store.js` genisletildi.
  - `eczane-app-v2_2` AppData config/account kaynaklari import adayi oldu.

### Tasarim tarafinda bilincli secimler
- `classic mode` tasinmadi.
- `workspace` tek mod olarak kabul edildi.
- mockta gorunmeyen admin/test/update alanlari ana navbar'a konmadi.
- bunun yerine settings icinde `Uyumluluk araclari` details paneli eklendi.

### Bu turdaki dogrulamalar
- `node --check`
  - `main.js`
  - `preload.js`
  - `src/server.js`
  - `renderer/scripts/app-v23.js`
- Electron runtime smoke:
  - V2.3 app kalkti
  - Express `127.0.0.1:3000` uzerinde acti
  - 6 depo yuklendi loglandi

### Kalanlar / sonraki iyilestirme adaylari
- canli UI click smoke
- bulk drawer ve plan drawer interaction derinlestirme
- search detail ekraninda quote-option tabanli daha gelismis MF secimi
- responsive tablet varyanti
- admin/test/update compat yuzeylerini daha sistematik bir panel haline getirme

## 2026-04-19 - Onarim turu

### Kullanici raporu
- ust titlebar kontrol butonlari gorunmuyor
- arama kutusu erken sayfa gecisi yapiyor
- sonuc ekrani liste gibi davranmiyor
- ilac detayi ve siparis plani ekrani stillenmemis / bozuk gorunuyor

### Okunan yerler
- `midstage/2.3/renderer/mock.html`
- `midstage/2.3/renderer/mock.css`
- `midstage/2.3/renderer/scripts/app-v23.js`

### Bulunan kok nedenler
- `mock.html` icinde titlebar markup yoktu
- top search input hala inline `switchMock('search-variants')` kullaniyordu
- `app-v23.js` yeni class adlariyla render yapiyordu ama bu class'lari tanimlayan stil dosyasi aktif sayfaya bagli degildi
- arama akisinda gorunur loading state yoktu

### Yapilan duzeltmeler
- `renderer/mock.html`
  - `mock.css` baglandi
  - titlebar eklendi
- `renderer/mock.css`
  - V2.3 runtime'in kullandigi eksik layout class'lari eklendi
  - variant list, detail hero, plan shell, bulk table ve ortak badge/button/card koPrusu eklendi
- `renderer/scripts/app-v23.js`
  - titlebar event binding eklendi
  - top search input'un eski inline click davranisi runtime'da kapatildi
  - `searchLoading` ve `searchError` state'i eklendi
  - `runSearch()` yukleme gorunumu gosterecek sekilde guncellendi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`
## 2026-04-21 - Consistency runner katmani

### Kaynak
- kullanici istegi:
  - canli smoke yerine seri kosulabilir tutarlilik testleri istiyor
  - V2.2 ve V2.3 logic kaymalarini erken gormek istiyor

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/offer-domain.js`
- `midstage/2.3/renderer/scripts/search-domain.js`
- `midstage/2.3/renderer/scripts/operation-identity.js`
- `midstage/2.3/renderer/scripts/app-actions.js`
- `midstage/2.3/renderer/scripts/utils.js`
- `midstage/2.2/renderer/src/features/pricing/LegacyPricingEngine.js`

### Uygulanan kararlar
- `scripts/test-consistency-runner.js` eklendi
- yeni CLI suite'leri:
  - `mf-parity`
  - `bulk-normalization`
  - `identity-grouping`
  - `all`
- `mf-parity` su sabiti denetliyor:
  - V2.3 `offer-domain.calculatePlanning(...)`
  - V2.2 `LegacyPricingEngine.getFallbackPlannerOptions(...)`
  ayni veri ve ayni adet icin ayni planner sonucunu veriyor mu?
- `bulk-normalization` su sabiti denetliyor:
  - GS1 karekod + barkod ayni canonical barkoda iniyor mu?
  - tekrar okutma ayri satir acmak yerine adet olarak birlesiyor mu?
- `identity-grouping` su sabiti denetliyor:
  - ayni barkodlu teklifler tek varyant grubuna dusuyor mu?
  - plan key adaylari barkod ve `BARCODE_` formunu birlikte tasiyor mu?
- `package.json` icine `test:consistency` komutu eklendi
- `TEST_INTERFACE_PLAN.md` V2.3 ve 5 katmanli test mimarisi olarak guncellendi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\scripts\test-consistency-runner.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run test:consistency -- --json`

## 2026-04-20 - Onay listesi ayrildi ve plan satir aksiyonlari toparlandi

### Kaynak
- kullanici geri bildirimi:
  - onay listesi, onaya gonderilen ilaclarin listelendigi ayri bir yer olmali
  - plan satir aksiyonlari daha duzgun gorunmeli

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- `approvalQueue` icin ayri local store tanimlandi:
  - `eczane.approval.queue.v1`
- plan ile onay listesi ayrildi:
  - plan ekranindaki satirdan `Onaya Gonder` denince kalem approval queue'ya yaziliyor
  - approval ekrani artik tum plani degil, queue'daki kalemleri listeliyor
  - ayni kalem/depo tekrar gonderilirse duplicate acmiyor, mevcut kaydi guncelliyor
- approval ekranina:
  - toplam
  - adet
  - birim maliyet
  - listeden cikar aksiyonu
  eklendi
- global toolbar aksiyonu `Onay Listesi (n)` oldu
- plan satir aksiyonlari gorsel olarak toparlandi:
  - wrap destekli
  - `Onaya Gonder` daha belirgin primary inline action
  - `Depoda Ac` ve diger aksiyonlar daha okunur spacing ile hizalandi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Plan satir aksiyonlari ve 2.2 benzeri depo-ac davranisi

### Kaynak
- kullanici geri bildirimi:
  - her ilac icin ayri `Onaya Gonder` aksiyonu olmali
  - `Efektif` yerine `Birim` kullanilmali
  - `Depoda Ac` urunu depoda, 2.2'deki gibi arama hedefiyle acmali

### Bu turda okunan yerler
- `midstage/2.2/renderer/scripts/app.js`
  - `buildChromeDepotTarget(...)`
  - `copyAndOpenDepot(...)`
- `midstage/2.3/renderer/scripts/app-v23.js`

### Uygulanan kararlar
- plan state'ine `planApprovalScope` eklendi
- global onay listesine ek olarak satir bazli onay akisi geldi:
  - `openPlanApprovalForItem(key, depotId)`
  - approval scaffold secili kaleme gore filtreleniyor
- plan tablolarinda `Efektif` basligi `Birim` olarak guncellendi
- plan drawer ve ilgili bilgi kartlarinda da `Birim` dili kullanildi
- `Depoda Ac` artik yalniz `depotUrl` acmiyor:
  - `2.2` mantigina benzer `buildChromeDepotTarget(...)` + `copyAndOpenDepot(...)` yardimcilari `2.3` icine tasindi
  - plan, detail ve secili teklif acma akislari bu yardimciya baglandi
  - barkod varsa barkod, yoksa urun adi / sorgu ile ilgili deponun hizli arama sayfasi hedefleniyor
- plan ekraninda:
  - ilac bazli satirlara `Onaya Gonder`
  - depo bazli listede de kalem satirlarina `Onaya Gonder`
  - satir bazli `Depoda Ac`
  aksiyonlari eklendi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Plan toolbar ve bulk canonical barcode normalizasyonu

### Kaynak
- kullanici geri bildirimi:
  - plan ekraninda ust toplama/yonetim secenekleri olsun
  - depo bazli / ilac bazli toplama secimi gelsin
  - depoda ac ve onaya gonder aksiyonlari olsun
  - bulk'ta QR + barkod ayni ilaci tekrar acmasin

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/scripts/utils.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- plan icin yeni `renderPlanPageV2()` eklendi ve aktif renderer buna baglandi
- plan ustunde toolbar geldi:
  - `İlaç Bazlı`
  - `Depo Bazlı`
  - `Depoda Aç`
  - `Onaya Gönder`
- plan artik iki modda gorulebiliyor:
  - ilac bazli dagilim
  - depo bazli dagilim
- `Onaya Gönder` simdilik yalniz liste/gorunum scaffold'i aciyor
- onay ekraninda daha sonra ekstra alanlar eklenebilecek sekilde `approval-list` zemini hazirlandi
- plan kapsayicisi genisletildi (`plan-container-wide`)
- plan satirlarina `Depoda Aç` inline aksiyonu eklendi
- bulk normalizasyonu icin `normalizeBulkQueries(raw)` eklendi
- karekod satiri artik `parseQRCode()` ile canonical barkoda indirgeniyor
- ayni ilacin:
  - GS1 karekodu
  - temiz 13 haneli barkodu
  ayni canonical barcode altinda birlesiyor
- duplicate satir acilmiyor; bunun yerine ayni ilac tekrar okutulduysa `desiredQty` arttirilmis tek satir olusuyor
- boylece Nevzat/Selcuk QR cevabi ile bulunup diger depolarda barkodla arama yapma akisi daha stabil hale geldi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Bulk sonuclarda adet ve detayli inceleme akisi

### Kaynak
- kullanici geri bildirimi:
  - bulk sonuc gosteriminde adet degistirme olmali
  - detayli inceleme drawer'inda sayi degistirme ve MF hesaplama olmali
  - varyant detayindan toplu aramaya geri donulebilmeli

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- bulk row state'ine `desiredQty` eklendi
- sonuc tablosunda her satira `qty-control` ile adet degistirme eklendi
- maliyet kolonu bulk satirinda artik secili adet uzerinden hesaplanan efektif maliyeti gosteriyor
- `Plana Ekle` artik sabit 1 adet degil, row'un secili adedi ve MF planning sonucunu kullaniyor
- `Detayli Inceleme` drawer'ina:
  - adet kontrolu
  - teslim/toplam/efektif info-card'lari
  - secili form/adet uzerinden canli MF planning ozetini
  ekledim
- `openBulkVariant()` bulk baglamini sakliyor ve detail ekrana secili adetle gidiyor
- detail ekranindaki geri butonu bulk baglami varsa `Toplu Aramaya Don` akisina geciyor
- `returnToBulkDetail(rowIndex)` ile bulk sayfasi tekrar acilip ilgili drawer geri yukleniyor

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Bulk search hiz ve form secim akisi

### Kaynak
- kullanici geri bildirimi:
  - toplu arama `2.2`ye gore cok yavas hissettiriyor
  - barkod/urun satirlarinda diger formlar gorunup secilebilmeli

### Bu turda okunan yerler
- `midstage/2.2/renderer/scripts/app.js`
- `midstage/2.3/renderer/scripts/app-v23.js`

### Uygulanan kararlar
- bulk search artik tum satirlari bitirip tek seferde ekrana basmiyor
- `bulkRows` once `loading` placeholder olarak aciliyor
- her query tamamlandikca ilgili satir aninda guncelleniyor
- concurrency limiti 3 yerine 4 oldu
- boylece `2.2`deki kademeli dolma hissine daha yakin davranis geldi
- bir satirda birden fazla form/varyant varsa:
  - artik otomatik `bestItem` secilmiyor
  - satir `Form Sec` durumuna geciyor
  - drawer icinde her group/form icin `Bu Formu Sec` aksiyonu geliyor
  - secilen form row.bestItem / selectedGroupKey uzerinden plana baz oluyor
- `Plana Ekle` butonu secim gerekliyse drawer acarak kullaniciyi once form secimine yonlendiriyor

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Home plan onizlemesinde alternatif depo etiketi

### Kaynak
- kullanici geri bildirimi:
  - ornegin urun planda bir depoda secili olsa bile diger depo alternatifleri de kucuk yaziyla gorunsun

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- `formatPlanAltDepots(item)` yardimcisi eklendi
- home plan onizleme satirinda secili depo etiketi korunuyor
- ayni urune ait `alternatives` listesinden secili olmayan depolar toplanip kucuk ikincil metin olarak ekleniyor
- tekrar eden depo isimleri `Set` ile tekilleştiriliyor
- gorunum:
  - `Nevzat Ecza`
  - `+ Anadolu Pharma, Selcuk Ecza`
  gibi ayni satirda daha sakin bir hiyerarsiyle akiyor

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Search suggestion ve sonuc yuzeyi cakis masi duzeltmesi

### Kaynak
- kullanici geri bildirimi:
  - yazarken suggestion dropdown ve varyant/sonuc yuzeyi ayni anda acik gorunuyor

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`

### Uygulanan kararlar
- `searchDrafting` ve `searchDraftQuery` state alanlari eklendi
- suggestion acik yazma modunda artik eski search sonucu yuzeyi korunmuyor
- bunun yerine `renderSearchDraftState()` ile tek bir gecis/draft yuzeyi gosteriliyor
- temiz bir `bindTopNavV2()` akisi eklendi ve bootstrap artik bunu kullaniyor
- barkod akisi suggestion yerine dogrudan aramaya gidiyor
- normal yazi aramasinda:
  - draft state aciliyor
  - suggestion listesi yukleniyor
  - gercek arama tetiklenince draft state kapanip sonuc akisi basliyor

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Detail ekraninda PSF ve sol panel sadeleştirmesi

### Kaynak
- kullanici geri bildirimi:
  - her satirda PSF tekrar etmesin
  - sol panelde ilac adi yeniden yazmasin

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`

### Uygulanan kararlar
- detail decision table icinden `PSF` kolonu tamamen kaldirildi
- boylece satir bazli gereksiz `-` tekrari temizlendi
- detail sol sidebar icindeki buyuk urun adi kaldirildi
- sol panel artik daha kompakt:
  - `Secili Teklif`
  - depo etiketi
  - ozet metrik karti
  - aksiyon butonlari
- urun adi ana hero yuzeyinde kalmaya devam ediyor; yani bilgi kaybi yok, sadece tekrar azaldi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`
- `npm start` runtime smoke:
  - Electron acildi
  - `127.0.0.1:3000` ayaga kalkti
  - 6 depo loglandi

## 2026-04-20 - Design.md Faz 1 baslangici

### Kural kaynagi
- `midstage/2.3/design.md`

### Okunan yerler
- `midstage/2.3/design.md`
- `midstage/2.3/renderer/mock.html`
- `midstage/2.3/renderer/mock.css`
- `midstage/2.3/renderer/scripts/app-v23.js`

### Bulunan ana sorun
- `mock.html` ile `mock.css` iki farkli tasarim sistemi gibi davraniyordu.
- `mock.css` kendi `:root`, font, brand ve shadow sistemiyle inline mock tokenlarini eziyordu.
- search input focus halinde layout kaydiriyordu.
- hover durumlarinda gereksiz `translateY` hareketleri vardi.
- drawer overlay / drawer gecisleri ikinci stil sisteminde eski `display/right/left` modeline donmustu.
- arama onerileri inline style ile olusturuluyor, ortak tasarim sistemi disinda kaliyordu.

### Yapilanlar
- `renderer/mock.css` sifirdan tamamlayici katman olarak yeniden yazildi.
  - kendi `:root` ve font sistemi kaldirildi
  - `mock.html` tokenlarini kullanan tamamlayici class seti kuruldu
  - titlebar, runtime class'lari, plan/detail/bulk/drawer yuzeyleri tek sisteme cekildi
  - drawer gecisleri `transform` bazli yapildi
  - overlay `opacity + pointer-events` modeline sabitlendi
  - hover ziplama efektleri kaldirildi
  - focus ring ve suggestion panel siniflari eklendi
- `renderer/mock.html`
  - `design.md` Faz 1'e uygun ortak tokenlar eklendi:
    - `brand-200`
    - `shadow-1`
    - `shadow-2`
    - `shadow-glow-brand`
    - motion/easing tokenlari
    - `titlebar-h`
  - page enter animasyonu ve search focus davranisi sakinlestirildi
  - `btn` hover hareketleri ve `variant-item` translate hareketi kaldirildi
  - depo dot glow'lari halka/ring modeline cekildi
  - drawer top hatti `titlebar + navbar` toplam yukseklige alindi
- `renderer/scripts/app-v23.js`
  - global search suggestions artik class tabanli panel olarak olusuyor
  - open/close davranisi inline `display` yerine `open` class'i ile yonetiliyor
  - suggestion satirlari ortak class ile render ediliyor

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

### Sonraki faz
- Faz 2:
  - `is-selected` / `row-best` gorsel standardini derinlestirme
  - MF panelini DOM'da sabit tutup `data-open` ile ac/kapa gecisine gecme
  - settings state / loading / empty / skeleton polish

## 2026-04-20 - Design.md Faz 2 ve Madde 10 baslangici

### Kaynak
- `midstage/2.3/design.md`

### Bu turda okunan yerler
- `midstage/2.3/design.md`
- `midstage/2.3/renderer/mock.css`
- `midstage/2.3/renderer/scripts/app-v23.js`

### Uygulanan kararlar
- MF paneli artik sadece render edilip cikan bir blok degil; DOM'da kalip `data-open` ile acilan yuzeye donustu.
- Empty state illUstrasyonlari sadece izin verilen yuzeylere eklendi:
  - variants no-result
  - home plan onizleme bos hali
  - plan page bos hali
- bulk dropzone icin kucuk cizgisel SVG destek katmani eklendi.
- settings kartlari state tabanli sinifa tasindi:
  - `connected`
  - `disconnected`
  - `refreshing`
- `Esc` ile MF paneli ve drawer kapatma destegi eklendi.

### Teknik degisiklikler
- `renderer/mock.css`
  - `.mf-calc[data-open]` ac/kapa gecisi eklendi
  - `.empty-state`, `.empty-state-illustration`, `.variant-empty`, `.skeleton-row`, `.skeleton-text` eklendi
  - `.bulk-dropzone-head` ve `.bulk-dropzone-art` eklendi
  - settings state kart class'lari eklendi
  - product hero arka planina hafif radial accent eklendi
- `renderer/scripts/app-v23.js`
  - `renderEmptyState()`
  - `renderVariantSkeletons()`
  - `renderBulkDropzoneArt()`
  - variants loading ve no-result state'leri yeni helper'larla guncellendi
  - detail MF paneli `state.mfCalculatorOpen` ile `data-open` modeline alindi
  - home ve plan bos state'leri helper tabanli hale geldi
  - settings test-login sirasinda kart `refreshing` state aliyor
  - global `Escape` handler eklendi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

### Not
- Madde 10'daki kurala uyularak detail, plan drawer, MF calculator ve karar tablolarina buyuk illUstrasyon eklenmedi.
- IllUstrasyonlar yalnizca bos state / dropzone gibi izin verilen yuzeylerde kullanildi.

## 2026-04-20 - Faz 2 devam / home-settings-drawer polish

### Okunan yerler
- `midstage/2.3/design.md`
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- Home ust yuzeyi `dashboard-header-surface` ile daha sakin operasyon bandina donustu.
- Toplu Arama banner'i gradient/agresif glass hissinden cikarilip daha ciddi `operations-banner` yuzeyine cekildi.
- Home plan onizleme satirlari ve gecmis satirlari ortak hover class'larina alindi.
- Settings kartlari:
  - `settings-state-dot` eklendi
  - hic depo bagli degilse uyarı banner'i eklendi
  - sekmeler `settings-tab` yapisina cekildi
  - disconnected kartta yardim metni eklendi
  - `Test Login` ghost aksiyona cekildi
- Plan drawer:
  - secili teklif karti `data-selected` state ile daha belirgin hale getirildi
  - secili satira check indicator eklendi
  - kart ici aksiyonlar `drawer-actions` yapisina toplandi
  - ust ozet `drawer-hero` katmanina tasindi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Ekran bazli ROI turu

### Kaynak
- kullanici ekran geri bildirimi
- `midstage/2.3/design.md`

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- Home:
  - operasyon banner CTA kontrasti guclendirildi
  - sag aksiyon butonu beyaz dolguya cekildi
  - ikon kapsulu 32px daha sakin yuzeye indirildi
  - kart ustu linkler `panel-link-btn` ile aksiyon gibi davranmaya basladi
- Varyant:
  - arama basligi `formatSearchHeading()` ile daha duzgun ekrana yansitildi
  - ust sag `Ana Sayfa` aksiyonu ikonlu ghost-link formatina alindi
  - barkod / depo sonucu satiri `variant-meta` yapisina cekildi
  - fiyatin "min." oldugunu anlatan ikincil label eklendi
- Ilac detay:
  - sol sidebar plan fiyatlari `sidebar-plan-price` ile tek satira sabitlendi
  - `Musteri fiyati` alaninda veri yoksa `PSF yok` olarak daha net gosterilmeye baslandi
- MF hesaplayici:
  - adet shortcut chip'leri ile kampanya chip'i ayristirildi
  - aktif adet chip'i artik border-width jitter yaratmiyor
  - info-card degerleri mono fiyata cekildi
  - order / receive / total / effective kartlarina semantik sol border verildi
- Plan:
  - grup basliklari secili/depo tonuna gore sol renk barli hale geldi
  - ust toplam alani `TOPLAM` label + mono toplam hiyerarsisine cekildi
  - grup alt metni `tek depoda / n depoda dagitildi` diline guncellendi
  - edit butonu 32x32 ikon kutusuna sabitlendi
  - plan tablo sayi kolonlari sag hizali / mono hale getirildi
  - aksiyon kolonu basligi eklendi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Metin / para / ekran yogunlugu turu

### Kaynak
- kullanici ekran geri bildirimi
- `midstage/2.3/design.md`

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/scripts/utils.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- Para formati `formatCurrency()` uzerinden `363,45 ₺` standardina cekildi.
- Home / Varyant / Detail / Plan ustunde gorunen ana metinler daha dogru Turkce karsiliklara yaklastirildi.
- Home ve Varyant aksiyon linkleri tek tip `panel-link-btn` kullanmaya devam edecek sekilde ikonlu hale getirildi.
- Detail:
  - karar tablosuna `Aksiyon` header'i eklendi
  - `Web'de Ac` yalnizca secili satirda gosterilecek sekilde sadeleştirildi
  - MF badge'i daha ayristirilabilir `badge-mf` treatment'ina cekildi
- Wrapper bazli subtle grid/radial background treatment:
  - `home-wrapper`
  - `variant-list`
  - `detail-wrapper`
  - `plan-container`
  yuzeylerine uygulandi
- Bu sayede veri ekranlari buyuk illustrasyon eklemeden daha intentional bir zemin kazandi.

### Teknik degisiklikler
- `renderer/scripts/utils.js`
  - `formatCurrency()`
- `renderer/scripts/app-v23.js`
  - Turkce/aksiyon/currency render metinleri
  - detail action kolonu ve secili satir aksiyon sadeleştirmesi
- `renderer/mock.css`
  - `badge-mf`
  - wrapper background treatment

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\utils.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Search tetikleme / detail panel ergonomisi

### Kaynak
- kullanici geri bildirimi:
  - search calismiyor
  - ilac ekraninda maliyet daha acik olmali
  - baz fiyat satiri kalkmali
  - sol plan paneli kaydirilmali

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- Search UX guclendirildi:
  - Enter ile arama korunuyor
  - search ikonuna tiklayinca arama basliyor
  - `Ctrl K` kisayol etiketi artik input'u focus ediyor
  - barkod / QR benzeri numerik giriste kisa debounce ile otomatik arama tetikleniyor
- Detail maliyet kolonu sadeleştirildi:
  - `baz fiyat` alt satiri kaldirildi
  - yerine daha acik `MF efektif maliyet / Net birim maliyet` aciklamasi geldi
- Sol `search-sidebar` paneli yuksek ekranlarda kaydirilabilir hale getirildi
  - `max-height`
  - `overflow-y: auto`
  - ince scrollbar

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`

## 2026-04-20 - Search loading tek-yuzey duzeltmesi

### Kaynak
- kullanici geri bildirimi:
  - arama sirasinda bos ekran gorunuyor
  - ayni anda iki ayri kisim aciliyor

### Bu turda okunan yerler
- `midstage/2.3/renderer/scripts/app-v23.js`
- `midstage/2.3/renderer/mock.css`

### Uygulanan kararlar
- Her arama artik once ayni loading route'a dusuyor:
  - barkod da olsa
  - normal metin aramasi da olsa
- `renderVariantsPage()` icindeki loading akisi parcali skeleton liste yerine tek bir `search-loading-surface` olarak kurgulandi
- suggestion dropdown loading sirasinda kapaniyor ve ana yuzeyle cakisacak ikinci bolum hissi azaltiliyor
- boylece:
  - bos beyaz ekran
  - ayni anda suggestion + yarim variants hissi
  yerine tek bir loading yuzeyi kaldi

### Dogrulama
- `node --check D:\personal\eczane-app\midstage\2.3\renderer\scripts\app-v23.js`
- `npm --prefix D:\personal\eczane-app\midstage\2.3 run check`
- Plan satırlarında `Onaya Gönder` artık sayfa değiştirmeden inline `Onaylandı` durumuna çeviriliyor; onaylı satırlar yarı saydam görünüyor ve `Onayı Kaldır` ile tekrar düzenlenebilir hale geliyor.
- Bulk form seçimi sadeleştirildi: artık sadece ilaç isimlerini gösteren tek seçim listesi açılıyor, seçim sonrası barkod normalize edilip doğrudan detail edit akışı başlatılıyor.
