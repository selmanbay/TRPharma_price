# AI Agent Handoff

Tarih: 2026-04-03

## Su Anki Durum

- Versiyon: 2.1.1
- Git durumu: Worktree dirty, kullanicinin ve onceki turların degisiklikleri var
- Electron: Kod degisikliklerinden sonra restart edilmeli
- Oncelik: Arama sonucu teklifi ve MF fiyatlari stabil gostermek

## Bu Turda Yapilan Teknik Isler

1. Varsayilan plan secimi en ucuz teklif olacak sekilde korunuyor.
2. Teklif listesine ayri `Plana Sec` butonu eklendi.
3. Satir tiklama ve buton tiklama ayni secimi yapacak sekilde birlestirildi.
4. Gorunen `TL`/metin bozukluklari temizlenmeye baslandi.
5. MF panelinde fallback liste hemen ciziliyor, sonra varsa canli fiyat ile rerender yapiliyor.
6. Selcuk, Nevzat ve Alliance canli quote altyapisi backend tarafinda hazir.
7. Selcuk fiyat akisi `selcukBirim()` / `selcukMf()` olarak ayrildi; karar alani `netTutar`.
8. Nevzat fiyat akisi `nevzatBirim()` / `nevzatMf()` olarak ayrildi; karar alani `netTutar`.
9. Alliance fiyat akisi `allianceBirim()` / `allianceMf()` olarak ayrildi; karar alani `GrossTotal`.
10. Alliance eksik `Offers` durumunda `Sales/ItemDetail` parse edilerek gercek `ItemString` ile fiyatlandirma yapiliyor.
11. Bulk search qty=1 icin birim fiyat, qty=2+ icin normal arama planner mantigi aktif.
12. Bulk search detay satirinda `al / gel` dili kaldirildi; qty>1 ozeti `Hedef X adet · MF Y+Z`.
13. Bulk live quote basarisiz olursa fallback yine gorunur, fakat fallback artik cache'e kalici yazilmaz.

## Sonraki Agent Icin Kritik Notlar

- `renderer/scripts/app.js` icinde `renderDetailResults()` ve `renderStockCalc()` ana risk alanlari.
- Arama sonucu ekrani bos gorunurse ilk bakilacak yer syntax hatasi veya bozuk template string olmalidir.
- `POST /api/quote-option` sadece canli quote katmanidir; ekran bu endpoint'e bagimli olmamali.
- `Depoya Git` Chrome tabanli kalmali, Electron icine tasinmamali.
- `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY` bozuk olabilir; Selcuk/Nevzat/Alliance icin `proxy: false` kritik.
- Bulk search tarafinda qty=1 iken MF fallback acilmasi bug kabul edilir.
- Bulk search qty=1 iken MF bilgisi gorunur ama fiyat birim fiyat olarak kalir.
- Bulk search qty>1 iken ana fiyat `Odenecek`, alt satir `Efektif birim` olarak okunur.
- Selcuk/Nevzat/Alliance live quote gorunmuyorsa ilk bakilacak yer `fetchQuotedOption()` cache davranisidir.

## Beklenen Dogru Davranis

- Arama sonucu gelir gelmez depo teklifleri tablosu gorunmeli.
- En ucuz teklif default secili olmali.
- Kullanici baska bir satiri veya `Plana Sec` butonunu tiklarsa secim degismeli.
- `Siparis Planina Ekle` secili depoyu ve secili miktari kullanmali.
- MF paneli hicbir durumda bos kalmamali; en az fallback tekliflerini gostermeli.
- Bulk search qty=1 iken satirlar kampanyali batch degil birim fiyat gostermeli.
- Bulk search qty=1 iken satir detayi mevcut MF bilgisini de gostermeli.
- Bulk search qty=2+ iken satirlar normal aramadaki quantity/MF canli fiyat mantigina gecmeli.
## Guncel Ek Not - 01:28

1. Arama sonucu bazen bos beyaz ekran verme bug'i icin gecikmeli rerender korumasi eklendi.
2. Config/depo durumu yukleme hatasi sessiz kirilma yerine kontrollu akisla ele alindi.
3. Eksik kalan `addPlannerOptionToOrderPlan` ve `removeOrderPlanItem` fonksiyonlari geri eklendi.
4. `Siparis Planina Ekle` butonlari tekrar merkezi plan kayit akisina baglandi.
5. Siparis plani miktar mantigi sadeletirildi; plan artik kullanicinin istedigi adedi saklar ve gosterir.
6. Plan detay ekranindaki kartlar tiklanabilir hale getirildi; detay ekrana da `Sil` butonu eklendi.
7. Login/setup ve bazi gorunen Turkce metinler runtime tarafinda duzeltildi.

## Fiyat Sorgulama ve MF Hesaplama Kurallari (HER EKRAN ICIN GECERLI)

### Fiyat sorgulama
- Her depo kendi live quote metodunu kullanir. Bazi depolar (orn. Selcuk) `/api/quote-option` endpoint'i uzerinden gercek zamanli fiyat doner; digerleri statik fiyatla kalir.
- Hangi ekran olursa olsun (tekli arama, toplu arama, MF hesaplayici) fiyat gosterimi su akisi izlemelidir:
  1. `calcMfOptions(items, qty)` -> fallback (statik) fiyatlarla aninda render
  2. `resolveQuotedOptions(items, qty)` -> tum depolar icin live quote dene, degisiklik varsa re-render
- ASLA tek bir item ile `calcMfOptions([item], qty)` cagrisi yapmak yeterli degildir -- bu live quote'u atlar.
- `fetchQuotedOption(item, option, qty)` -- tek bir depo icin live quote + MF birlesimi, cache'li.

### MF hesaplama
- `calcMfOptions(items, qty)` her depo icin `orderQty / receiveQty / effectiveUnit / totalCost` alanlarini dogru hesaplar.
- Satirda gosterilecek fiyat her zaman `effectiveUnit` (etkin birim fiyat), toplam her zaman `totalCost`'tur.
- Ham `item.fiyatNum * qty` gibi manuel carpim YAPILMAMALIDIR -- MF kirilimini yansitmaz.
- MF detayi gosterilirken: `opt.orderQty` (siparis) ve `opt.receiveQty` (gelen) ayri belirtilmeli.
