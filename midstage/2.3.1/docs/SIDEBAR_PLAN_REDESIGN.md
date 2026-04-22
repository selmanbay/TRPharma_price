# Sidebar Plan Section Redesign — Çıkarımlar

**Tarih**: 2026-04-22
**Dosya**: `renderer/scripts/detail-ui.js`, `renderer/styles/detail-hero.css`, `renderer/styles/main.css`

---

## Sorun

Eski tasarım:
- Plan kalemleri yatay scroll edilebilen kartlar olarak gösteriliyordu (`v23-plan-snippet-list` → `overflow-x: auto`)
- Her kart içinde ilaç küçük resmi, ad, depo etiketi, adet ve fiyat vardı
- Kartlar büyük (min 220px genişlik) ve sidebar'a sığmıyordu → yatay scroll zorunlu oluyordu
- Görsel olarak çirkin, kullanım açısından zor

---

## Çıkarım: Neden Kötüydü

1. **Yatay scroll sidebar'da çalışmaz** — sidebar sabit genişlikte ve sidebar zaten dikey scroll yapıyor. İç içe yatay scroll kullanıcıyı şaşırtır.
2. **Kartlar çok büyük** — 220px+ kart sidebar'ın (yaklaşık 280–320px) büyük kısmını tek kalemle dolduruyordu. 3+ kalemin yan yana gösterilmesi imkansızdı.
3. **Gereksiz görsel ağırlık** — ilaç thumb resmi, border-radius'lu kart, shadow → bilgi yoğunluğunu düşürüyordu.
4. **Fiyat bilgisi yoktu** — toplam maliyet sidebar'da görünmüyordu.

---

## Karar: Dikey Kompakt Liste

Yeni yaklaşım: her plan kalemi tek satır olarak sıralanır.

```
[numara]  İlaç adı (truncated)     fiyat
          Depo · adet
```

- Numara: 18px daire, açık gri arka plan
- Ad: 600 weight, tek satır truncate
- Meta: depo + adet, küçük muted
- Fiyat: sağa hizalı, tabular-nums
- Satır hover: hafif gri arka plan

En fazla 8 kalem gösterilir (`plan.slice(0, 8)`). Plan daha uzunsa kullanıcı "Planı düzenle" butonuyla tam plan sayfasına gider.

---

## Footer

Toplam maliyet + "Planı düzenle ve gönder" butonu her zaman altta görünür.

- Toplam: `v23-plan-total-label` + `v23-plan-total-value` (800 weight, büyük)
- Buton: `v23-plan-goto-btn`, tam genişlik, mavi (`--sb-accent`), `onclick="switchMock('plan')"`

---

## Boş Durum

Plan boşsa `v23-plan-rows__empty` — ortada inbox ikonu + "Plan boş" metni. Kullanıcı neden içerik olmadığını anlar.

---

## CSS Temizliği

Silinen eski sınıflar:
- `main.css`: `.v23-plan-summary-toolbar`, `.v23-plan-snippet-list` (yatay), `.v23-plan-summary-card`
- `detail-hero.css`: `.v23-plan-snippet-list`, `.v23-plan-snippet`, `.v23-plan-snippet__thumb`, `.v23-plan-snippet__body`, `.v23-plan-snippet__top`, `.v23-plan-snippet__name`, `.v23-plan-snippet__price`, `.v23-plan-snippet__foot`, `.v23-plan-snippet__qty`, `.v23-detail-sidebar__btn-plan`

Eklenen yeni sınıflar (hepsi `detail-hero.css`'de):
- `v23-plan-section-head`, `v23-plan-section-badge`
- `v23-plan-rows`, `v23-plan-rows__empty`
- `v23-plan-row`, `v23-plan-row__num`, `v23-plan-row__info`, `v23-plan-row__name`, `v23-plan-row__meta`, `v23-plan-row__price`
- `v23-plan-section-foot`, `v23-plan-total-row`, `v23-plan-total-label`, `v23-plan-total-value`
- `v23-plan-goto-btn`

---

## HTML Değişikliği (detail-ui.js)

`renderDetailPage()` içindeki plan section tamamen yeniden yazıldı. Eski `v23-plan-snippet-list` → yeni `v23-plan-rows` yapısına geçildi. `plan.slice(0, 8)` ile max 8 kalem render edilir. Her kalemde:

- `lineTitle`: `item.name` veya `item.ad` (12 karakter truncate yok, CSS truncate)
- `qty`: `item.qty || item.quantity || 1`
- `item.depot`: depo adı
- `formatCurrency(item.totalCost)`: kalemin toplam maliyeti

`planMetrics.totalCost` tüm kalemlerin toplamı için `app.js`'deki mevcut `_calcPlanMetrics()` fonksiyonundan gelir.
