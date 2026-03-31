# Eczane App Bakim Rehberi

Bu rehber, projeye yeni giren bir gelistiricinin sistemi bozmadan anlayip ilerleyebilmesi icin hazirlandi. Amac, "hangi dosya ne yapiyor", "nerede dikkatli olmaliyim" ve "hangi feature'lar mantikli sonraki adimlar" sorularina hizli cevap vermek.

## 1. Proje Ozeti

Eczane App, 6 farkli ecza deposundan ilac fiyatlarini cekip karsilastiran bir masaustu uygulamasi.

- Desktop shell: Electron
- API katmani: Express
- UI: Vanilla HTML/CSS/JS
- Veri modeli: Barkod merkezli urun birlestirme
- Runtime modeli: Electron ana process icinde ayni anda Express server calisiyor

Teknik olarak uygulama hem masaustu uygulamasi gibi, hem de `http://localhost:3000` uzerinden acilan bir web arayuzu gibi davranir.

## 2. Ana Mimari

### 2.1 Calisma Akisi

1. Electron acilir.
2. [main.js](D:/personal/eczane-app/main.js) icinde `ECZANE_OPEN_BROWSER=0` set edilir.
3. Ayni process icinde [src/server.js](D:/personal/eczane-app/src/server.js) `require(...)` ile ayaga kalkar.
4. Electron penceresi `http://localhost:3000` adresini yukler.
5. Frontend aramalari Express API'ye yapar.
6. Express, depo adaptorlerini kullanarak depo sitelerinde arama yapar.
7. Sonuclar normalize edilip UI'da karsilastirmali gosterilir.

### 2.2 Tek Kaynak Kurali

Projede aktif UI dizini yalnizca `renderer/` klasorudur.

- Dogru frontend: [renderer](D:/personal/eczane-app/renderer)
- Dogru backend: [src](D:/personal/eczane-app/src)
- Eski veya arsiv klasorleri referans alinmamali

Bir UI degisikligi yaparken hem web hem Electron davranisini ayni anda dusunmek gerekir.

## 3. Klasorler ve Sorumluluklari

### 3.1 Uygulama Kabugu

- [main.js](D:/personal/eczane-app/main.js)
  Electron window, tray, kisayollar, context menu, OTA update kontrolu ve cookie injection IPC burada.
- [preload.js](D:/personal/eczane-app/preload.js)
  Renderer ile main process arasindaki guvenli kopru.

### 3.2 Backend

- [src/server.js](D:/personal/eczane-app/src/server.js)
  Tum API endpoint'leri, config yukleme/kaydetme, arama gecmisi ve depo init akisi burada.
- [src/depot-manager.js](D:/personal/eczane-app/src/depot-manager.js)
  Tum depolarda arama yapar, sonuclari birlestirir ve fiyat sirasi olusturur.

### 3.3 Depo Adaptorleri

- [src/depots/selcuk.js](D:/personal/eczane-app/src/depots/selcuk.js)
  ASP.NET tabanli login, urun detayi, MF ve net fiyat hesabi.
- [src/depots/nevzat.js](D:/personal/eczane-app/src/depots/nevzat.js)
  Selcuk ile benzer Boyut Bilisim altyapisi.
- [src/depots/anadolu-pharma.js](D:/personal/eczane-app/src/depots/anadolu-pharma.js)
  Token/JWT tabanli login ve Elastic search API.
- [src/depots/anadolu-itriyat.js](D:/personal/eczane-app/src/depots/anadolu-itriyat.js)
  Cookie + anti-forgery token tabanli akisi var.
- [src/depots/alliance.js](D:/personal/eczane-app/src/depots/alliance.js)
  HTML parse, opsiyonel anti-forgery token, teklif cekme ve net fiyat hesaplama.
- [src/depots/sentez.js](D:/personal/eczane-app/src/depots/sentez.js)
  HTML tablo scrape eden adaptor.

### 3.4 Frontend

- [renderer/index.html](D:/personal/eczane-app/renderer/index.html)
  Sayfa iskeleti, title bar, arama ekranlari, MF paneli ve depo webview paneli.
- [renderer/scripts/app.js](D:/personal/eczane-app/renderer/scripts/app.js)
  Ana UX akisi, arama, varyant secimi, QR parsing, history ve sonuc render mantigi.
- [renderer/scripts/depot-browser.js](D:/personal/eczane-app/renderer/scripts/depot-browser.js)
  Depo webview paneli, cookie injection ve otomatik arama davranisi.
- [renderer/scripts/transitions.js](D:/personal/eczane-app/renderer/scripts/transitions.js)
  Sayfa giris/cikis animasyonlarina yardimci fonksiyonlar.

### 3.5 Veri ve Hafiza

- [config.json](D:/personal/eczane-app/config.json)
  Depo credential, token ve cookie bilgileri. Hassas dosyadir.
- [data/history.json](D:/personal/eczane-app/data/history.json)
  Kullanici arama gecmisi.
- [AI_CONTEXT.md](D:/personal/eczane-app/AI_CONTEXT.md)
  Proje hafizasi ve kritik kararlar.
- [AI_CHANGELOG.md](D:/personal/eczane-app/AI_CHANGELOG.md)
  Son AI degisikliklerinin kaydi.

## 4. Kritik Davranislar

### 4.1 Arama Mimarisi

Iki farkli arama modeli vardir:

- Monolithic arama: `/api/search`
- Streaming arama: `/api/search-depot`

Aktif UX mantigi, her depoyu ayri cagirip sonuclari geldikce ekrana basan streaming yapiya dayanir. Yeni gelistirmelerde bunu bozmamak gerekir.

### 4.2 Barkod Temelli Birlesme

Frontend tarafinda barkod, urunun kimligi gibi kullanilir.

- Ayni barkoddan gelen kayitlar tek varlikta birlestirilir
- Barkod eksikse isim tabanli cross-reference ile diger depolardan tamamlanabilir
- Direkt barkod okutulursa varyant secimi atlanabilir

Bu alana dokunurken [renderer/scripts/app.js](D:/personal/eczane-app/renderer/scripts/app.js) icindeki QR parsing ve varyant toplama mantigi dikkatle okunmali.

### 4.3 Stok Filtreleme

Tum depolar stok bilgisini ayni kalitede vermez.

- Bazi depolar stok sayisi vermez ama urun yine de gosterilmelidir
- `stokGosterilsin` flag'i bu farki yonetmek icin vardir
- Alliance, Sentez ve Anadolu Itriyat gibi depolar bu konuda istisna davranis sergileyebilir

Bu nedenle "stok = 0 ise her zaman gizle" gibi basit refactor'lar tehlikelidir.

### 4.4 Gercek Fiyat vs Liste Fiyati

Projede kritik konu, listelenen etiket fiyati degil eczacinin gercek maliyetidir.

- Selcuk ve Nevzat tarafinda net tutar sonradan hesaplanir
- Alliance tarafinda teklif ve hesaplama servisi kullanilir
- Hesaplama fail olursa graceful fallback ile orijinal fiyat korunur

Fiyat hesap katmanina dokunurken regressions en pahali hata turudur.

## 5. Bakim Sirasinda Dikkat Edilecekler

### 5.1 Dokunmadan Once

1. [AI_CONTEXT.md](D:/personal/eczane-app/AI_CONTEXT.md) icindeki son mimari notlari oku.
2. [AI_CHANGELOG.md](D:/personal/eczane-app/AI_CHANGELOG.md) icindeki `@LATEST_CHANGE` blogunu oku.
3. Degisiklik UI ise once web davranisini dusun.
4. Degisiklik depo adaptorunde ise login ve parse akisini ayri ayri test et.

### 5.2 En Riskli Alanlar

- Depo login akislari
- HTML scrape selector'lari
- QR / barkod parsing
- Variant selection layer
- Net fiyat hesaplama servisleri
- Webview icinde cookie/token injection

Bu alanlarda "kucuk refactor" gorunen degisiklikler gercekte uretim sorununa donusebilir.

### 5.3 Siklikla Gorulebilecek Ariza Turleri

- Depo login sayfasi degisir, token/cookie akisi kirilir
- HTML yapisi degisir, scrape sonucu bos doner
- Backend sonuc doner ama frontend barkod birlesmesi yanlis kart uretir
- QR scanner ayni barkodu art arda gonderir, UI titrer
- Net fiyat hesaplama servisi calismaz ve liste fiyati gosterilir
- Electron icinde calisan ozellik, browser modunda farkli davranir

## 6. Test Rutini

Bu projede ideal test rutini manuel + davranis dogrulamasi seklindedir.

### 6.1 UI veya Genel Akis Degisikligi Sonrasi

1. `node src/server.js` veya mevcut calisma sekli ile web arayuzunu ac
2. `http://localhost:3000` uzerinden:
   - arama yap
   - autocomplete kontrol et
   - varyant secimi kontrol et
   - sonuc kartlari ve en ucuz teklif kontrol et
3. Sonra `npm start` ile Electron davranisini kontrol et
4. Title bar, tray, webview ve kisayollari dogrula

### 6.2 Depo Adaptor Degisikligi Sonrasi

En az su senaryolar denenmeli:

- Barkod arama
- Ilac adi arama
- Stokta olmayan ama gosterilmesi gereken urun senaryosu
- Kampanyali urun
- Session expire oldugunda yeniden login

### 6.3 History ve Ayarlar Degisikligi Sonrasi

- [data/history.json](D:/personal/eczane-app/data/history.json) bozulmadan okunuyor mu
- Yeni arama kaydi ekleniyor mu
- Ayarlar kayitlari eski degerleri ezmeden merge oluyor mu

## 7. Degisiklik Yaparken Kurallar

### 7.1 Backend Tarafinda

- Ortak sonuc formatini koru
- `fiyat`, `fiyatNum`, `stokVar`, `stokGosterilsin`, `malFazlasi` alanlarini tutarli birak
- Fail durumunda bos dizi + hata mesaji donmeyi bozma
- Session expire durumlarinda yeniden login akisini koru

### 7.2 Frontend Tarafinda

- `home` ve `search` sayfalari arasindaki akisi bozma
- Barkod okutma senaryosunu her zaman ayri dusun
- Sonuclarin akarken gelmesi davranisini koru
- MF hesaplayici ve varyant secimini "nice to have" degil, ana UX parcasi gibi ele al

### 7.3 Dokumantasyon Tarafinda

Kod degistiginde su dosyalari da guncelle:

- [AI_CHANGELOG.md](D:/personal/eczane-app/AI_CHANGELOG.md)
- [AI_CONTEXT.md](D:/personal/eczane-app/AI_CONTEXT.md)

Buyuk davranis degisikligi varsa bu rehber de guncellenmeli.

## 8. Feature Fikirleri

Asagidaki feature'lar bu projeye hem teknik hem is degeri acisindan mantikli gorunuyor.

### 8.1 Fiyat Degisim Takibi

Kullanici bir urunu "izlemeye" alabilsin.

- Barkod bazli watchlist
- Son fiyat ile yeni fiyat karsilastirmasi
- "En ucuz depo degisti" uyarisi
- Gecmise gore fiyat grafigi

Neden degerli:
Gunluk tekrar aranan ilaclarda sadece anlik degil trend bilgisi de saglar.

### 8.2 Sepet Simulasyonu

Birden fazla ilaci tek seferde girip toplam maliyet hesabi yapilabilsin.

- Her ilac icin en ucuz depo secimi
- Tek depodan toplu alim vs karma alim karsilastirmasi
- MF kampanyalarini toplam siparis mantigina yansitma

Neden degerli:
Gercek eczane satin alma kararini tek urunden daha iyi temsil eder.

### 8.3 Favori Depolar / Depo Agirliklandirma

Kullanici belirli depolari onceliklendirebilsin.

- "Her zaman once su depolari goster"
- "Fiyat farki %X altindaysa su depoyu tercih et"
- Teslimat aliskanligi olan depolara bias ekleme

Neden degerli:
Gercek satin alma karari sadece fiyatla degil operasyonel aliskanlikla da verilir.

### 8.4 Kritik Stok Uyarisi

Sik aranan urunlerde stok dususu veya urun kaybolmasi takip edilebilsin.

- Onceki aramaya gore stok kaybi
- Tum depolarda bulunamayan urun alarmi
- Belirli barkodlar icin "yeniden stokta" bildirimi

Neden degerli:
Saha operasyonunda kritik urunleri kacirmamayi saglar.

### 8.5 Guven Skoru / Veri Kalitesi Rozeti

Her sonuc icin veri kalitesi gostergesi eklenebilir.

- Barkod dogrulandi mi
- Fiyat net hesaplandi mi yoksa fallback mi
- Stok bilgisi gercek stok mu tahmini mi
- Son kontrol zamani

Neden degerli:
Kullaniciya hangi veriye daha cok guvenmesi gerektigini anlatir.

## 9. Onerilen Ilk Feature

Ilk sirada uygulanmasi en mantikli feature: `Fiyat Degisim Takibi`

Sebep:

- Mevcut `history.json` altyapisini kullanarak baslamak kolay
- Barkod merkezli veri modeli ile uyumlu
- UI'ya yuksek deger katar
- Depo adaptorlerinin mantigini cok bozmadan gelistirilebilir

Minimum uygulanabilir kapsami:

1. Urun detayinda "Takibe Al" butonu
2. Barkod bazli local watchlist
3. Son 10 fiyat snapshot'i
4. Son aramaya gore fiyat artti / azaldi etiketi

## 10. Onerilen Sonraki Isler

Sirali backlog onerisi:

1. Fiyat Degisim Takibi
2. Sepet Simulasyonu
3. Veri Kalitesi Rozetleri
4. Kritik Stok Uyarisi
5. Favori Depo Onceliklendirme

## 11. Kisa Operasyon Check-list

Bir degisiklikten sonra kendine su sorulari sor:

1. Web modunda calisiyor mu
2. Electron modunda calisiyor mu
3. Barkod arama bozuldu mu
4. Varyant secimi bozuldu mu
5. En ucuz teklif dogru siralaniyor mu
6. MF bilgisi kayboldu mu
7. History kaydi dogru olusuyor mu
8. AI hafiza dosyalari guncellendi mi

Bu sekiz madde, projede sessiz bozulmalari yakalamak icin en hizli kontroldur.
