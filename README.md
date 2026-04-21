# TRPharma_price

## Guncel Teknik Notlar

- Selcuk:
  - Search / liste fiyati -> `selcukBirim()` -> `IlacFiyatHesapla` -> `netTutar`
  - MF / quantity fiyati -> `selcukMf()` -> `IlacFiyatHesapla` -> `netTutar`
- Nevzat:
  - Search / liste fiyati -> `nevzatBirim()` -> `IlacFiyatHesapla` -> `netTutar`
  - MF / quantity fiyati -> `nevzatMf()` -> `IlacFiyatHesapla` -> `netTutar`
- Alliance:
  - Search / liste fiyati -> `allianceBirim()` -> `CalculateItemTotals` -> `GrossTotal`
  - MF / quantity fiyati -> `allianceMf()` -> `CalculateItemTotals` -> `GrossTotal`

## Bulk Search Kurali

- Qty `1` iken bulk search normal arama gibi birim fiyat gosterir.
- Qty `1` iken satirda mevcut MF bilgisi yine gorunur; ancak fiyat batch mantigina gore dusurulmez.
- Qty `2+` iken bulk search normal aramadaki quantity/MF planner mantigina gecer.
- Ortak helperlar `renderer/scripts/app.js` icinde:
  - `buildUnitOptions()`
  - `getFallbackPlannerOptions()`
  - `resolvePlannerOptions()`
  - `getPlannerOptionDetailText()`

## Not

- Selcuk, Nevzat ve Alliance adapterlarindaki `proxy: false` kaldirilmamalidir; bazi sistemlerde bozuk proxy ayarlari depo baglantilarini dusurur.

## Midstage Mimarisi

- Aktif kod gelistirme alani: `D:\personal\eczane-app\midstage\current`
- Gelecek release/surum klasorleri: `D:\personal\eczane-app\midstage\releases`
- Root klasor `.md` hafiza, plan ve belge dosyalari icin korunur.

## Current-Modular Calisma Notu

- Refactor ve modul denemeleri icin klon calisma dizini:
  - `D:\personal\eczane-app\midstage\current-modular`
- Electron baslatma:
  1. `cd D:\personal\eczane-app\midstage\current-modular`
  2. `npm start`
- Hizli kontrol komutlari:
  - `npm run release:check`
  - `npm run mojibake:check`

## MF Hesaplama (Search Ekrani)

- Search ekranindaki MF Hesaplayici artik `qty` kurallarini planner zinciri ile ayni sekilde uygular:
  - fallback: `getFallbackPlannerOptions(items, qty)`
  - live: `resolvePlannerOptions(items, qty)`
- Satir detay metni tek yerden uretilir:
  - `getPlannerOptionDetailText(option, qty)`
- Boylece qty=1 ve qty>1 davranisi arasinda ekranlar arasi tutarlilik korunur.

## Root Klasor Duzeni

- Eski paketli surumler: `D:\personal\eczane-app\midstage\releases\legacy`
- Tarihsel debug loglari: `D:\personal\eczane-app\_archive\debug-logs`
- Gecici video/frame artefaktlari: `D:\personal\eczane-app\_archive\artifacts`
- Deneysel front calismalari: `D:\personal\eczane-app\_archive\experiments\front`

## V2.2 Modular Refactor Workspace

- Tam modulerlik icin yeni plan workspace'i: `D:\personal\eczane-app\midstage\2.2`
- 2026-04-19 itibariyla V2.2 runtime tabani dogrudan `D:\personal\eczane-app\midstage\current-modular` ustunden alinmistir.
- Bu alan `current-modular` gibi adapter-first degil, `copy-first migration` alani olarak tanimlandi.
- Ana kural: legacy kod okunur ama ilk extraction adiminda kaynaktan silinmez.
- Ornek olarak `renderer/scripts/app.js` icinden okunan kod ayni dosyada tasinmis sayilmaz; yeni hedef `midstage/2.2` altinda acilir.
- V2.2 plan belgeleri:
  - `midstage/2.2/README.md`
  - `midstage/2.2/V2_2_MODULAR_REFACTOR_PLAN.md`
  - `midstage/2.2/MODULE_MIGRATION_MAP.md`
- Beklenen son durum: `app.js` feature owner olmaktan cikacak, `index.html` bootstrap seviyesine inecek, feature ownership modullere dagilacak.

