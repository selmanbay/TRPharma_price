# Release Notes - v2.1.2

Tarih: 2026-04-03

## Odak

Bu surum arama, toplu arama ve canli fiyat akislarini release kalitesine yaklastirmak icin stabilizasyon odakli hazirlandi.

## One Cikanlar

- Selcuk search ve quantity fiyatlari `netTutar` uzerinden normalize edildi.
- Nevzat search ve quantity fiyatlari `netTutar` uzerinden normalize edildi.
- Alliance search ve quantity fiyatlari `GrossTotal` uzerinden normalize edildi.
- Selcuk runtime isim eslesme sorunu kapatildi; listede kaybolma problemi giderildi.
- Bulk search qty `1` iken birim fiyat, qty `2+` iken normal aramadaki canli planner mantigi kullaniliyor.
- Bulk search satirlarinda kafa karistiran `al / gel` dili kaldirildi.
- Bulk search qty `2+` icin ana fiyat `Odenecek`, alt satir `Efektif birim` olarak netlestirildi.
- Basarisiz live quote denemelerinin fallback sonucu cache'e kilitlemesi engellendi.
- Arama bos ekran riski icin gecikmeli rerender korumasi eklendi.
- Plan secimi, plan ekleme ve plan detay silme akislari stabilize edildi.

## Teknik Notlar

- Selcuk, Nevzat ve Alliance adapterlarindaki `proxy: false` korunmalidir.
- `Depoya Git` davranisi Chrome tabanli kalir.
- Bulk ve normal arama fiyatlari ayni planner/quote zincirini kullanacak sekilde hizalanmistir.

## Release Oncesi Kisa Dogrulama

- Normal arama: `8683060010220`
- Nevzat/Alliance test barkodu: `8699522705009`
- MF davranisi icin: `8699522705160`
- Bulk qty `1` ve qty `2+` ayrimi manuel gorulmeli.
