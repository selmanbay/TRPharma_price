# V2.3.1 Clean Modular Workspace Shell

Bu klasor, `V2.3` uzerinde biriken monolith entrypoint sorunlarini temizleyip
uygulamanin son halini daha net owner modullerle tasimak icin acildi.

Ana hedef:

- `midstage/2.3` = gecis/runtime referansi
- `midstage/2.3.1` = latest clean modular runtime

Ana kurallar:

- `midstage/2.2` bozulmaz; backend/API kontrati referans kalir.
- `midstage/2.3.1` ayri bir runtime ve ayri `userData` yolu ile calisir.
- Owner mantigi korunur:
  - domain hesap = domain owner
  - HTML string = UI owner
  - auth/bootstrap/nav/action = runtime owner
  - `app.js` = ince orchestrator
- Mockta gorunmeyen featurelar silinmez; ya gizli compat yuzeyi olarak ya da davranis seviyesinde korunur.

## Kapsam

V2.3 ilk surumde sunlari hedefler:

- login
- home dashboard
- search variants
- search detail workspace
- bulk search
- order plan
- depot settings

Korunan ama ana UI'da one cikarilmayan alanlar:

- test / diagnostic / update
- cookie / token / session tabanli depot akislari
- barkod arama
- autocomplete
- quote / canli fiyat endpointleri

## Calistirma

- `cd D:\personal\eczane-app\midstage\2.3.1`
- `npm start`

## Dosya Yaklasimi

- `main.js`, `preload.js`, `src/*`: runtime, security ve backend kontratini korur.
- `renderer/index.html`: shell entry HTML.
- `renderer/scripts/app.js`: V2.3.1 orchestrator entrypoint.
- `renderer/scripts/search-actions.js`, `detail-actions.js`, `plan-actions.js`: action owner modulleri.
- `renderer/scripts/app-actions.js`: action owner'lari toplayan ince aggregator.
- `renderer/scripts/*-ui.js`: input -> markup owner moduller.
- `renderer/scripts/*-domain.js`: search/offer/plan hesap owner moduller.
- `renderer/scripts/*-runtime.js`: auth/bootstrap/nav/action owner moduller.
- `renderer/scripts/runtime-coordinator.js`: cross-surface coordination helper.
- `src/config-store.js`, `src/account-store.js`: onceki runtime verilerini import eder.

## Entry Zinciri

`index.html` script yukleme sirasi:

1. `utils.js`
2. `runtime-coordinator.js`
3. security/runtime/domain/ui/action owner modulleri
4. `app.js`

Bu zincirde `app-v23.js` ve `app-v231.js` artik latest runtime entrypoint degildir;
sadece gecmis referans isareti olarak tutulur.

## Uyumluluk

V2.3 ilk acilista su legacy kaynaklardan veri okuyabilir:

- proje ici `config.json`
- `midstage/current-modular/config.json`
- `C:\Users\<user>\AppData\Roaming\eczane-app-v2_2\config.json`
- `C:\Users\<user>\AppData\Roaming\eczane-app-v2_2\data\local-accounts.json`

Bu sayede kullanici yeni shell'i denerken depo baglantilarini yeniden girmek zorunda kalmaz.
