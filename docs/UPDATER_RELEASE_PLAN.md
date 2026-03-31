# Eczane App 2.0.2 Updater Plani

Bu dokuman, Electron auto-update zincirinin nasil calistigini ve `2.0.2` surumunun nasil yayinlanacagini netlestirmek icin yazildi.

## 1. Hedef

Amaç:

- Masaustundeki kurulu `Eczane` uygulamasi yeni surumu algilasin
- GitHub release uzerinden update metadata ve installer dosyalari indirilebilsin
- Kullaniciya "update bulundu / indirildi / yeniden baslat" akisi gosterilsin

## 2. Bu projede updater nasil calisir

Bu projede `electron-updater` kullaniliyor.

Temel zincir:

1. Uygulama acilir
2. `main.js` icinde `autoUpdater.checkForUpdatesAndNotify()` veya benzeri kontrol calisir
3. Uygulama, build icine gomulu `publish.github` ayarindan repo bilgisini okur
4. GitHub tarafinda yeni bir `release` ve ona bagli updater dosyalari varsa kontrol eder
5. Daha yeni surum varsa paketi indirir
6. Indirme tamamlaninca kullaniciya yeniden baslatma oneri verir

## 3. Sadece push neden yetmez

Kaynak kodu `git push` ile GitHub'a gondermek tek basina update icin yeterli degildir.

Updater genelde sunlari bekler:

- yeni `version`
- yeni build
- GitHub `release`
- release icinde updater metadata dosyasi
- release icinde kurulum dosyasi veya ilgili paketler

Yani:

- `push` = kaynak kodu gunceller
- `release` = updater'in gorecegi dagitim noktasini olusturur

## 4. 2.0.2 Release Akisi

Bu surum icin onerilen akış:

1. `package.json` icinde surumu `2.0.2` yap
2. Kod degisikliklerini commit et
3. `main` branch'ine push et
4. `GH_TOKEN` ortamina tanimli olacak sekilde release build al
5. `electron-builder`, GitHub release ve asset yuklemesini yapsin
6. Kurulu `2.0.1` uygulamasi acildiginda `2.0.2`yi gorup indirsin

## 5. Kullanilacak Komutlar

Yerel build:

```powershell
npm run build:win
```

GitHub release ile publish:

```powershell
$env:GH_TOKEN="github_token_buraya"
npm run release:win
```

## 6. Beklenen Ciktılar

Release sirasinda tipik olarak su dosyalar uretilir:

- `Eczane Setup 2.0.2.exe`
- `latest.yml`
- gerekiyorsa blockmap dosyalari

Updater acisindan en kritik dosya `latest.yml` ve release asset'leridir.

## 7. Uygulama Icindeki Davranis

2.0.2 ile hedeflenen runtime davranisi:

- update kontrolu yalnizca packaged uygulamada calissin
- update bulunursa loglansin
- indirme ilerlesin
- indirme bitince kullaniciya "Simdi yeniden baslat" sorusu gosterilsin

## 8. Test Senaryosu

`2.0.1` kurulu makinede:

1. `2.0.2` release publish edilir
2. `2.0.1` uygulamasi acilir
3. Bir sure sonra update kontrolu calisir
4. Update bulunduysa indirme baslar
5. Indirme tamamlaninca yeniden baslatma penceresi gelir
6. Uygulama yeniden acildiginda `2.0.2` olur

## 9. Riskler

- Sadece source push yapilip release alinmazsa update gelmez
- `GH_TOKEN` yoksa publish tamamlanmaz
- version artmazsa updater yeni surum gormez
- GitHub release asset'leri eksikse updater zinciri kirilir

## 10. Operasyonel Check-list

Release oncesi:

1. `package.json` version dogru mu
2. `main.js` updater olaylari packaged modda mi
3. `npm run build:win` lokal build geciyor mu
4. `GH_TOKEN` tanimli mi

Release sonrasi:

1. GitHub releases ekraninda `2.0.2` gorunuyor mu
2. `latest.yml` yuklendi mi
3. `Eczane Setup 2.0.2.exe` yuklendi mi
4. `2.0.1` uygulamasi yeni surumu buluyor mu
