# Codex Stabilization Plan

Tarih: 2026-04-03
Proje: Eczane App

## Amaç

Bu planin amaci uygulamayi daha stabil, daha hizli ve daha ongorulebilir hale getirmektir.
Odak alanlari:

- Arama sonrasi bos ekran veya yanlis sonuc gosterimi
- Renderer tarafinda gereksiz tekrar render ve state yarislari
- Electron acilisinda zamanlama kaynakli beyaz ekran riski
- Quantity bazli canli fiyat akisinin UI'yi bloke etmesi
- Buyuk ve kirilgan `app.js` yapisinin bakim maliyeti

## Mevcut Ana Riskler

1. Search race condition
- Yeni arama basladiginda onceki `search-depot` istekleri iptal edilmiyor.
- Gec gelen eski cevaplar yeni arama ekranini ezebilir.

2. Startup race condition
- Electron serveri sabit bekleme suresiyle aciyor.
- Server gec hazir olursa ilk acilista bos ekran olusabilir.

3. Ag timeout ve hata standardizasyonu eksik
- `authFetch()` timeout, retry ve ortak hata davranisi olmadan calisiyor.
- Bu durum loading durumlarinin takili kalmasina neden olabilir.

4. Fazla rerender
- Her depo cevabinda liste tekrar sort edilip ekran bastan ciziliyor.
- Bu durum titreme, gecikme ve secim kaybi hissi yaratir.

5. Quote fan-out baskisi
- MF ve quantity fiyatlandirmasi birden fazla depoda cok sayida request uretiyor.
- Iptal ve concurrency limiti olmadiginda UI ve backend gereksiz yorulur.

6. Sync filesystem kullanimlari
- Config ve history gibi alanlarda sync dosya okuma/yazma kullaniliyor.
- Desktop ortaminda calisir ama ani bloklama ve hissedilen donma yaratabilir.

7. Buyuk renderer dosyasi
- `renderer/scripts/app.js` fazla buyuk ve stateful.
- Kucuk bir syntax veya render hatasi tum ekranin bozulmasina neden olabilir.

## Stabilizasyon Fazlari

### Faz 1 - Kritik Stabilite

Hedef: Beyaz ekran, yarim render, yanlis arama sonucu ve takili loading gibi sorunlari azaltmak.

1. Search request cancellation
- Her arama icin benzersiz bir request kimligi olustur.
- Sadece aktif request kimligi ile gelen cevap UI'ya yazilsin.
- Mumkunse `AbortController` ile eski `search-depot` isteklerini iptal et.

2. Startup readiness kontrolu
- Sabit `1000ms` bekleme yerine server health-check kullan.
- `loadURL` basarisiz olursa retry mekanizmasi ekle.
- `did-fail-load` ve `did-finish-load` eventleri ile acilis durumu takip edilsin.

3. `authFetch()` sertlestirme
- Varsayilan timeout ekle.
- Timeout hatasi, auth hatasi ve network hatasi ayri formatta donsun.
- Gerekli yerlerde tek seferlik retry degerlendir.

4. Renderer global hata gorunurlugu
- Renderer tarafina global error handler ekle.
- Bos ekran durumunda kullaniciya sessiz kirilma yerine hata durumu goster.
- Konsola anlamli log birak.

### Faz 2 - Performans ve UX Stabilitesi

Hedef: Arama ve MF ekranlarini daha akici hale getirmek.

1. Arama render batching
- Her depo cevabinda aninda full rerender yerine kisa aralikli toplu cizim yap.
- Ornek: 100-150ms aralikli throttle.

2. Sort ve dedupe maliyetini azalt
- Her response geldikce tum array'i tekrar tekrar sort etme.
- Son adimda veya throttled batch icinde sort uygula.
- Dedupe logic'ini tek merkezde calistir.

3. Quote latest-only mantigi
- Qty degisince eski quote akisini iptal et.
- Yalnizca son qty icin gelen sonuc ekrana yazilsin.

4. Concurrency limiti
- Canli fiyat sorgularinda tum teklifleri sinirsiz paralel cektirme.
- Ozellikle Selcuk, Nevzat ve Alliance icin sinirli paralellik kullan.

5. Event binding hijyeni
- Tekrar render edilen bolumlerde duplicate listener riskini azalt.
- Event delegation veya merkezi binding tercih et.

### Faz 3 - Kod Yapisi ve Bakim Kolayligi

Hedef: Degisiklik yapmayi daha guvenli hale getirmek.

1. `app.js` modulerlestirme
- `search.js`
- `stock-calc.js`
- `order-plan.js`
- `history.js`
- `settings.js`
- `ui-shell.js`

2. State merkezi
- Daginik global degiskenleri tek bir app state nesnesinde topla.
- State degisimleri kontrollu helper fonksiyonlariyla yapilsin.

3. Ortak render yardimcilari
- Para formati
- Toast/hata durumu
- Empty state gosterimi
- Loading state gosterimi

4. Encoding temizligi
- Bozuk Turkce metinleri runtime override yerine kaynak dosyalarda kalici duzelt.
- Tum dosyalari tutarli UTF-8 stratejisine cek.

### Faz 4 - Veri ve Altyapi Sertlestirme

Hedef: Veri katmanini daha dayanikli yapmak.

1. Config ve history caching
- Siklikla okunan config ve history verisini memory cache ile yonet.
- Yazmalari kontrollu flush modeliyle yap.

2. Depot login/session gozlemi
- Hangi depoda ne siklikla login yenileniyor kaydet.
- Session dusmeleri loglanirsa saha problemleri daha hizli bulunur.

3. Basit telemetry/logging
- Search basladi
- Search bitti
- Search fail
- Quote fail
- Startup fail

## Uygulama Oncelik Sirasi

## Tamamlanan Stabilizasyon Adimlari

- Selcuk search ve quantity fiyat akislari tek merkezden ayrildi:
  - `selcukBirim()` -> `netTutar`
  - `selcukMf()` -> `netTutar`
- Nevzat search ve quantity fiyat akislari tek merkezden ayrildi:
  - `nevzatBirim()` -> `netTutar`
  - `nevzatMf()` -> `netTutar`
- Alliance search ve quantity fiyat akislari tek merkezden ayrildi:
  - `allianceBirim()` -> `GrossTotal`
  - `allianceMf()` -> `GrossTotal`
- Alliance `SearchItems` eksik offer dondugunde `Sales/ItemDetail` icinden zengin item payload cekiliyor.
- Selcuk runtime isim eslesme sorunu kapatildi.
- Selcuk, Nevzat ve Alliance adapterlarinda `proxy: false` ile bozuk proxy ortamlarina karsi koruma eklendi.
- Bulk search qty=1 icin birim fiyat, qty=2+ icin normal arama planner mantigina cekildi.
- Bulk search live quote fallback cache kilidi kaldirildi; gecici hata sonrasi bulk satirlari tekrar canliya donebilir.

### Hemen Yapilacaklar

1. Search cancellation
2. Startup retry/health-check
3. `authFetch()` timeout ve standart hata modeli
4. Quote latest-only davranisi

### Kisa Vadede Yapilacaklar

1. Search render batching
2. Quote concurrency limiti
3. Event binding temizligi
4. Renderer global error reporting

### Orta Vadede Yapilacaklar

1. `app.js` modulerlestirme
2. State merkezi yapisi
3. Config/history cache
4. Encoding dosya bazli kalici temizlik

## Basari Kriterleri

1. Arama sonrasi bos beyaz ekran tekrar etmemeli.
2. Kullanici hizli arka arkaya arama yaptiginda eski sonuc yeni sonucu ezmemeli.
3. Electron acilisinda server gec kalksa bile uygulama bos ekran vermemeli.
4. MF ekraninda qty hizli degisse bile sadece son secimin fiyatlari gorunmeli.
5. Plan, arama, history ve settings akislari syntax veya event baglama kaynakli sessiz kirilmalar yasamamalı.

## Notlar

- `Depoya Git` davranisi Chrome tabanli kalmalidir.
- Electron icinde depo login kaliciligi guvenilir degildir.
- Alliance urun acilisi URL tabanli degil; bu konu stabilizasyon planindan ayri ele alinmalidir.
- UI asla canli quote sonucuna bagimli kalmamalidir; fallback veri her zaman gorunur kalmalidir.
