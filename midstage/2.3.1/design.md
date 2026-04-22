This is clearly benign UI code (HTML mockup with inline styles). The user is asking for analysis + specification, not code changes — which is permitted. Let me continue reading.

Now let me scan the JS to understand UI state hooks — I'll sample key sections rather than read the whole file.

Kod okumayı bitirdim. Aşağıda, başka bir oturumun doğrudan uygulayabileceği dosya-bazlı, sınıf-bazlı, state-bazlı spec yer alıyor. Her öneri mevcut DOM/JS ile uyumlu; hiçbiri iş akışını (plan/search/MF/drawer) değiştirmiyor.

---

# 0) Tespit: İki paralel stil sistemi

Bu projenin kalitesini düşüren asıl yapısal sorun tek, görünmez: **iki farklı tasarım sistemi aynı anda yüklü.**

| | `mock.html` içindeki `<style>` bloku | `mock.css` (dış dosya) |
|---|---|---|
| Brand | `--brand-500: #6366f1` (indigo) | `--brand-500: #e11d48` (rose) |
| Font UI | `Inter` | `Plus Jakarta Sans` |
| Font display | `Outfit` | — |
| `--navbar-h` | 64px | 60px |
| `--titlebar-h` | yok | 36px |
| `--radius-sm` | 8px | 6px |
| Page transition | `slideUpFade 0.3s (0.16,1,0.3,1)` 8px | `fadeIn 0.2s ease-out` 4px |
| Shadow scale | `--shadow-sm/card/hover/glass/drawer` | `--shadow-flat/card/pop/drawer` |
| Depot stili | `.depot-label .depot-dot` | `.depot-badge.depot-selcuk` |

`mock.css` `<link>` ile `<style>`'dan **sonra** yüklendiği için üstüne biniyor; ama `mock.css` her class'ı tanımlamadığı için çoğu render yine inline değişkenleri kullanıyor. Sonuç: brand rengi bir yerde indigo, bir yerde rose; `.depot-badge*` kuralları runtime'da **tamamen ölü kod** çünkü `scripts/app-v23.js` `depotBadgeHtml()` fonksiyonu **daima** `<span class="depot-label {cls}"><span class="depot-dot"></span>…` formatını üretiyor (bkz. `scripts/app-v23.js:234-237`).

Bu tekilleştirilmeden yapılan her iyileştirme yine tutarsız görünür. **Spec'in Faz 1'i bu birleşmedir.**

---

# 1) Genel Tasarım Değerlendirmesi

## Güçlü yanlar (korunmalı)
- Tipografi hiyerarşisi mantıklı: display font (`Outfit`) → UI font (`Inter`) → mono (`JetBrains Mono`) için fiyat. **Bu ayrımı koru, paraya `var(--font-mono)` kullanımı operasyon aracı hissinin en güçlü tarafı.**
- Depot renk kodlaması (6 farklı depot = 6 farklı hue) — bilgi taşıma açısından çok değerli, sadece aşırı `box-shadow glow` ile ucuzluyor.
- Split layout (search sidebar + main + plan özeti) doğru bir desktop-first tercih; korunmalı.
- `row-best` / `row-highlight` yeşil vurgu fikri doğru — ama uygulama ucuz (düz `var(--mint-50)`).

## Zayıf yanlar (dokunulması gereken)
- **Brand rengi tutarsız** (bkz. §0).
- `mock.html` içindeki `product-hero` `linear-gradient` arka plan + JS'in inline-style'sız ürettiği `.product-hero` beyaz arka plan çakışıyor. JS tarafındaki versiyon kazanıyor ve düz beyaz hero çıkıyor.
- **Hero'daki ikon kutusu** hem `border: 1px dashed var(--ink-300)` hem de `add_a_photo` ikonuyla "boş state" hissi veriyor — detay ekranı her zaman bu şekilde göründüğü için ekran daima "henüz yüklenmemiş" gibi duruyor. Bu tek şey premium hissini en çok düşüren unsur.
- MF calculator'da **iki ayrı tasarım** var: `mock.html`'deki siyah panel (`.mf-calc-wrap .mf-calc-inner`, dark ink-900, cubic-bezier slide-open, unused) ve JS'in ürettiği beyaz `.mf-calculator` (transitionsız, sadece re-render). Uygulamada beyaz olan görünüyor, siyah olan ölü kod.
- **Drawer overlay animasyonu bozuk**: `mock.css:207` `display: none → block` ile opacity transition tetiklenmiyor; ilk açılış "pat diye" gri oluyor. `mock.html:224` inline versiyonu `pointer-events + opacity` kullanıyor — doğru olan o ama JS drawer'ları `edit-drawer-overlay`/`bulk-drawer-overlay` üzerinde çalışıyor ve bunlar `mock.css` kuralına düşüyor.
- `.variant-item:hover { transform: translateY(-1px) }` ve `.variant-card:hover { translateY(-2px) }` — yoğun veri listesinde **çok fazla hareketleniyor**, masaüstü operasyon aracı için şişirme (bouncy) his veriyor.
- Plan sayfasında tüm açılır panel `.plan-item-group` görünür halde — "accordion" animasyonu mock.html'de var ama JS `renderPlanPage` accordion sınıfı (`.plan-accordion`) değil, `.plan-item-group` üretiyor; animasyon uygulanmıyor.
- **Focus ring sistemi yok.** Sadece `.input:focus { box-shadow: 0 0 0 3px var(--brand-50) }`. `.btn`, `.btn-icon`, link-like divler için keyboard focus belirsiz.
- Loading / empty / skeleton yapısı hiç yok. Search başladığında ekran boş kalıyor → render edildiğinde aniden doluyor. Bu en yüksek “AI slop” riski.
- Search suggestions `bindTopNav()` içinde **inline style string** olarak üretiliyor (`scripts/app-v23.js:1708`) — class yok, hover yok, klavye navigasyonu yok.
- Inline `style=""` yoğunluğu (özellikle home + settings) token değişimini imkânsız kılıyor; CSS'i yeniden yazmak bile renderı değiştirmiyor.

## Premium hissi düşüren ilk 5 alan (öncelik sırasıyla)
1. **Brand/token fragmentasyonu** — tek sistem değil.
2. **Detail page product-hero** — dashed ikon + düz beyaz = prototip hissi.
3. **Depot renk uygulaması** — `box-shadow` glow'lar renk ayarlarını ucuzlatıyor; `depot-dot` 10px top, yer yer 12px.
4. **MF hesaplayıcı açılış geçişi yok** — toggle `re-render` yapıyor, DOM'a pat diye giriyor.
5. **Drawer overlay ilk blink'i** — `display` transition'ı + drawer eğrisinin ayrı hızı dengesiz.

---

# 2) Görsel Yön

## Seçilen yön
**"Operasyon konsolu"** — Linear / Notion desktop / Bloomberg ışık modu karışımı. Mat renkler, düşük doygunluk, yüksek kontrast tipografi, neredeyse hiç gradient, shadow katmanları yumuşak ve sabit iki seviyede. Brand (indigo) sadece **seçili / aksiyon / focus** durumlarında kullanılır; pasif UI'de **saf nötr** (ink serisi) egemen.

## Korunacak tonlar
- `--ink-50/100/200/900` (inline HTML varyantı — slate tabanlı, `#0f172a` ink-900 daha derin ve profesyonel)
- `--brand-500: #6366f1` indigo (mock.html'deki) → kurumsal, doktor/eczacı kitlesinde rose'dan daha "araç", daha az "tüketici"
- Depot hue'ları mevcut (6 renk) korunur; **sadece dot box-shadow glow'lar kaldırılır**, yerine 2px solid ring
- `--mint-500` = pozitif (en uygun, connected, success)
- `--amber-500` = dikkat (refresh, stok düşük)
- `--rose-500` = hata (disconnected, no match)

## Sakinleştirilecek alanlar
- Home dashboard "Toplu Arama Banner" (`mock.html:376`): `linear-gradient(135deg, ink-800, ink-900)` + 56px glass-circle + blur — **tek başına bu element tüm home'u alt ediyor.** Ya %60 daralt, ya yüzeyini düz `var(--ink-900)` yap ve glass daire yerine küçük bir icon pill kullan.
- Login screen (`mock.html:137-140`): iki adet 600/800px radial-gradient "bokeh" — minimal bir Linear-style dikey desen yeterli.
- `box-shadow: 0 0 6px rgba(depot, 0.4)` depot-dot glow'ları — 0.
- `.btn-brand:hover { transform: translateY(-1px) }` — masaüstünde kaldır, sadece renk/shadow.

## Güçlendirilecek alanlar
- Detail page **product-hero**: ikon kutusu dashed yerine **1px solid `--ink-200` + hafif iç gölge + ink-50 arka plan** (hiç içerik olmasa bile "placeholder" değil "chip" gibi görünür).
- Decision table **selected row** (`.row-best`): sadece `--mint-50` yerine:
  - sol tarafta 3px solid `--mint-500` çubuk
  - satır arka planı `linear-gradient(90deg, rgba(16,185,129,0.06), transparent 40%)`
  - `font-weight: 700` (ama zaten öyle) + sağdaki fiyat 1 ölçü daha büyük
- Plan sayfasındaki grup başlığı (`.plan-item-header`): şimdi düz ink-50; **16px sol padding + 4px ink-900 bar** hiyerarşisini çok arttırır.
- Navbar: şu anki `backdrop-filter: blur(12px)` + %85 opak beyaz — bu **çok iyi**. Dokunma, sadece aşağıdaki alt sınır gölgesi yerine `border-bottom: 1px solid var(--ink-200)` daha ciddi.

## Spacing / radius / shadow yaklaşımı

**Radius ölçeği (tek bir sistem üzerine sabitle, iki sistemden `mock.html` olanını seç):**
- `--radius-sm: 8px` — chip, dot, küçük buton
- `--radius-md: 12px` — input, standard button, info-card
- `--radius-lg: 16px` — card, panel, table-container
- `--radius-xl: 20px` — product-hero, plan-card (24px çok yumuşak, 20px daha ciddi)
- `--radius-pill` — badge, session-dot pill, user-menu

**Shadow — sadece iki seviye:**
- `--shadow-1: 0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.03)` — pasif kart
- `--shadow-2: 0 4px 12px -2px rgba(15,23,42,0.08), 0 2px 4px -1px rgba(15,23,42,0.04)` — hover / aktif dropdown
- `--shadow-drawer: -16px 0 48px -12px rgba(15,23,42,0.18)` — sadece drawer
- `--shadow-glow-brand: 0 0 0 3px rgba(99,102,241,0.15)` — focus ring token

**`--shadow-hover`, `--shadow-glass`, `--shadow-pop`, `--shadow-flat` kaldırılır** — çoğaltan isimler.

**Spacing scale (yeni utility ama sadece 8’li grid):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Şu an inline style'da 16/24/32/48 zaten kullanılıyor; harmonize et.

**Contrast:**
- Müşteri isimleri, ilaç adları: `--ink-900`
- Sabit metinler: `--ink-700`
- Meta / secondary: `--ink-500` (asla `--ink-400`'de bilgi yazma — erişilebilirlik sınırı)
- Uppercase label: `--ink-500`, `letter-spacing: 0.05em`, `font-size: 11-12px`, `font-weight: 700`

---

# 3) Animasyon Prensipleri

## Motion felsefesi
**"Kesin, görünür, tekrarlamaz."** Masaüstü operasyon aracında animasyon; kullanıcıya *olayın olduğunu* bildirmek içindir, *duyguya hitap* için değildir. Her animasyon <250ms, sadece state değiştiğinde, tek yönlü.

## Hız tokenları (tek kaynak, tüm stil dosyalarına)

```
--dur-instant: 80ms      (button press, active)
--dur-fast:    140ms     (hover, badge, focus ring)
--dur-base:    200ms     (color/bg transition, select state)
--dur-moderate:260ms     (accordion expand, MF panel open)
--dur-slow:    320ms     (drawer slide, page enter)
```

## Easing tokenları

```
--ease-standard: cubic-bezier(0.2, 0, 0, 1)      → genel UI
--ease-enter:    cubic-bezier(0.16, 1, 0.3, 1)   → drawer / modal in
--ease-exit:     cubic-bezier(0.4, 0, 1, 1)      → drawer / modal out
--ease-linear:   linear                          → progress, shimmer
```

Şu an projede `cubic-bezier(0.4, 0, 0.2, 1)` (Material), `cubic-bezier(0.16, 1, 0.3, 1)` (iOS-like) ve `ease-out` karışık. Tek sistem.

## Nerede animasyon VAR (davranış + state)
- page enter (fade + 4px slide, **8 değil 4**; daha az bouncy)
- drawer slide (tek yön, opacity + transform birlikte)
- MF panel açılış (height + opacity, `--dur-moderate`)
- plan accordion (max-height + opacity)
- button press (scale 0.98, `--dur-instant`)
- selected row geçişi (background + left-indicator bar, `--dur-base`)
- suggestion dropdown (6px slide-down + fade, `--dur-fast`)
- depot dot "connected" transition (ink-300 → mint-500, `--dur-base`)
- loading skeleton shimmer (linear, 1200ms loop)

## Nerede animasyon YOK
- tablo satırı hover (sadece arka plan, **transform yok**)
- kart hover (sadece `box-shadow` değişimi, **translateY yok**)
- logo, navbar chip (statik)
- depot badge (statik, hover'da sadece opacity)
- icon buton (sadece bg color)
- input (sadece focus ring, layout kayması yok — şu an `.nav-search:focus { width: 400px }` **var**, kaldırılmalı: layout shift = operasyon kırıcı)

## Özel yasaklar
- 🚫 **`transform: translateY(-1px/-2px)` hover** — variant-item, variant-card, plan-accordion, metric-card, history-item'den tamamen çıkar. Desktop'ta data row'ların zıplaması kalitesiz durur.
- 🚫 **`:hover { scale }`** — sadece logo (1.05) istisna kalabilir.
- 🚫 **Gradient animasyonu, pulse, ambient glow** — hiçbiri yok.
- 🚫 **`.session-dot` box-shadow glow** — pulse yerine statik 1px ring.

---

# 4) Ekran Bazlı İyileştirme Spec'i

Her bölümde: **neyi etkiler (class/element) → problem → çözüm → hedef his.**

## 4.1 Navbar (`.top-nav`, `mock.html:276-314`)

| Element | Problem | Çözüm |
|---|---|---|
| `.nav-search:focus` | `width: 320 → 400` layout shift | Genişlik sabit 360px; `focus` sadece `background: #fff`, `border-color`, `--shadow-glow-brand` |
| `.nav-search-shortcut` "Ctrl K" | Absolute konumlanmış, fontu UI font | `font-family: var(--font-mono)`, `font-size: 10.5px`, `padding: 3px 6px`, `border-radius: 4px`, `background: var(--ink-100)`, `color: var(--ink-500)`, `border: 1px solid var(--ink-200)`. Inset gölge YOK. |
| Depot session chip (`6/6 Aktif`) | Bağımsız, `mint-50` arka plan + pulse dot | Pill'i ink-50 + inset border yap; dot'u 8px solid mint-500, ring `2px solid rgba(16,185,129,0.2)`. Glow yok. Hover: `ink-100`. |
| User menu + separator `\|` | 1px, 24px, 0 8px margin — tamam ama user-menu shape avatar 32px ile pill sınırını kırıyor | Avatar 28px, pill height 36px, avatar'ı pill-inset göster |
| "Sipariş Planı (2)" butonu (brand) | Kupon gibi duruyor | Count `(2)` yerine sayıya ayrılmış pill: `Sipariş Planı` + sağda küçük `--ink-900` üstüne `--brand-500` color count chip. Count 0 ise chip gizle. |
| Button hover | `translateY(-1px)` | Kaldır, sadece `background` değişsin |
| Focus | Yok | `.btn:focus-visible { box-shadow: var(--shadow-glow-brand) }`; `.nav-search:focus-visible` aynı |

**Hedef his:** "Bloomberg terminal'in üst barı" — hızlıca aşağı inip görevine geçen, kendini fark ettirmeyen bir yüzey.

## 4.2 Home / Dashboard (`#page-home`, `mock.html:356-478` + `renderHomePage` at `app-v23.js:602`)

| Alan | Problem | Çözüm |
|---|---|---|
| `h1 "Günaydın, Ahmet 👋"` | Emoji + 36px tek element sayfayı alıyor | 28px display, emoji kaldır veya `opacity: 0.5` |
| `.metric-card` (3px bottom bar) | Minimal ama öngörülemez; `.success::after` mint, default ink-200 | Bar kaldır, sayının altında 4px kare renk tile'ı olarak trend mini-sparkline placeholder tut (şimdilik sadece boş bırak); kart `padding: 20px 24px → 24px`, shadow-1 |
| **Toplu Arama banner** (en büyük sorun) | ink-900 gradient + 56px glass circle + blur + scale(1.01) hover | Düz `--ink-900` arka plan, `--radius-lg`, padding 20px 28px, sol 40px mini icon (brand-500 %15), sağ "Hemen Başla" `.btn-primary` (mevcut). Glass daire YOK. Hover: `background: #111827` (+1 ton). Scale animasyonu YOK. |
| `.card-header` + `.card-title` | mock.css'de tanımsız, mock.html inline | `.card-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--ink-100); display: flex; align-items: center; justify-content: space-between; }` `.card-title { font-size: 15px; font-weight: 700; color: var(--ink-900); }` — bu class'lar zaten JS render'da kullanılıyor, tokenla sabitle |
| Plan önizleme drug-item hover | inline `onmouseover` | Sınıfa taşı: `.home-preview-row:hover { background: var(--ink-50); }` — `transition: background var(--dur-fast) var(--ease-standard)` |
| Son aramalar `history-item` | Sadece border-bottom, ikon 40px daire | 48px hedef yükseklik, 40px yerine 36px ikon yuvarlağı, avatar tarzı sağa hizalanmış `chevron_right` sadece hover'da görünür (`opacity: 0 → 1`) |

**Hedef his:** ilk bakışta sakin; göz önce saati/greeting'i görür, sonra sağda 2 metric, sonra bir CTA banner, sonra aşağıda iki sütun. Şu an 5 şey aynı anda bağırıyor.

## 4.3 Search: Variants (`#page-search-variants`, `renderVariantsPage` at `app-v23.js:699`)

| Alan | Problem | Çözüm |
|---|---|---|
| `.variant-item` hover | `transform: translateY(-2px)` + border-color değişimi + shadow-pop | `transform`'u kaldır; sadece `border-color: var(--brand-500)` + 2px sol tarafta brand bar (`box-shadow: inset 3px 0 0 var(--brand-500)`) |
| Fiyat `.variant-price` | mock.html'de mint-600, mock.css'de ink-900 | Seçim: birim ilaç fiyatları için `--ink-900` mono (nötr), sadece **"en uygun / highlight"** olanlar mint-600. Genel liste nötr kalsın. |
| Empty state | Yok | `.variant-empty { padding: 48px 24px; text-align: center; color: var(--ink-500); }` + ikon + CTA "Aramayı değiştir" |
| Loading | Yok | Skeleton row: `.variant-item.skeleton { background: linear-gradient(90deg, ink-100, ink-50, ink-100); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }` — yükleme sırasında 3 skeleton |

## 4.4 Search: Detail (`#page-search-detail`, `renderDetailPage` at `app-v23.js:779`)

Bu ekran en kritik yüzey. Mevcut durumda görsel olarak en "mocklup" görünen yer burası.

| Alan | Problem | Çözüm |
|---|---|---|
| `.product-hero` | Düz beyaz, `product-hero-icon` dashed border + `add_a_photo` gri ikon, sağda fiyat yığını dağınık | `background: linear-gradient(180deg, #fff 0%, var(--ink-50) 100%)`; ikon kutusu `background: var(--ink-50)`, `border: 1px solid var(--ink-200)`, `box-shadow: inset 0 1px 2px rgba(15,23,42,0.03)`, içinde `medication` (JS zaten medication basıyor) ikonu brand-500. **dashed yok.** |
| Sağ blok (fiyat + buton) | "En uygun maliyet" 36px mint — güzel, ama PSF altında karma satır | Sağ blokta DİKEY hiyerarşi: (1) küçük uppercase "En uygun maliyet" label, (2) 36px mono mint-600 fiyat, (3) `--ink-200` divider, (4) `PSF: 48,50 ₺` + `MF: 10+12` yan yana mini meta, (5) `Mal Fazlası Hesapla` butonu. Divider kritik — hiyerarşiyi 4x güçlendirir. |
| "Hedef Adet" 32px mono (JS template'de) | Çok büyük ve ürün adıyla yarışıyor | 20px olarak küçült, label üstünde sabit 11px. Hedef adet değişimi inline olduğu için göze batmamalı. |
| MF açılır buton | Şu an satır-dışı, sağa yaslı küçük outline | `btn-brand` versiyonu `product-hero` sağ bloğu içinde, 16px `margin-top`, primary aksiyon olarak kabullen |
| `.mf-calculator` panel (açık hali) | Beyaz, border ink-200, display:none → display:block (animasyon yok) | **Kritik: animasyon destekli open state ekle.** Sınıfı `.mf-calculator` değil `.mf-calc[data-open="false/true"]` gibi iki state'li yap. Kapalıyken `max-height: 0; opacity: 0; margin: 0; overflow: hidden;` — açıkken `max-height: 420px; opacity: 1; margin-top: 16px;`. Transition: `max-height var(--dur-moderate) var(--ease-enter), opacity var(--dur-fast) linear, margin var(--dur-moderate) var(--ease-enter)`. JS zaten `state.mfCalculatorOpen` toggle ediyor — sadece render template'inde her iki durumda da paneli DOM'a bas, sadece `data-open` attribute değiştir. (Şu an `${state.mfCalculatorOpen && hasMfOptions ? ...}` tamamen render'dan çıkarıyor = animasyon mümkün değil.) |
| `.mf-chip.best` | Mint-50 + mint-500 border + mint-500 text — çok canlı | Mint-600 text, mint-50 bg, border `2px solid mint-500`. Star ikonu `--amber-500` olsun, kırlangıç olsun |
| `.decision-table` row-best | Sadece mint-50 bg | **3px sol mint-500 shadow-inset + 90deg gradient + biraz kalın font + sağda fiyat 18px mono mint-600.** Seçilmeyen satırlarda fiyat 15px mono ink-900. |
| `.decision-table tr:hover` | `background: var(--ink-50)` + transition yok | `transition: background var(--dur-fast) var(--ease-standard)`; hover `background: var(--ink-50)` — **hover hiçbir zaman row-best'i override etmesin** (selector: `tr:not(.row-best):hover`) |
| Depot column dot | 10px dot + box-shadow glow | 8px dot + 2px solid ring (kendi renginin %20 opaklığı) |
| "Seç" buton | ghost — çok silik, aksiyon hissi yok | `.btn-outline` + ikon yok; aktif satırda `btn-brand` "Seçili" (mevcut davranış); seçilebilir satırlarda `.btn-outline` + small |

**Hedef his:** Bloomberg order ticket. Tek bakışta: ilaç adı → en uygun fiyat → hangi depo → ne kadar tasarruf → tek tıkla plana. Şu an göz önce dashed placeholder'a takılıyor.

## 4.5 MF Area (detay içinde)

Spec yukarıda 4.4'te; özet olarak: **dark panel fikrini (`mock.html:206 .mf-calc-inner`) bırak, light `.mf-calculator`'ı koru** ama:
- Başlığa brand `insights` ikonu
- `.mf-input-group` içinde `input` üstünde `label: Hedef adet` hep görünür
- Chips'leri `--ink-100` bg / outline değil, **sadece `.best` dolu**, diğerleri `.btn-outline` benzeri
- 4 info-card (Sipariş/Teslim/Toplam/Efektif) — mint/amber/ink renkli **vertical border** ile semantic (Efektif = brand, Toplam = ink-900, Teslim = mint, Sipariş = nötr)
- Kapanırken `Esc` tuşu desteği (JS küçük dokunuş)

## 4.6 Plan Page (`#page-plan`, `renderPlanPage` at `app-v23.js:1059`)

| Alan | Problem | Çözüm |
|---|---|---|
| `.plan-container` padding 48px | Çok geniş — data density düşük | 32px 40px |
| `.plan-card` | `border-radius: 20px` + border + shadow-card + overflow:hidden → tamam | `--radius-lg` (16px) ciddiye daha yakın; shadow-1 yeterli |
| `.plan-card-top` | ink-50 bg + "Depo bazli operasyon ozeti" — tamam | Sağ tarafındaki total font-size 20px mono ink-900 + üstünde 11px uppercase "TOPLAM" label |
| `.plan-item-group` | Accordion değil, hep açık, ikon yok | **Her group'un başlığı (plan-item-header) 4px sol renk-barı** (o grubun dominant depot rengi); Hover `background: var(--ink-50)` |
| `.plan-sub-table` | İnce, sub-tablo gibi — tamam | Adet / efektif / toplam sütunları mono ink-900; Alternatif "seçili satır" için yeşil sol border (`selected-offer` state'i ekle) |
| Delete butonu | `.btn-icon.destructive` mevcut — rose tint hover | Hover'da **ek olarak** `transform` yok, sadece bg rose-50 + icon rose-500. Uzun satırlarda yanlışlıkla tıklama riski için: ilk click'te "Sil" etiket açılır (180ms), ikinci click'te silme. Şu an tek click. *(Küçük davranış değişikliği — JS'de 2-tık pattern confirmation; iş mantığı değişmez, sadece UI guard.)* |
| Boş state ("Plan bos.") | Tek satır gri text | Card içinde 120px yüksek, merkezde büyük ink-300 ikon + metin + "Aramaya git" CTA |
| Üst "Aktif Siparis Plani" metric blok | `font-mono, 32px ink-900` | Renk ink-900 kalsın ama üstüne küçük "+12 adet / 3 depo" progress bar yerleştir (progress 0 ise gizle) |

## 4.7 Plan Drawer (`#edit-drawer`, `renderPlanDrawer` at `app-v23.js:1233`)

**Bu drawer şu an premium'dan en uzak.**

| Alan | Problem | Çözüm |
|---|---|---|
| `.drawer` 480px width | Tamam — desktop'ta ideal aralık | Koru |
| Slide animation | `right: -500px → 0`, `transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1)` mock.html'de; mock.css'de `right` transition var ama `0.3s` | Tek kaynak: `transition: transform var(--dur-slow) var(--ease-enter)`; `.drawer { transform: translateX(100%); }` `.drawer.open { transform: translateX(0); }`. `right` bazlı geçişi bırak — `transform` GPU-accelerated. |
| `.drawer-overlay` | `mock.css:207` `display: none/block` + opacity transition → ilk blink | `opacity: 0; pointer-events: none;` default; `.open { opacity: 1; pointer-events: auto; }`. `display` dokunma. Ek: `backdrop-filter: blur(2px)` mevcut — koru. |
| `.drawer-header` | Düz beyaz, 24px padding | Sticky (`position: sticky; top: 0; z-index: 1;`) beyaz, altı `1px solid var(--ink-200)`, kapatma butonu sağ üstte `.btn-icon` `--ink-500`, hover `--ink-900` |
| İç kartlar (seçili depolar) | `.card` padding 20px + hover efekti inline | Seçili depot kartına **sol 3px solid brand-500 shadow-inset**; alt kartlar (alternatif) sadece `ink-200` border, hover `ink-300` |
| MF Seç / Web'de Aç / Sil | Üçü küçük outline yan yana — tıklanamaz gibi | **Overflow menü ile grupla**: sadece "Sil" direkt görünür (destructive, sağ), "MF Seç" ve "Web'de Aç" küçük pill olarak altta ayrı satır. Ya da tersine, hover'da göster (keşfedilebilirlik düşer — 1. seçenek daha iyi). |
| Alternatif depo kartı seçim | `onclick` var ama sadece border-color change hover | Seçim clicked state: `.depot-alt-card[data-selected="true"]` → mint-500 border, mint-50 bg, sağ üstte check ikonu. Selection sonrası kart 180ms'de highlight olur, drawer **kapanmaz** (kullanıcı karşılaştırmaya devam eder). |
| `.drawer-footer` | Sticky değil, flex 2 buton eşit | `position: sticky; bottom: 0; background: #fff; box-shadow: 0 -4px 12px -8px rgba(15,23,42,0.08);` İptal = outline (daha silik), Kaydet = brand (daha güçlü) **asimetri**: kaydet butonu `flex: 2`, iptal `flex: 1` |
| Boyut | 480px genişlikte içerik hiyerarşisi güçsüz | Üst kısım sabit özet (metadata), scroll sadece orta kartlar için. `body` içinde iki zone: `.drawer-hero` (56px) + `.drawer-scroll` (flex:1) |

**Hedef his:** Figma'da "right panel", Linear'da "issue detail". Drawer ana sayfadan bağımsız bir tamamlanmış mikro-ekran.

## 4.8 Bulk (`#page-bulk`, `renderBulkPage` at `app-v23.js:938`)

| Alan | Problem | Çözüm |
|---|---|---|
| `.bulk-dropzone` | `border: 2px dashed ink-300` + padding 48px | 1px dashed ink-300; dragover state: brand-500 solid border + brand-50 bg (+ 4px outline ring). Hover **sadece** bg değişir, transform yok. |
| Textarea + dropzone yan yana yok | Vertical stack, kullanıcı iki ekran arasında karar veremiyor | İkisini tab-switch yap: üstte "Yapıştır / Dosya" toggle (pill segmented control). İş mantığına dokunmaz — sadece display:none. |
| `row-highlight` yeşilimsi | Sadece bg-linear-gradient | §4.4'teki `.row-best` + sol bar uygulaması aynı mantıkta |
| "Kesin Eşleşme Bulunamadı" satırı | Rose-50 full satır — çok keskin | Sadece sol 3px rose-500 bar + nötr bg, "Manuel Ara" CTA outline rose |
| Qty input (`value="5"`) | inline style, 40px width | `.qty-control` sınıfı zaten tanımlı mock.css'de — kullan; 96px toplam genişlik |
| Tarama tamamlandı banner | Mint-50 + check — tamam | Üstüne animate ek: fade-in + 8px slide-down, **sadece bir kere**, `--dur-slow` |

## 4.9 Settings (`#page-settings`, `renderSettingsPage` at `app-v23.js:1112`)

| Alan | Problem | Çözüm |
|---|---|---|
| "Connected / Disconnected" badge | Metin-only | Her depo kartının sol üstünde **10px dot** — connected: mint-500 + 2px ring mint-500/20, disconnected: ink-300 + ring ink-200. Transition: state değişince `--dur-base` renk geçişi. |
| Kart container | `.card { padding: 24px }` | Connected olanlarda hafif `background: linear-gradient(180deg, #fff, ink-50 100%)`; disconnected olanlarda düz beyaz ama `opacity: 0.85` değil — `font-weight` düşür. |
| "Kaydet" / "Test Login" | `btn-brand` + `btn-outline` yan yana | Test Login = ghost; Kaydet = brand. Test Login çalışırken `.btn-loading` class (spinner). |
| Uyumluluk paneli `<details>` | Raw HTML details, açılış animasyonu yok | CSS'le `details[open] summary { ... }` ve body için max-height animation. `<details>` native'inin açılış animasyonu yok; `summary::marker` override + JS `details.ontoggle` ile max-height. |
| Sol sidebar sekme | `btn-outline` iki buton | Gerçek sekme listesi: aktif = brand-50 bg + brand-600 text + sol 3px brand-500 bar; inaktif = ghost |
| `Uppercase SEKMELER` label | 16px margin-bottom | 12px, güzel |

---

# 5) Micro-interaction Spec'i

Her biri: **trigger → visual → duration → easing → dikkat.**

### 5.1 Arama kutusu (`.nav-search`)
- Trigger: `focus`
- Visual: bg `ink-100 → #fff`, border `ink-200 → brand-500`, `+ 3px brand-500/15 ring`
- Duration: 140ms
- Easing: `--ease-standard`
- Dikkat: **width değişmesin** (şu anki `width: 400px` kaldırılır). Layout shift yasak.

### 5.2 Autocomplete suggestions (`#globalSearchSuggestions`)
- Trigger: `input` + debounce 160ms (zaten var)
- Visual: panel `opacity: 0, translateY(-6px)` → `opacity: 1, translateY(0)`; her item için keyboard `↑↓` highlight → `background: ink-50`
- Duration: 140ms
- Easing: `--ease-enter`
- Dikkat: İlk açılışta tüm item'ları stagger etme (masaüstünde yavaş hissi yaratır); panel tek blok. Class'la yönet, inline style bırak.

### 5.3 Depot seçimi (decision table / drawer alt card)
- Trigger: `click` on `tr` veya `.depot-alt-card`
- Visual: background mint-50, **3px left inset ring mint-500**, sağda check ikonu fade-in (opacity 0→1, scale 0.8→1)
- Duration: 200ms
- Easing: `--ease-standard`
- Dikkat: **Tek seçim**; önceki seçili state 200ms'de bırakır (geçiş crossfade). Row seçimi yapılırken mouse kipi değişmez.

### 5.4 MF hesapla butonu (`toggleMfCalculator`)
- Trigger: `click`
- Visual: Buton kendisinde `scale(0.98)` 80ms press; ikon `calculate` ikonu 180° döner (`transform: rotate(0 → 180deg)`); label değişir
- Duration: 200ms
- Easing: `--ease-standard`
- Dikkat: Icon rotation çok eğlendirici — **yapma**, sadece label değişsin. Buton kendisi press animasyonu (`:active { scale(0.98) }`) yeterli.

### 5.5 MF panel aç/kapa (`.mf-calc`)
- Trigger: MF buton click
- Visual: `max-height: 0 → 420px`, `opacity: 0 → 1`, `margin-top: 0 → 16px`
- Duration: 260ms (açılış), 200ms (kapanış — `--ease-exit`)
- Easing: `--ease-enter` (açılış)
- Dikkat: `max-height` animasyonu bilinen bir tekniğe: içerik yüksekliği 420'yi aşarsa clip olur — güvenli sınır bırak. İçerik render edilirken her zaman DOM'da olmalı (display:none YAPMA; sadece `aria-hidden` + visual collapse).

### 5.6 Plan item hover / select (`.plan-item-header`, `.plan-sub-table tr`)
- Trigger: mouse hover + click
- Visual hover: `background: ink-50` (sadece)
- Visual select: `tr[data-selected="true"]` → mint-50 + sol bar
- Duration: hover 120ms, select 180ms
- Easing: `--ease-standard`
- Dikkat: **transform yok**, shadow yok. Table satırında sadece arka plan ve chevron göster/gizle.

### 5.7 Drawer aç/kapa (`#edit-drawer`, `#bulk-drawer`, `#bulk-drawer.drawer-left`)
- Trigger: `.open` class toggle (mevcut `window.openDrawer` / `closeDrawer`)
- Visual: 
  - Açılış: drawer `transform: translateX(100%) → 0` + overlay `opacity: 0 → 1`
  - Kapanış: tersi
- Duration: 320ms açılış, 260ms kapanış
- Easing: açılış `--ease-enter`, kapanış `--ease-exit`
- Dikkat: Açılış ilk frame'de drawer content scroll pozisyonu top olsun (`drawer-body.scrollTop = 0` kapanışta). Overlay ESC tuşu ile kapanmalı (küçük JS dokunuş).

### 5.8 Settings connected/disconnected state
- Trigger: `saveDepotSettings` başarılı (JS hook'u mevcut, `settings-status-{depotId}` update ediyor)
- Visual: dot ink-300 → mint-500, badge "Bağlı Değil" → "Bağlı"; kart arka planı 300ms crossfade
- Duration: 320ms
- Easing: `--ease-standard`
- Dikkat: Test Login akışında dot'u amber (refreshing) `dot-refresh` ara state'i olarak göster — 300ms sonra sonuç geldiğinde mint veya rose.

### 5.9 Aktif plan önizleme kartı (home-page sağ sütun)
- Trigger: plan bir kalem değiştiğinde (home render tekrar çalışır)
- Visual: değişen satırın arka planı 400ms boyunca `ink-50 → brand-50 → ink-50` geçişi (highlight-pulse bir kez)
- Duration: 400ms toplam (keyframes: 0% ink-50, 40% brand-50, 100% ink-50)
- Easing: `linear`
- Dikkat: **sadece bir kere** — sürekli loop olmayacak. CSS animation `animation: highlightOnce 400ms linear 1`. Home full re-render olduğu için yeni eklenen item'a `data-newly-added` flag'i JS'de `setTimeout(…, 450)` ile kaldırılmalı.

---

# 6) CSS Seviyesinde Uygulanabilir Rehber

## 6.1 Gözden geçirilecek token grupları
1. **Brand:** `--brand-50/100/500/600/700` tek kaynaktan — `#6366f1` çekirdeği
2. **Ink (slate):** `--ink-50 → 900` — mock.html'in inline paleti (`#0f172a` ucu) — mock.css'in zinc paleti yerine
3. **Depot:** `--depot-selcuk/nevzat/alliance/pharma/sentez/itriyat` tek yerde
4. **Semantic:** `--mint-500`, `--amber-500`, `--rose-500` + her birinin 50 varyantı
5. **Typography:** `--font-ui: Inter`, `--font-display: Outfit`, `--font-mono: JetBrains Mono` (Plus Jakarta Sans **silinir**)
6. **Radius:** `--radius-sm/md/lg/xl/pill`
7. **Shadow:** `--shadow-1`, `--shadow-2`, `--shadow-drawer`, `--shadow-glow-brand` (4 adet, başka yok)
8. **Motion:** `--dur-instant/fast/base/moderate/slow`, `--ease-standard/enter/exit/linear`
9. **Layout:** `--titlebar-h: 36px`, `--navbar-h: 64px` (sadece 64, 60 silinir)

**Aksiyon:** `mock.html` `<style>` bloğundaki `:root` **tek kaynak** olur; `mock.css` `:root` tümüyle kaldırılır. `mock.css` sadece inline `<style>`'ın tamamlayıcısı olan class'ları içerir (mf-calculator, decision-table, plan-sub-table, info-card vs.) ve kendi token tanımlamaz.

## 6.2 Yeniden ele alınacak class blokları

| Mevcut | Aksiyon |
|---|---|
| `.depot-badge`, `.depot-selcuk`, `.depot-nevzat`, `.depot-alliance`, `.depot-pharma`, `.depot-sentez`, `.depot-itriyat` (mock.css:224-230) | **Ölü kod — sil.** JS `.depot-label .depot-dot` üretiyor. |
| `.mf-calc-wrap`, `.mf-calc-inner` (mock.html inline) | **Ölü kod — sil.** JS `.mf-calculator` render ediyor. |
| Duplicated `.drawer`, `.drawer-overlay` in mock.css + mock.html | **Sadece mock.css'de tut, transform-based.** |
| `.btn-primary-dark` (mock.css) vs `.btn-primary` (mock.html) | Tekilleştir: `.btn-primary` (ink-900 bg) — `.btn-primary-dark` silinir |
| `.search-sidebar` mock.css ink-50 vs mock.html ink-50 | Tekil; mock.css kazanıyor |
| `@keyframes fadeIn` (mock.css) + `@keyframes slideUpFade` (mock.html) | Tekil: `@keyframes pageEnter` (4px translate + opacity) |
| Inline `onmouseover`/`onmouseout` (home, bulk) | Class'a taşı: `.hover-row`, `.bulk-row`, `.history-row` |

## 6.3 Yeni utility/state class'ları

```
.skeleton            → shimmer bg (eklenir)
.is-loading          → generic loading
.is-selected         → selected row/card (sol bar ring, mint)
.is-active           → navbar/sidebar aktif sekme
.is-disabled         → opacity .5 + pointer-events: none
[data-open="true"]   → MF panel, accordion, details
[data-state="connected|disconnected|refreshing"] → settings depot kartı
.row-best            → mevcut, sol bar güçlendirilir
.focus-ring          → tüm focusable'lara eklenecek utility
```

## 6.4 Eklenecek transition/shadow katmanları

```
:focus-visible sistemi (mevcut değil)
  Her interactive element: outline: none; box-shadow: var(--shadow-glow-brand);

.skeleton + @keyframes shimmer
  background-size: 200% 100%; animation: shimmer 1.2s linear infinite;

.is-newly-added + @keyframes highlightOnce  
  plan önizleme satırı için

.drawer transform sistemi
  translateX(100%) ↔ 0
```

## 6.5 Hover/focus/selected/loading ayrımı güçlendirilecek yerler
- `.btn-icon`: şu an sadece hover bg; **focus-visible ring ekle**
- `.nav-search`: focus ring var ama width shift bozuyor; width sabit, ring kal
- `.variant-item`, `.plan-item-header`, `.depot-alt-card`, `.mf-chip`: hover = bg, focus = ring, selected = sol bar + mint-50
- `.btn` loading state: `.btn.is-loading { pointer-events: none; } .btn.is-loading::after { content: ''; 12px spinner; }`
- `.input:focus` var; `.input[aria-invalid="true"]`: rose-500 ring
- Table rows: `tr:not(.row-best):hover { background: ink-50 }` (row-best'i override etmez)

---

# 7) `app-v23.js` UI Davranış Haritası

## State'ler (tek global nesne `state`, davranış-ilgili alanlar)

- `state.currentPage` → page switcher (login/home/search-variants/search-detail/bulk/plan/settings)
- `state.currentDetailItems` → detay listesi
- `state.currentDetailQuery` → arama kelimesi
- `state.desiredQty` → MF hedef adet
- `state.mfCalculatorOpen` → MF panel toggle (şu an re-render; animasyona uygun değil)
- `state.selectedOfferKey` → seçili teklif (getOfferKey)
- `state.bulkRows`, `state.bulkDrawerIndex` → bulk drawer
- `state.planDrawerKey` → plan drawer group key
- `state.config.depots` → settings'te her depot credential state'i

## Render noktaları
- `renderHomePage()` — `app-v23.js:602`
- `renderVariantsPage()` — `:699`
- `renderDetailPage()` — `:779`
- `renderBulkPage()` — `:938`
- `renderPlanPage()` — `:1059`
- `renderSettingsPage()` — `:1112`
- `renderBulkDrawer(row)` — `:1189`
- `renderPlanDrawer(groupKey)` — `:1233`
- `renderCurrentPage()` merkezi switcher — `:1178`

Her render **`page.innerHTML = …`** tipinde yani **tüm ağacı replace ediyor.** Bu, animasyon için şunu ima eder:

> **Animasyon state değişiminde değil, class toggle ile olmalı.** Yani MF panel'ı render koşullu basmak yerine **her zaman DOM'da basmak ve `data-open` ile toggle etmek** gerekir. Aksi halde transition tetiklenmez.

## Animasyon bağlanabilecek olaylar
1. **Page switch** — `switchPage(pageId)` (:507). Yeni page `.active` class'ı alıyor, CSS `@keyframes pageEnter` zaten bağlı olur. Geçiş için **yeni page'i inert bırak 20ms** sonra `.active` ekle; aksi halde re-render ile çakışıyor.
2. **MF toggle** — `toggleMfCalculator` (:1377). `state.mfCalculatorOpen` change → re-render. **Dönüşüm:** render'da her iki durumda da `.mf-calc` elementi basılır, `data-open=${state.mfCalculatorOpen}` olarak. CSS geçişi animasyonu halleder.
3. **Offer select** — `selectOffer(key)` (:1371). Re-render oluyor; seçim sonrası row'a `.is-selected` class'ı zaten gelir, CSS transition `background/border-color` 200ms.
4. **Drawer aç/kapa** — `window.openDrawer` (:1782). Pure class toggle; ideal animasyon yüzeyi. `transform` ve `opacity` için hazır.
5. **Plan qty change** — `changePlanQty` (:1632). Re-render. Highlight istiyorsak: render'dan önce değişen key'i `state.lastChangedKey` olarak işaretle; template'de o satıra `.is-newly-updated` class; 400ms sonra `state.lastChangedKey = null` + silent re-render (veya sadece class'ı elle sil). Küçük JS dokunuş; iş mantığı değişmez.
6. **Plan alternative select** — `selectPlanAlternative(groupKey, depotId)` (:1650). Re-render drawer + plan sayfası. `.is-selected` class'ı ile highlight.
7. **Suggestions** — `bindTopNav()` (:1698) içinde inline-style panel. **En güvensiz yer.** Inline `style.cssText` yerine class'a taşınmalı: `.global-search-suggestions` + `.open`. Render içeriği zaten `innerHTML` ile basılıyor, item için `.suggestion-item` class'ı ekle. Klavye ↑↓ için `state.suggestionActiveIndex` ekle.

## Animasyon için "güvenli" noktalar
| Yer | Neden güvenli |
|---|---|
| `.page.active` pageEnter keyframe | CSS-only, hiç JS değişmez |
| `.drawer` transform | Pure class toggle mevcut |
| `.is-selected` row/card | Pure class swap, re-render OK |
| `.skeleton` DOM basma | Search / bulk sırasında `page.innerHTML = skeletonHtml` → veri gelince gerçek render |
| `.mf-calc[data-open]` | Render template değişimi yeter, class toggle CSS hallediyor |
| `[data-state]` settings depot | JS render zaten connected/disconnected string basıyor; attribute'a çevir |

## Dokunulmaması gerekenler (iş mantığı)
- `calculatePlanning`, `parseMf`, `buildVariantGroups`, `normalizeDepotItem` — tüm planlama matematiği
- `authFetch`, `bootstrapApp`, `fetchSuggestions`, `runSearch`, `bulkSearch` — ağ
- `addPlanItem`, `updatePlanItem`, `removePlanItem`, `saveOrderPlan` — store
- `configuredDepotIds`, `DEPOT_META`, `DEPOT_FORMS` — domain
- `saveDepotSettings`, `testDepotLogin`, `runCompatHealth/Demo/Update` — contract
- `switchPage` (core) — değiştirilmez; sadece etrafına inert bekleme eklenebilir

---

# 8) Önceliklendirilmiş Uygulama Planı

## Faz 1 — Sistem birleştirme (düşük risk, en yüksek görsel kazanç)
1. Token tekilleştirme: mock.html `<style>` `:root`'u tek kaynak, mock.css'den `:root` silinir.
2. Font stack: Inter + Outfit + JetBrains Mono; Plus Jakarta Sans silinir. `@import` temizlenir.
3. `--brand-500` indigo (#6366f1) tek değer — rose kaldırılır; rose sadece `--rose-500` destructive için.
4. Ölü class'lar silinir: `.depot-badge*`, `.mf-calc-wrap`, `.mf-calc-inner` (mock.html inline dark panel), `.btn-primary-dark`.
5. Shadow token'ı 4 adede indir.
6. Motion token seti eklenir (`--dur-*`, `--ease-*`).
7. `.depot-dot` box-shadow glow → 2px solid ring.
8. `@keyframes pageEnter` (tek keyframe), diğer iki silinir.
9. Tüm hover `transform: translateY` kaldırılır (variant-item, variant-card, plan-accordion, metric-card).
10. `.nav-search:focus` width shift kaldırılır.
11. `.drawer-overlay` `display` geçişi → opacity + pointer-events.
12. `.drawer` `right` → `transform: translateX`.

**Net kazanç:** tüm ekran anında tutarlı görünür, hiçbir iş akışı değişmez.

## Faz 2 — State + micro-interaction polish
1. `.is-selected`, `.row-best` sol-bar sistemi (decision-table, plan-sub-table, drawer cards).
2. `.mf-calc[data-open]` pattern (DOM'da her zaman render; `state.mfCalculatorOpen` → attribute).
3. Settings `[data-state="connected|disconnected|refreshing"]` dot + badge sistemi.
4. Focus-visible ring sistemi (tüm `.btn`, `.btn-icon`, `.input`, `.nav-search`, link-like clickable div'ler).
5. `.skeleton` + shimmer keyframe; search-variants, search-detail, bulk için loading skeletons.
6. Empty state component (`.empty-state`): plan boş, variants boş, bulk boş, search boş.
7. Suggestions panel class'a taşıma + keyboard nav + open animation.
8. Drawer sticky header + sticky footer; body scroll restore.
9. Plan item `is-newly-updated` highlight-once animation.
10. `Esc` tuşu → drawer/MF kapatma (tek küçük JS hook).

## Faz 3 — Daha ileri motion + detay polish
1. Product-hero icon "placeholder → medication" görsel ayrımı; dashed tamamen kaldır.
2. Decision table selected row 3px left bar + 90deg gradient bg + sağdaki fiyat +3px.
3. Plan accordion tek-seviyeli slide (max-height).
4. Home banner (Toplu Arama) sakinleştirme.
5. Toplu arama "tamamlandı" banner slide-in (tek sefer).
6. Delete → 2-tık confirmation pattern.
7. Test Login loading dot (amber, 300ms delay).
8. Variant list skeleton → real data fade crossover.
9. Details sidebar plan summary subtle slide-in kart başına (stagger yok, tek blok).
10. Chevron hover reveal (history, plan header).

---

# 9) Uygulama İçin Hazır Kısa Brief

> **Brief: Eczane Pro V2.3 — UI Polish Pass**
>
> **Kapsam:** Sadece görsel kalite ve animasyon. Logic, contract, data shape değişmez.  
> **Hedef dosyalar:** `D:\personal\eczane-app\midstage\2.3\renderer\mock.html` (yalnızca `<style>` bloğu), `mock.css`, `scripts/app-v23.js` (sadece UI davranışı için işaretli küçük yerler).
>
> **1. Tek tasarım sistemi.** `mock.html` inline `<style>` içindeki `:root` tokenları otorite; `mock.css` `:root` tamamen silinir. `mock.css`'deki duplicate/dead class'lar silinir: `.depot-badge*`, `.btn-primary-dark`, `.mf-calc-wrap`, `.mf-calc-inner`, `@keyframes fadeIn`.
>
> **2. Token'lar sabitlenir:**
> - Brand: `#6366f1` indigo tek değer
> - Font: Inter / Outfit / JetBrains Mono (Plus Jakarta Sans kaldır)
> - Radius: 8/12/16/20 + pill
> - Shadow: `--shadow-1`, `--shadow-2`, `--shadow-drawer`, `--shadow-glow-brand`
> - Motion: `--dur-instant(80)/fast(140)/base(200)/moderate(260)/slow(320)` + `--ease-standard/enter/exit`
> - `--navbar-h: 64px`, `--titlebar-h: 36px`
>
> **3. Yasaklar:**
> - `transform: translateY` hover (data row'larda)
> - `.nav-search:focus` width shift
> - `.depot-dot` box-shadow glow
> - `display: none/block` transition
> - Inline `onmouseover` (class'a taşı)
> - Renkli gradient arka planlar (product-hero dışında)
>
> **4. Her zaman uygulanır:**
> - `:focus-visible { box-shadow: var(--shadow-glow-brand); outline: none; }` tüm interactive
> - Tüm hover sadece bg/border/shadow — transform yok
> - Tüm drawer `transform: translateX` + overlay `opacity + pointer-events`
> - `.mf-calc[data-open]` her zaman DOM'da, CSS max-height transition
> - `.is-selected` / `.row-best` için sol 3px solid brand veya mint bar
>
> **5. Öncelikli ekranlar:**
> - **Detail page:** product-hero ikon placeholder hissini kaldır (dashed → solid border + subtle inset), sağ bloğu dikey hiyerarşiye al, decision table selected-row'u güçlendir
> - **Plan drawer:** sticky header/footer, asimetrik alt butonlar, alternatif kart seçim state, transform-based slide
> - **Navbar:** width-stable search, session chip'i sakinleştir, focus ring
> - **MF panel:** her zaman DOM, class-toggle animasyonu, max-height 420px
>
> **6. Küçük JS dokunuşları (sadece UI):**
> - `bindTopNav`: suggestions panel inline-style → class'a taşı, keyboard ↑↓ + enter
> - `toggleMfCalculator`: render koşulunu kaldır, her zaman render, `data-open` set et
> - `selectPlanAlternative`, `selectOffer`: render'dan önce `state.lastChangedKey` işaretle, 400ms sonra temizle (highlight-once için)
> - Drawer açılışlarında `Esc` key listener (window-level)
> - `testDepotLogin`: çağrı başlarken `data-state="refreshing"`, sonunda connected/disconnected
> - `removePlanItemAndRender`: 2-tık confirmation (ilk tıklama → satıra `.pending-delete` + 2 saniye timer, ikinci tıklama → gerçek sil)
>
> **İş mantığı hiçbir yerde değişmez.** `calculatePlanning`, `normalizeDepotItem`, `buildVariantGroups`, `addPlanItem`, `authFetch`, `bulkSearch` — bunlara dokunulmaz.
>
> **Doğrulama:** Değişim sonrası şu akış bozulmadan çalışmalı: login → home → search "pirofen" → variants → detail → MF aç → depot seç → plana ekle → plan sayfası → drawer aç → alternatif seç → kaydet → toplu arama → settings → test login. Her adımda tek bir görsel sürpriz (drawer açılırken blink, MF paneli popup gibi patlamak, row hover'da zıplama) olmayacak.
# 10) İlüstrasyon / Görsel Destek Katmanı

## 10.1 Felsefe

Bu tür bir uygulamada illüstrasyon hatası genellikle "var olması" değil, **"yanlış yerde olması"**. Eczacı bir ürünü planlarken ekranın kenarında animasyonlu bir paket kutusu çizimi yoktan daha kötüdür — kullanıcının dikkatini operasyon kararından uzaklaştırır. Bu yüzden temel kural:

> **Veri yoğun yüzeylerde illüstrasyon YOK. Sadece "ekranın özel bir an yaşadığı" durumlarda (giriş, boş, hata, kurulum, yükleme) illüstrasyon VAR.**

Bu yaklaşım Linear, Height, Ramp, Carta ve Bloomberg Terminal'in paylaştığı felsefedir: görsel destek operasyon akışını yormaz, onu çevreler. İlüstrasyon, kullanıcıya "burada artık bir şey yok / henüz başlamadın / bir şey ters gitti" mesajını **metnin yapamadığı hızda** verir. Başka işi yoktur.

---

## 10.2 Nerede KULLAN — Nerede KULLANMA Matrisi

| Ekran / Yüzey | İlüstrasyon | Neden |
|---|---|---|
| **Login** (sol sanat paneli) | ✅ **Evet** — tek büyük mimari/geometrik kompozisyon | Ekran özellikle sparse; marka kimliği kurmak için tek fırsat |
| **Home — "Günaydın, Ahmet"** üst bandı | ⚠️ **Sadece arka plan treatment** (micro-grid + radial fade) | Saat ve metriklerle yarışmamalı; ilüstrasyon değil atmosfer |
| **Home — Toplu Arama banner** | ❌ **Hayır** (şu anki 56px "glass circle" bile çok) | İçinde zaten CTA var, ikon yeterli |
| **Empty plan ("Plan boş")** | ✅ **Evet** — küçük, monochrome, line-only | Ekran zaten metin-yoksulu; tek doğru zaman |
| **No-result state** ("Kesin eşleşme bulunamadı") | ✅ **Evet** — çok küçük, geometrik | Hata tonunu ısıtmadan bildirir |
| **Disconnected depo** (settings) | ⚠️ **Sadece ikonografi + dot** | Kart içinde — illüstrasyon değil, durum simgesi |
| **Bulk — dropzone boşken** | ✅ **Evet** — tek objekt, çizgisel | Sparse + kullanıcının dikkatini bu alana çekmeliyiz |
| **Loading / skeleton** | ❌ **İlüstrasyon yok** — sadece shimmer | Animasyon illüstrasyonun yerini tutar, çifte gürültü |
| **Variant list empty** | ✅ **Küçük, monochrome** | Nadir görülür; sessiz bildirir |
| **Search detail / product-hero** | ❌ **Kesinlikle yok** | En kritik karar yüzeyi; her piksel karara hizmet eder |
| **Decision table / plan page** | ❌ **Kesinlikle yok** | Data density zaten bağırıyor |
| **Plan drawer** | ❌ **Kesinlikle yok** | İnce karar paneli; ilüstrasyon "premium" hissini siler |
| **MF calculator paneli** | ❌ **Yok** — sadece küçük `insights` ikonu başlıkta | Hesaplama alanı, ikon yeterli |
| **Navbar** | ❌ **Yok** | Navbar zaten kompakt, logo dışında hiçbir şey |
| **Toast / banner** | ⚠️ **Sadece ikon** (check_circle vb.) | İlüstrasyon değil, semantik ikon |

---

## 10.3 Stil Dili

### Seçilen dil: **"Mimari çizgi + geometrik nötr"**

Bu, Linear'ın empty state'leri, Height'ın onboarding kartları ve Figma'nın 404 sayfası ile aynı ailedir. Objeyi **ima eder, betimlemez.** Asla karakter, asla 3D, asla renk dolu illüstrasyon, asla "drug capsule with smiley face".

### Biçim kuralları
- **Sadece dış çizgi (stroke)**, `stroke-width: 1.5` (16px altı boyutlarda 1.25), `stroke-linecap: round`, `stroke-linejoin: round`
- **Flat**, isometric değil (izometrik → tech-brochure hissi → yasak)
- **Geometrik abstraction**: 3-4 primitiften fazla eleman içermez (circle, rectangle, line, bir arc)
- **Simetrik veya tek-aks hizalı** — organik eğri yok
- Hiçbir ilüstrasyonda **gölge, gradient fill, texture, emoji, sticker** yok
- Maksimum 2 renk: ana stroke `--ink-300` veya `--ink-400`, opsiyonel tek **accent element** (dot, highlight arc, mini dolu kutucuk) brand veya semantic renkte
- Boyut: **96px × 96px'i geçmez** (login hariç). Empty state içindeki illüstrasyon 64-80px ideal.

### Ton
- **Boş state ilüstrasyonları:** nötr ink-300 stroke + hafif mint/brand accent (positive feel)
- **Hata / no-result:** nötr ink-300 stroke + rose-400 accent (sadece dot/underline)
- **Disconnected depo:** ink-300 stroke, fade-out dot pattern
- **Bulk dropzone:** brand-400 stroke + ink-200 grid accent (davet hissi)
- **Login:** ink-700 veya ink-800 stroke (koyu arka plan üstünde) + rgba(brand, 0.5) tek vurgu

### Renk yoğunluğu
Her illüstrasyonda **toplam renkli piksel oranı < %15**. Geri kalan transparent / stroke. Bu oran aşıldığında otomatik olarak çocukça / startup-landing hissi başlar.

---

## 10.4 Teknik Yaklaşım — SVG / Pattern / Glow seçimi

| Amaç | Doğru araç |
|---|---|
| Empty state ("Plan boş", "Sonuç yok") | **Inline SVG** (48-80px, 3-6 shape primitive) |
| Disconnected depo state | **Inline SVG** (32-40px, sadece 2-3 line/dot) |
| Bulk dropzone merkezi | **Inline SVG** (80px, upload/document abstraction) |
| Dashboard üst bandı arka plan | **CSS pattern** (radial gradient + subtle grid) + **SVG olmaz** |
| Login arka planı | **Büyük SVG kompozisyonu** (full-bleed) + **CSS glow layer** |
| Loading | **Sadece CSS shimmer** — SVG yok |
| Banner / section divider atmosferi | **CSS noise/grid overlay** (`background-image: linear-gradient`, `radial-gradient`) |

### SVG katmanı için kurallar
- Projeye fiziksel asset dosyası eklemeye **gerek yok** — tüm illüstrasyonlar inline SVG (kompozisyonlar küçük, 6 primitive altı, tek dosyada `renderEmptyState()` helper'ı ile bile mümkün)
- Stroke rengi **`currentColor`** kullan, wrapper element `color: var(--ink-300)` tayin etsin — böylece dark mode veya başka yüzeyde otomatik uyum
- Accent renkler inline class ile: `<circle class="accent-mint">`
- SVG'de **animasyon yok** (statik). Empty state ekranı zaten bir kere açılır, SMIL/CSS anim eklemek enerjisi sizi aşağı çeker.
- Pattern/glow layer için CSS-only yaklaşım (`background-image: radial-gradient(...)` + `background-size: 32px 32px`)

---

## 10.5 Ekran Bazlı Spec

### 10.5.1 Login (`#page-login`)

**Mevcut:** Sol panel koyu gradient + iki radial bokeh + `view_in_ar` Material ikonu + "Eczane Pro" başlığı. Çok tipik SaaS-landing.

**Öneri:**
- İki bokeh gradient → **tek subtle radial glow** `radial-gradient(circle at 30% 40%, rgba(99,102,241,0.18) 0%, transparent 55%)`, tek nokta
- Üstüne **ince geometrik SVG kompozisyon** (400×400 civarı): birbirine bağlı 6-8 daire (node) + çizgi (edge), ağ topolojisi gibi — "6 depo tek sistemde" metaforu; stroke `rgba(255,255,255,0.15)`, her düğümde 6px dolu dot `rgba(255,255,255,0.35)`, bir düğüm brand-500 vurgulu
- `view_in_ar` ikonu kaldır (Material flash ikonlar amatörce kalıyor)
- Bunun üstünde marka adı `Eczane Pro`, altında slogan. Glass card kaldırılabilir — kompozisyon ve tipografi yeterli.
- `backdrop-blur` kullanma; koyu arka plan düz kalsın (`--ink-900`)

**Hedef his:** bir ağ / bağlantı / operasyon kontrol merkezi.

### 10.5.2 Home — "Günaydın" hero bandı

**İlüstrasyon yok.** Bunun yerine:
- `.dashboard-header` wrapper'ına subtle arka plan:
  ```
  background-image:
    radial-gradient(circle at 85% 20%, rgba(99,102,241,0.04) 0%, transparent 40%),
    linear-gradient(var(--ink-100) 1px, transparent 1px),
    linear-gradient(90deg, var(--ink-100) 1px, transparent 1px);
  background-size: auto, 32px 32px, 32px 32px;
  background-position: 0 0, 0 0, 0 0;
  mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
  ```
- Bu **"plan paper"** hissi verir, illüstrasyon değil dokudur
- Saat/saat arası değişimle (sabah/akşam) glow rengi değişmez — gündelik animasyon çocukça

### 10.5.3 Empty plan (`.plan-container` → "Plan boş" state)

**SVG kompozisyon (80×80, ortada):**
- Zemin: tek hafif-çizgili dörtgen (klasör/liste kâğıdı ima)
- İçinde 3 yatay çizgi (boşluk bırakan — boş liste ima)
- Alt köşede tek mint-500 dolu 6px dot (plan verimli olduğunda dolduracağın yer vurgusu)
- Altında `Plan henüz boş` (ink-700, 16px), `Detay ekranından ürün ekleyin` (ink-500, 13px), CTA `btn-outline` "Aramaya dön"

Boyut total: 320px max-width, ortalı, 72px top margin. Ekranı boğmaz.

### 10.5.4 No-result (variants empty + bulk "Kesin Eşleşme Bulunamadı")

**İki farklı şey, iki farklı yaklaşım:**

**Variants empty (tüm sayfa):**
- 64×64 SVG: mercek (dış daire stroke ink-300) + içinde tek ince diagonal çizgi (mercek gövdesi) + merceğin dışına düşen 3 küçük geometrik shape (circle, triangle, square, hepsi stroke ink-200) — "aradın ama bulamadın, ama şunları da düşün"
- Başlık: "Sonuç bulunamadı" (ink-700, 18px)
- Alt: "Farklı bir kelime veya barkod deneyin" (ink-500, 13px)
- Accent: merceğin odağında tek amber-400 dot (vurgu)

**Bulk no-match (tablo satırı):**
- İlüstrasyon YOK. Satır zaten `row-destructive` state'inde. Sol 3px rose-500 bar + rose-500 text yeterli. Satırın solunda **16px ikon** `help` veya `question_mark` (ink-400 değil rose-400). İlüstrasyon satırı şişirir, kırılır.

### 10.5.5 Disconnected depo (settings kartı)

**İlüstrasyon değil, state görselleştirmesi:**
- Kart sol üstünde büyük `depot-dot` (12px) — ink-300 solid + ink-200 ring (disconnected) / mint-500 + mint-500/20 ring (connected) / amber-500 + amber-500/30 ring (refreshing)
- "Bağlı Değil" kartında: sağ tarafta 32×32 küçük SVG — kırık zincir abstraction (iki yuvarlak link + ortada kopuş, tüm stroke ink-300). 24px max. Sadece disconnected kartlarda görünür. Connected kartta bu alan boş.
- "Bilgileri Doğrula" CTA altına bir satır: "Kullanıcı adı ve şifre girin, sistem otomatik test edecek" (ink-500, 12px)

### 10.5.6 Bulk dropzone (`.bulk-dropzone`)

**Mevcut:** `upload_file` Material ikonu 48px + 2 satır metin.

**Öneri:**
- Material ikonu kaldır
- Yerine **inline SVG**, 80×80: bir belge/sayfa outline (rounded rectangle, stroke 1.5) + üstte 3 yatay çizgi (ink-200, data satırları) + belgenin sağ üst köşesinde 90° katlanmış köşe + belgenin dışına çıkan tek aşağı ok (brand-400 stroke, upload ima)
- Hover / dragover: SVG stroke renkleri ink-300 → brand-500 geçişi (`--dur-base`)
- Metin hiyerarşi: "Dosyayı buraya bırakın" (ink-900, 16px, font-weight 700), "veya tıklayın — .xlsx, .csv, .txt" (ink-500, 13px)
- Alt sınırda: "Excel'den doğrudan yapıştırmak için üstteki sekmeyi kullanın" ipucu

### 10.5.7 Loading / skeleton

**SVG / İlüstrasyon KULLANMA.** Skeleton shimmer tek doğru teknik:
- `.skeleton-row`, `.skeleton-card`, `.skeleton-text` utility
- `background: linear-gradient(90deg, var(--ink-100) 0%, var(--ink-50) 50%, var(--ink-100) 100%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite;`
- Skeleton sırasında ekranın ortasında spinner, cube, animated logo vb. **eklenmez** — skeleton zaten loading iletişimi kurar
- Nadir istisna: ilk bootstrap / tüm-sistem yükleme (3+ saniye) için **sadece Navbar'da** 2px yüksek ince bir `.loader-bar` brand-500, sol→sağ 1500ms loop

### 10.5.8 Diğer boş state'ler

- **Sipariş geçmişi boş:** 64×64 SVG — tek takvim outline + içinde boş hücreler (grid). Accent yok.
- **Search suggestions boş:** İlüstrasyon yok, sadece "Sonuç yok" tek satır
- **Settings aktivasyon yok (hiç depo connected değil):** Ekran bu state'e düşmüşse zaten kritik — ilüstrasyon yerine **brand-50 bg + brand-500 border bilgi banner'ı** üstte: "Henüz hiç depo bağlı değil. Aramaya başlamak için en az bir depo ekleyin."

---

## 10.6 Veri Ekranları İçin Background Treatment

İlüstrasyon yasak olan 4 yüzeyde (detail, plan, bulk sonuç, decision table) atmosfer **CSS-only arka plan treatment** ile kurulur:

### 10.6.1 Subtle grid (mühendislik / operasyon hissi)
```
background-image:
  linear-gradient(var(--ink-200) 1px, transparent 1px),
  linear-gradient(90deg, var(--ink-200) 1px, transparent 1px);
background-size: 32px 32px;
opacity: 0.35;  /* grid element olarak wrapper’a apply */
```
Sadece **sayfa arka planına**, kart içeriklerine değil. Karta girince düz `#fff`. Bu, "kağıt → üstüne operasyon notu" metaforu kurar.

### 10.6.2 Radial accent (fokus noktasında)
- Product-hero'nun sağ üst köşesinde **çok hafif** brand glow:
  ```
  background-image:
    linear-gradient(180deg, #fff 0%, var(--ink-50) 100%),
    radial-gradient(circle at 85% -20%, rgba(99,102,241,0.08), transparent 40%);
  ```
- Bu "en uygun maliyet"in olduğu sağ bloğun olduğu tarafı çevreler, dikkatleri yumuşakça oraya çeker
- Glow **sabit**, animate edilmez

### 10.6.3 Divider texture
- Büyük section geçişlerinde `border-top: 1px solid ink-200` yerine:
  ```
  background-image: linear-gradient(90deg, transparent, var(--ink-200) 20%, var(--ink-200) 80%, transparent);
  height: 1px;
  ```
- Çizginin iki ucu fade — daha ciddi, daha az "form divider" hissi

### 10.6.4 Highlight row accent
`.row-best` için (§4.4'te bahsedilen):
```
background: linear-gradient(90deg, rgba(16,185,129,0.06) 0%, transparent 40%);
box-shadow: inset 3px 0 0 var(--mint-500);
```
Bu zaten bir "mini illüstrasyon" rolü oynar — satırın önemli olduğunu bir ikon olmadan anlatır.

### 10.6.5 Depot card subtle tint
Settings'te connected depo kartları için:
```
background: linear-gradient(180deg, #fff 0%, color-mix(in srgb, var(--ink-50) 80%, #fff) 100%);
```
Neredeyse görünmez, ama disconnected olanla ayrımı hisle kurar.

---

## 10.7 Özet

### V2.3 İçin Önerilen İlüstrasyon Stratejisi

**"Dört ada kuralı"** — İlüstrasyon sadece dört adada yaşar, diğer tüm yüzeyler salt metin + data + mikro-ikon:

1. **Login** — büyük, atmosferik, marka kuran tek kompozisyon
2. **Empty state'ler** (plan, variants, no-result) — küçük (48-80px), çizgisel, tek accent
3. **Bulk dropzone** — orta boy (80px), davet edici, brand-tonlu
4. **Disconnected durumlar** — mini (24-32px), durum simgesi

**Stil:** Mimari çizgi + geometrik abstraction. 1.5px stroke. Maksimum 2 renk. Accent oranı %15'in altında. Karakter yok, 3D yok, izometrik yok, gradient fill yok, animasyon yok.

**Teknik:** Inline SVG, `currentColor` ile tema uyumu. Asset dosyası yok. Her illüstrasyon 6 primitive altı.

**Arka plan katmanı:** Veri ekranlarında illüstrasyon yerine CSS grid + radial accent + gradient divider; görünmez ama hissedilen "mühendislik kağıdı" dokusu.

**Sonuç his:** Uygulama "hiç illüstrasyon yok" gibi görünür ama boş ve sparse yüzeyler yalnız değildir. Bu, Linear ve Height'ın kurduğu dengenin kendisi.

---

### Hiç Kullanılmaması Gereken Yerler

Kesinlikle illüstrasyon **yasak**:
- Search detail ürün hero'su (şu anki `add_a_photo` dashed placeholder dahil — kaldırılacak)
- Decision table (depo teklifleri)
- Plan page gruplar ve alt-tablo
- Plan drawer (iç kartlar + alternatif depolar + footer)
- MF calculator paneli
- Bulk sonuç tablosu satırları
- Navbar (logo dışında)
- Settings kartlarının ana gövdesi (sadece state dot + küçük disconnected mini-icon istisna)
- Toast / success banner / error banner (sadece semantik ikon)
- Herhangi bir tablo satırı, kart içeriği, form alanı
- Titlebar
- Loading / skeleton altına süs ("yükleme keyifli olsun" yasak)
- Sipariş gönderme onay modal'ı (olduğunda)
- Update / migration ekranları
- Herhangi bir konfirmasyon dialog'u

**Genel kural:** Kullanıcı bir **karar** verirken veya **data** okurken ilüstrasyon yok. Kullanıcı **beklerken**, **başlarken** veya **boş bir ekranla karşılaşırken** ilüstrasyon var.

---

### En Güvenli Uygulama Yaklaşımı

**3 adım, risk-yüklü olmayan sırayla:**

**Adım 1 — Arka plan treatment'ları önce uygula (risksiz, düşük kazanç değil).**
- Sayfa background'una subtle grid (dashboard + settings + bulk + plan)
- Product-hero radial glow (detail page)
- Row-best gradient + sol bar (decision table)
- Depo kartları subtle tint (settings)

Bu aşamadan sonra ekran zaten %80 "intentional" görünür. Hiç SVG eklemeden.

**Adım 2 — Empty / dropzone SVG'leri ekle (düşük risk, yüksek kazanç).**
- `.empty-state` utility class + inline SVG ile 4 varyant: plan, variants, no-result, history
- Bulk dropzone SVG'sini Material ikonun yerine
- Her biri tek helper fonksiyondan: `renderEmptyState({variant, title, body, cta})`
- Tasarımdan çıkıp geri dönmek kolay — sadece bir fonksiyon

Bu aşamadan sonra "ekran boş kaldığında ne yapacağımı biliyor" hissi kurulur.

**Adım 3 — Login'i yeniden ele al (yüksek risk, değerlidir ama son sırada).**
- Login tek büyük kompozisyon — yanlışı geri dönmesi zor
- Önce 2 adım iç yüzeyin başarılı olduğundan emin ol
- Sonra login kompozisyonunu **prototype olarak** yap, 1-2 hafta izle, sonra kalıcı yap
- Bu adımı atlamak da mümkün: mevcut sade login kalsın, sadece bokeh'ları tekilleştir

**Kırmızı bayraklar (yapılırsa geri al):**
- Herhangi bir SVG'nin içinde **karakter yüzü, el, ayak, capsule-with-eyes** — anında kaldır
- Renk dolu fill > %20 — nötrleştir
- Animasyonlu SVG (SMIL, CSS) — statikleştir
- 96px üstü illüstrasyon (login hariç) — küçült
- Emoji kullanımı UI'de (greeting'deki 👋 dahil) — kaldır veya opacity düşür
- "Eczane Pro, hayatınızı kolaylaştırır" tarzı landing copy + illüstrasyon yan yana — yasak
- Dashboard hero'ya "karakter + masa üstü" kompozisyon — yasak
- 3D izometrik paket/ilaç kutusu — yasak (itemiz yönü: flat çizgi)

**Güvenlik testi:** Tasarımı prod'a alınmadan önce iki sorudan geç:
1. "Bu illüstrasyon, yanında mevcut Bloomberg Terminal ekran görüntüsü olsaydı yabancı kalır mıydı?" — evet ise fazla oyunumsu
2. "Kullanıcı bu ekranda karar mı veriyor, yoksa bekliyor/başlıyor mu?" — karar veriyorsa illüstrasyon yok

---

**Kısa özet:** İlüstrasyon bu uygulamada **yüksek-değerli ama dar bir araç** — sadece 4 ada yüzeyinde, mimari çizgi tarzında, monochrome + tek accent olarak çalışır. Veri ekranları ilüstrasyon değil **CSS arka plan treatment'ı** ile atmosfer kazanır. Bu iki katman birlikte uygulandığında arayüz "zengin ama ciddi" hisseder — şu anki "düz ama yarım" hissiyatının tam karşıtı.
---

**Kısa özet:** Bu spec 3 şeyi hedefliyor — (1) iki stil sistemi → tek sistem, (2) "hareket için hareket" animasyonları → sadece state bildiren 8 adet tanımlı motion, (3) mocklup hissini veren placeholder'ları (dashed ikon, inline hover, pulse glow) intentional görsellerle değiştirmek. Hiçbiri yeni feature değil; hepsi mevcut DOM + mevcut JS renderer ile uyumlu. Faz 1 tek başına uygulansa bile arayüz %60 daha kurumsal görünür.