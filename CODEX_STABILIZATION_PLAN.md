# Codex Stabilization Plan

Tarih: 2026-04-17
Proje: Eczane App
Aktif geliştirme odağı: `D:\personal\eczane-app\midstage\current-modular`

## Amaç

Bu planın amacı uygulamayı yalnızca "çalışıyor" seviyesinde değil, yoğun eczane operasyonunda saatlerce açık kaldığında da güvenilir kalacak seviyeye taşımaktır.

Ana hedefler:

- Uzun süre açık kalınca session/cookie timeout olsa bile uygulamanın kendini toparlaması
- Search, fiyat, MF ve plan akışlarının sessizce bozulmaması
- Frontend ve backend kopukluğu yaşandığında kullanıcıyı boş ekranda bırakmamak
- Electron açılış ve relaunch akışını kararlı hale getirmek
- Modüler yapıya geçerken çalışan feature parity'yi korumak

## Güncel Ana Riskler

### 1. Depot session / cookie timeout riski

Semptom:
- Uygulama uzun süre açık kalıyor
- Selçuk / Nevzat / Alliance gibi depo session'ları düşüyor
- Kullanıcı manuel refresh atmadan search/fiyat akışı düzelmiyor

Risk:
- Kullanıcı bunu "uygulama bozuldu" olarak yaşıyor
- Özellikle vardiya boyunca açık kullanımda kritik

### 2. Frontend-backend ayrışması

Semptom:
- Electron penceresi açık
- Backend düşmüş veya hiç kalkmamış
- UI var ama arama/fiyat/plan çalışmıyor

Risk:
- Kullanıcı sahte canlılık görüyor
- Hata anlaşılmadan tekrar tekrar işlem deniyor

### 3. Search sonuç bütünlüğü riski

Semptom:
- Bazı depolar eksik geliyor
- Canlı quote sonrası seçili depo resetlenebiliyor
- Arama state'i ve plan state'i birbirinden kopabiliyor

Risk:
- Yanlış depo seçimi
- Yanlış maliyet algısı
- Plan akışında güven kaybı

### 4. Plan senkronizasyon riski

Semptom:
- `Sipariş Planına Ekle` sonrası bazı bloklar yenilenmiyor
- Sol rail / aktif plan özeti / detay ekranı aynı state'i göstermiyor

Risk:
- Kullanıcı eklediğini anlamıyor
- Aynı ürünü tekrar tekrar ekliyor

### 5. Workspace modu UX riski

Semptom:
- Bilgiler ilk bakışta karar verdirici değil
- Fazla yatay yayılım var
- Workspace modu ayrı bir operasyon masası gibi davranmıyor

Risk:
- Klasik moddan daha kötü bir deneyim üretir
- Geliştirme maliyeti artar ama kullanıcı değeri oluşmaz

### 6. Electron instance / profile lock riski

Semptom:
- Relaunch sırasında stale AppData / singleton lock
- Electron açılmıyor ama backend açık kalabiliyor

Risk:
- Geliştirme ve saha ortamında "uygulama açılmıyor" şikayeti

### 7. Modüler geçişte feature parity kaybı

Semptom:
- `current-modular` içindeki bazı runtime dosyalar çalışan bazdan geri kalıyor
- Fiyat ve plan akışları parçalanıyor

Risk:
- Modüler mimari iyi niyetli ama kullanılamaz bir ürün üretir

## Stratejik Yaklaşım

Temel prensip:

1. Önce çalışan akışı koru
2. Sonra kendini toparlayan altyapı kur
3. Sonra modülerliği güvenli şekilde ilerlet
4. En son UX yoğunlaştır

Yani:
- önce resilience
- sonra observability
- sonra parity
- sonra optimization

## Faz 1 - Session / Cookie Resilience

Hedef: Depo session'ı düşünce kullanıcı refresh atmak zorunda kalmasın.

### 1.1 Depot-level session watchdog

Her depo adapterı için ortak davranış:

- request timeout
- login redirect tespiti
- auth fail tespiti
- cookie invalidation
- tek seferlik otomatik re-login
- aynı isteği bir kez daha dene

Bu davranış özellikle:
- `selcuk.js`
- `nevzat.js`
- `alliance.js`

içinde standartlaştırılmalı.

### 1.2 Session state sınıflandırması

Her depo için görünür state tutulmalı:

- `healthy`
- `refreshing`
- `expired`
- `failed`

UI tarafında:
- bağlı
- yeniden bağlanıyor
- oturum yenileniyor
- giriş gerekli

gibi sade durumlar gösterilmeli.

### 1.3 Silent self-heal

Kullanıcı search yaptığında:

- depo session expired ise arka planda login tazelensin
- request yeniden denensin
- kullanıcıya doğrudan fail değil, önce recovery denensin

### 1.4 Retry sınırları

Sonsuz retry olmayacak:

- session kaynaklı hata: 1 otomatik retry
- network kaynaklı hata: opsiyonel 1 retry
- sonra görünür hata durumu

## Faz 2 - Frontend / Backend Health Modeli

Hedef: "UI açık ama sistem ölü" durumunu ortadan kaldırmak.

### 2.1 Health endpoint ve heartbeat

Backend için net health yüzeyi:

- `/api/health`
- server ready durumu
- auth middleware erişilebilirliği
- depot init sonucu

Renderer tarafı:
- belirli aralıkta değil, gerektiğinde heartbeat
- arama öncesi ve kritik aksiyonlarda hafif health check

### 2.2 Backend disconnected state

Eğer backend erişilemiyorsa:

- search input pasif hale getirilmeyecek ama uyarı verilecek
- kullanıcıya:
  - `Bağlantı yeniden kuruluyor`
  - `Tekrar Dene`
  - gerekirse `Uygulamayı Yeniden Başlat`

sunulacak

### 2.3 Startup sertleştirme

Electron açılışında:

- server hazır olana kadar kontrollü retry
- sabit bekleme yerine health-check
- başarısızsa görünür startup error card

## Faz 3 - Search / Pricing Consistency

Hedef: Her aramada tüm uygun depolar gelsin, canlı fiyat akışı seçimi bozmasın.

### 3.1 Search cancellation ve latest-only

- Eski arama sonuçları yeni aramayı ezmemeli
- eski quote cevapları yeni seçimi bozmamalı
- aktif request kimliği mantığı standart hale getirilmeli

### 3.2 Depot completeness guard

Her search sonunda kontrol:

- beklenen depolar
- cevap veren depolar
- hata veren depolar

Eksik depo varsa:
- logla
- UI'da sessizce yutma
- gerekiyorsa `bazı depolar şu an cevap vermiyor` notu göster

### 3.3 Pricing parity tests

Her depo için iki resmi senaryo korunmalı:

- birim fiyat
- MF / quantity fiyatı

Özellikle:
- Selçuk: `netTutar`
- Nevzat: `netTutar`
- Alliance: `GrossTotal`

Bu kurallar regression test altına alınmalı.

## Faz 4 - Plan State Consistency

Hedef: Kullanıcı bir ürünü seçtiğinde, plan eklediğinde ve planı düzenlediğinde tüm yüzeyler aynı şeyi göstermeli.

### 4.1 Tek kaynak state ilkesi

Plan için merkezi state:

- mini plan rail
- home aktif plan kartı
- order plan detay ekranı
- workspace selected offer

aynı normalize edilmiş veri kaynağından beslenmeli.

### 4.2 Refresh contract

Şu aksiyonlardan sonra zorunlu rerender:

- `Plana Seç`
- `Sipariş Planına Ekle`
- adet değiştir
- depo değiştir
- sil

Rerender hedefleri:

- plan rail
- home order plan
- order plan detail
- workspace badges

### 4.3 Plan regression suite

En az şu testler:

- arama sonucundan plan ekleme
- seçili depo değiştirip plan ekleme
- MF aktifken plan ekleme
- plan ekranında adet değiştir
- plan ekranında depo değiştir

## Faz 5 - Workspace Mode Re-Architecture

Hedef: Workspace modu gerçekten karar verdiren operasyon ekranı olsun.

### 5.1 İlk ilke

Workspace modu klasik ekranın sadece genişletilmiş hali olmayacak.

İlk bakışta görünmesi gerekenler:

- aranan ürün
- seçili teklif
- alternatif teklifler
- aktif plan etkisi

### 5.2 Ekran önceliği

Workspace ilk fazda sadece şu iki akışı optimize edecek:

- search
- plan

Bulk daha sonra ele alınacak.

### 5.3 Operasyon masası yapısı

- sol mini plan rail
- orta arama ve teklif alanı
- sağ drawer sadece gerektiğinde

Kaldırılacak veya küçültülecek:

- gereksiz büyük hero
- büyük tek teklif kartları
- tam ekran loading alanları

### 5.4 Workspace kalite kriteri

Workspace modu şu üç metriğe göre kabul edilmeli:

1. daha az scroll
2. daha kısa göz hareketi
3. daha hızlı depo kıyası

## Faz 6 - Observability ve Otomasyon Test

Hedef: Sorun olduğunda tahmin değil kanıtla ilerlemek.

### 6.1 Runtime diagnostics

Toplanacak olaylar:

- search started / completed / failed
- depot missing
- depot session refreshed
- quote failed
- plan add failed
- backend disconnected
- startup failed

### 6.2 Electron UI test altyapısı

`current-modular` için:

- Playwright + Electron smoke tests
- sahte veri / test modu
- `data-testid` yüzeyleri

İlk test paketleri:

- launch
- history
- search
- add to plan

### 6.3 Snapshot / artifact

Test fail olduğunda:

- screenshot
- console errors
- network errors
- app diagnostics

saklanmalı.

## Faz 7 - Modülerleşme Disiplini

Hedef: `current-modular` içinde modülerlik ile çalışma kararlılığı birlikte yürüsün.

### 7.1 Çalışan runtime kuralı

Yeni modüler refactor ancak şu koşulla kabul edilmeli:

- çalışan `current` ile feature parity korunuyorsa

### 7.2 Adapter-first geçiş

Doğru sıra:

1. çalışan legacy davranışı koru
2. modülü adapter ile bağla
3. testle doğrula
4. sonra legacy kısmı küçült

### 7.3 Güvenli modüler geçiş alanları

Önce:

- shared helpers
- settings
- history
- workspace shell

Sonra:

- search core
- pricing core
- order plan mutations

## Hemen Yapılacaklar

1. Depot session auto-refresh standardı
2. Backend health / heartbeat modeli
3. Search cancellation + latest-only
4. Plan rerender contract'ını garantiye alma
5. `current-modular` için Electron UI smoke test altyapısı

## Kısa Vadeli Yapılacaklar

1. Workspace search ekranını operasyon masası mantığına göre yeniden kurma
2. Depot completeness logging
3. Runtime diagnostics buffer genişletme
4. History / plan / search testleri

## Orta Vadeli Yapılacaklar

1. `current-modular` search/pricing/order-plan modül geçişi
2. Config/history cache ve async flush
3. Encoding kalıcı temizlik
4. Startup / relaunch stabilizasyonu

## Yeni Mimari Ekseni - Account-Based Gecis

Bu plan ilk olarak stabilizasyon odakli yazildi, ancak 2026-04-18 itibariyla bir ust mimari yon netlesti:

- uygulama account-based veri modeline gececek
- depo auth bilgileri kalici uygulama verisi olarak modellenmeye baslanacak
- config tabanli mevcut sistem kademeli migration ile tasinacak

Bu eksende yapilacak isler:

1. Veri modeli tasarimi
2. Entity ve iliski tasarimi
3. Server route ve auth scope tasarimi
4. Session/cookie/token artefact'larinin gecici ama izlenebilir katmana alinmasi

Ilk kavramsal ayrim:

- `Account`
- `User`
- `DepotConnection`
- `DepotSession`
- `OrderPlan`
- `SearchHistory`
- `PurchaseHistory`

Kritik prensip:

- `DepotConnection` ile `DepotSession` ayrik olmali
- connection = kalici credential / ayar / sahiplik
- session = yenilenebilir cookie / token / auth state

Bu migration ancak asamali yapilirsa guvenli olur.

## Başarı Kriterleri

1. Uygulama saatlerce açık kalsa bile depo session'ı düşerse kendi kendini toparlayabilmeli.
2. Kullanıcı manuel refresh atmadan search ve fiyat akışı geri gelebilmeli.
3. Frontend açık backend kapalı durumu görünür ve yönetilebilir olmalı.
4. Search sonuçlarında beklenen depolar eksikse bu sessizce kaybolmamalı.
5. Plan ekleme sonrası tüm ilgili bloklar anında senkron güncellenmeli.
6. Workspace modu klasik moddan daha verimli hissettirmeli; daha kötü veya eşdeğer olmamalı.
7. `current-modular` içinde temel smoke testler otomasyonla doğrulanabilmeli.

## Notlar

- `Depoya Git` davranışı Chrome tabanlı kalmalı.
- UI hiçbir zaman tek başına canlı quote sonucuna bağımlı bırakılmamalı; fallback veri her zaman görünür olmalı.
- `current-modular` aktif geliştirme alanı olsa da, feature parity kaybı olduğunda çalışan bazdan kontrollü senkron yapmak kabul edilen geçici yöntemdir.

## V2.2 Modulerlik Uygulama Modeli - 2026-04-19

Bu planin ustune yeni bir uygulama modeli eklendi:

- `current-modular` tarihsel adapter-first deneme olarak korunur
- tam modulerlik extraction hedefi `midstage/2.2` altinda yurutulur

V2.2'nin farki sudur:

- legacy owner dosyayi hemen kesip tasimaz
- once kaynagi okur
- sonra yeni modulu ayri path'te acar
- parity gorulmeden eski owner'i silmez

Bu nedenle tam modulerlik icin yeni operasyon kurali:

1. `renderer/scripts/app.js`, `renderer/index.html`, `renderer/src/main.js` read-source kabul edilir
2. yeni feature owner adaylari yalniz `midstage/2.2/**` altina yazilir
3. ilk extraction turunda delete/cut yapilmaz
4. sonraki turda yalniz bridge eklenir
5. en son legacy owner kucultulur

Bu model ozellikle `app.js neden hala buyuk` sorusuna cevap vermek icin secildi: buyuk dosya once aynalanacak, sonra ownership aktarilacak, en son temizlenecek.

## V2.2 Uygulama Notu - 2026-04-19

Bu model artik teorik degil, `midstage/2.2` altinda calisan baseline olarak baslatildi.

Bugunku somut durum:

- 2.2 ayri runtime klasorune sahip
- standalone server smoke check gecti
- ilk modular bridge storage + product identity alaninda aktif

Bu da stabilizasyon ile modulerligi ayni hatta getirmek icin onemli: V2.2 artik sadece plan klasoru degil, gercek uygulama workspace'i.

## V2.2 Test Arayuzu Ekseni - 2026-04-19

Stabilizasyonun yeni bir alt ekseni daha netlesti:

- backend smoke testleri terminalden kolay kosulabilmeli
- frontend diagnostic olaylari test session bazli toplanabilmeli

Bu hedefin canonical plani:

- `midstage/2.2/TEST_INTERFACE_PLAN.md`

Bu eksen, ileride smoke automation ve CI benzeri akislara da kapı acacak.
