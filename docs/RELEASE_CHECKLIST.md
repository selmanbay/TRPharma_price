# Release Checklist

## Paket ve Build

- `package.json` version release etiketi ile uyumlu mu
- `npm run release:check` temiz geciyor mu
- `build.win.publish` GitHub hedefi dogru mu
- `author`, `productName`, `appId` alanlari dolu mu

## Fonksiyonel Kontrol

- Normal arama fiyatlari dogru
- Bulk arama qty `1` dogru birim fiyat gosteriyor
- Bulk arama qty `2+` canli quote ile guncelleniyor
- Selcuk satiri listede gorunuyor
- Nevzat ve Alliance canli fiyatlari geliyor
- Plan secimi ve plana ekleme calisiyor
- Plan detay ekraninda kart acma ve silme calisiyor
- `Depoya Git` Chrome ile aciliyor

## Release Riskleri

- Uygulama su anda code signing olmadan build aliyorsa Windows SmartScreen uyarisi beklenir
- `renderer/scripts/app.js` hala buyuk; release sonrasi modulerlestirme planlanmali
- Eski dokumanlarda ve bazi dosyalarda mojibake kalintisi olabilir

## Onerilen Son Komutlar

- `npm run release:check`
- `npm run build:win`

## Manuel Test Barkodlari

- `8683060010220`
- `8699522705009`
- `8699522705160`
