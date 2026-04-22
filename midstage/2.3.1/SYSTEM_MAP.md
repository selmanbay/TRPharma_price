# Eczane App v2.3.1 — System Map

## 1. Directory Structure (Renderer)

```
/renderer/
├── index.html                 # Ana uygulama shell
├── scripts/                   # Core runtime modülleri
│   ├── app.js                 # *** ANA ORKESTRATÖR (3200+ satır) ***
│   ├── utils.js               # Paylaşılan yardımcılar
│   ├── runtime-coordinator.js # AbortController + event bus
│   ├── security-guards.js     # Input validasyon & URL güvenliği
│   ├── app-runtime.js         # Auth/session yönetimi
│   ├── app-actions.js         # Cross-modül action agregator
│   ├── navigation-runtime.js  # Sayfa navigasyon durumu
│   ├── operation-identity.js  # Ürün/depo kimlik çözümleme
│   ├── operation-state.js     # Plan state sorguları
│   ├── search-domain.js       # Arama sıralama ve gruplama
│   ├── offer-domain.js        # Teklif hesaplama
│   ├── plan-domain.js         # Plan gruplama + drawer mantığı
│   ├── search-actions.js      # Arama kullanıcı aksiyonları
│   ├── detail-actions.js      # Detay sayfası aksiyonları
│   ├── plan-actions.js        # Plan mutasyon aksiyonları
│   ├── plan-mutations.js      # State → DOM pipeline
│   ├── search-ui.js           # Arama HTML render
│   ├── detail-ui.js           # Detay sayfası HTML render
│   ├── plan-ui.js             # Plan sayfası HTML render
│   ├── bulk-ui.js             # Toplu giriş HTML render
│   └── shell-ui.js            # Login/home/settings HTML
├── src/                       # Modüler iş mantığı
│   ├── domain/
│   │   ├── DrugEntity.js
│   │   ├── OrderDataEngine.js  # MF hesaplama motoru
│   │   ├── DrugOperationEntity.js
│   │   └── DepotEntity.js
│   ├── features/
│   │   ├── plan/WorkspacePlanView.js
│   │   ├── pricing/LegacyPricingEngine.js
│   │   └── search/
│   ├── ui/views/
│   │   ├── StockCalculator.js  # MF flyout panel
│   │   └── SearchLayout.js
│   └── shared/
│       ├── LegacySharedHelpers.js
│       └── storage/LocalJsonStore.js
└── styles/
    ├── main.css
    └── detail-hero.css
```

---

## 2. Script Yükleme Sırası

```
utils.js → runtime-coordinator.js → security-guards.js
→ operation-identity.js → app-runtime.js → navigation-runtime.js
→ search-domain.js → offer-domain.js
→ search-actions.js → detail-actions.js → plan-actions.js → app-actions.js
→ plan-domain.js → plan-ui.js → search-ui.js → bulk-ui.js → shell-ui.js → detail-ui.js
→ operation-state.js → plan-mutations.js
→ app.js  ← HER ŞEYİ BAĞLAR
```

---

## 3. Global Bridge Tablosu

| Bridge | Modül | Rol |
|--------|-------|-----|
| `V23DetailUI` | detail-ui.js | Detay sayfası HTML + `patchDetailQty` |
| `V23SearchUI` | search-ui.js | Arama/varyant HTML render |
| `V23PlanUI` | plan-ui.js | Plan sayfası HTML render |
| `V23BulkUI` | bulk-ui.js | Toplu giriş HTML render |
| `V23ShellUI` | shell-ui.js | Login/home HTML render |
| `V23DetailActions` | detail-actions.js | Detay aksiyonları |
| `V23SearchActions` | search-actions.js | Arama aksiyonları |
| `V23PlanActions` | plan-actions.js | Plan aksiyonları |
| `V23AppActions` | app-actions.js | Cross-modül aggregator |
| `V23PlanMutations` | plan-mutations.js | State → DOM pipeline |
| `V23SearchDomain` | search-domain.js | Sıralama, gruplama, scoring |
| `V23PlanDomain` | plan-domain.js | Plan gruplama + drawer |
| `V23OfferDomain` | offer-domain.js | Teklif hesaplama |
| `V23OperationIdentity` | operation-identity.js | Depo/ürün kimlik eşleştirme |
| `V23OperationState` | operation-state.js | Plan state sorguları |
| `V23AppRuntime` | app-runtime.js | Auth, login, authFetch |
| `V23SecurityGuards` | security-guards.js | URL/input validasyon |
| `EczaneRuntimeCoordinator` | runtime-coordinator.js | AbortController + event bus |

---

## 4. State Objesi (app.js)

```javascript
state = {
  // Auth
  token, user: { displayName, id },

  // Navigasyon
  currentPage: 'login' | 'home' | 'search-variants' | 'search-detail' | 'plan' | 'bulk',

  // Arama
  currentSearchQuery, currentSearchItems[], searchGroups[],
  searchLoading, searchError,

  // Detay
  currentDetailQuery, currentDetailItems[], selectedOfferKey,
  desiredQty,              // Hedef adet (qty stepper)
  mfCalculatorOpen,        // MF panel açık/kapalı

  // Toplu giriş
  bulkRows[], bulkDrawerIndex,

  // Plan (localStorage'a kaydedilir)
  orderPlan[], approvalQueue[], approvalSelection[],
}
```

**Kalıcılık**: `orderPlan` ve `approvalQueue` → `localStorage['eczane.*']`

---

## 5. Akış Örneği: Plana Ekle

```
Kullanıcı "Plana Ekle" tıklar
  └─ addSelectedOfferToPlan()        [detail-actions.js]
       ├─ getSelectedDetailItem()    [app-actions.js]
       ├─ buildPlanPayloadFromOffer()
       └─ upsertPlanOperationItem()  [plan-mutations.js]
            ├─ saveOrderPlan()       [app.js → localStorage]
            └─ renderPlanSurfaces()  [app.js]
                 ├─ renderPlanPageV2()
                 └─ renderDetailPage()
```

---

## 6. Akış Örneği: Adet Değişimi (Qty Stepper)

```
Kullanıcı + / − tıklar
  └─ changeDesiredQty(±1)            [app.js]
       └─ setDesiredQty(next)
            ├─ [Planda ise] applyPlanQtyFromDetailSelection()
            └─ [Planda değilse] V23DetailUI.patchDetailQty()  ← HEDEFLI DOM GÜNCELLEME
                 ├─ #v23-qty-display, #v23-qty-badge
                 ├─ #desiredQtyInput (fokus korunur)
                 ├─ #v23-price-value, #v23-sidebar-unit
                 ├─ #v23-ic-order/receive/total/effective
                 ├─ tr[data-offer-key] maliyet hücreleri
                 └─ [data-chip-qty] aktif chip güncelleme
```

---

## 7. MF (Mal Fazlası) Sistemi

```
Veri: malFazlasi: "5+1"   →  parseMf()  →  { buy:5, free:1, total:6 }

OrderDataEngine.calculateBestOptions(items, qty)
  ├─ _buildUnitOptions()    düz alım seçenekleri
  └─ _calcMfOptions()       MF batchleri hesapla
       └─ effectiveUnit = (orderQty × birimFiyat) / receiveQty

detail-ui.js buildMfQtyChips()
  └─ mf.total × [1..5] → chip önerileri
       chip gösterimi: "6" büyük + "5+1" küçük label
```

---

## 8. Modül Sorumlulukları

| Katman | Modüller | Kural |
|--------|----------|-------|
| **UI Render** | *-ui.js | Saf HTML string döner, DOM'a dokunmaz |
| **Domain** | *-domain.js, OrderDataEngine | Saf fonksiyonlar, state yok |
| **Actions** | *-actions.js | Kullanıcı aksiyonu → state mutasyonu |
| **Mutations** | plan-mutations.js | State değişimi → re-render tetikle |
| **Runtime** | app.js, app-runtime.js | Bootstrap, fetch, auth, tüm köprüler |
