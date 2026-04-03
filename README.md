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
