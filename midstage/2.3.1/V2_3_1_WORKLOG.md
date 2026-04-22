# V2.3.1 Worklog

## 2026-04-21

### Baslangic Temizleme

- `midstage/2.3` klasoru `midstage/2.3.1` olarak ayirildi.
- Runtime metadata yeni surume cekildi:
  - `package.json`
  - `main.js`
- `mock.html` yeni entrypoint zincirine baglandi:
- `index.html` latest shell entry olarak ayrildi.
- `main.js` artik `index.html` yukluyor.
- `package.json` check script'i `renderer/scripts/app.js` uzerine cekildi.
- `app.js` latest orchestrator entry olarak ayrildi.
- avatar/logout davranisi yerine kullanici menusu eklendi:
  - `Ayarlar`
  - `Depo durumlarini yenile`
  - `Cikis yap`
- `navigation-runtime.js` profil ad/harf alanini yeni menu id'leri uzerinden guncelliyor.
- `mock.html` yeni entrypoint zincirine baglandi:
  - `runtime-coordinator.js` eklendi
  - `app-v231.js` latest orchestrator olarak tanimlandi
- `app-v231.js` olusturuldu:
  - `app-v23.js` baz alinip `2.3.1` entrypoint olarak ayrildi
  - dynamic domain import path'leri `../src/domain/*` olacak sekilde duzeltildi
- `README.md` yeni mimari hedefe gore guncellendi.

### Not

- `app-v23.js` su an legacy referans dosyasi olarak tutuluyor.
- Hedef, `2.3.1` icinde owner modulleri koruyup orchestrator'u adim adim inceltmek.

## 2026-04-22

### Action owner ayrisma turu

- `renderer/scripts/search-actions.js` eklendi:
  - `runSearch`
  - `openVariantDetail`
  - `bulkSearch`
  - `renderHistoryEntry`
- `renderer/scripts/detail-actions.js` eklendi:
  - detail teklif/plana ekle akislari
  - bulk-detail secim/plana ekle akislari
  - gecmisten arama ve bulk'a geri donus akislari
- `renderer/scripts/plan-actions.js` eklendi:
  - plan preview
  - depoda ac / url guvenligi
  - plan qty / alternative secimi
- `renderer/scripts/app-actions.js` yeniden yazildi:
  - ortak qty/drawer/settings/compat/titlebar aksiyonlarini tutan ince aggregator oldu
  - search/detail/plan owner modullerini birlestiriyor
- `renderer/index.html` script zinciri yeni action owner modullerini yukleyecek sekilde guncellendi.
- `renderer/scripts/app-v23.js` ve `renderer/scripts/app-v231.js` aktif entrypoint olmaktan cikarildi:
  - ikisi de artik yalnizca retire/ref marker dosyasi
  - canli entrypoint `renderer/scripts/app.js`
