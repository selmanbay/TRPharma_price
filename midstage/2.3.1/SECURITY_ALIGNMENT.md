# V2.3 Security Alignment (from V2.2)

Bu not V2.2'de uygulanan security hardening kararlarinin V2.3 runtime'a nasil tasindigini takip eder.

## Tasinan Kurallar

- **URL Acma Guard'i**
  - V2.2: `open-url-in-chrome` sadece `http/https` kabul eder.
  - V2.3: frontend runtime'ta ikinci katman guard eklendi (`V23SecurityGuards.isSafeHttpUrl`).
  - Etki: `openUrl()` unsafe scheme (`javascript:`, `file:` vb.) acmaz.

- **Search Input Sanitization**
  - V2.2: auth/search akislarinda normalize ve kontrollu giris isleme vardi.
  - V2.3: `runSearch()` input'u kontrol karakterlerinden temizler ve uzunlugu sinirlar (`sanitizeSearchInput`).
  - Etki: state/render akisina kirli girdi tasinma riski azalir.

- **Defense-in-depth Prensibi**
  - Server tarafi guard varsa frontend tarafinda da temel validasyon yapilir.
  - Frontend guard asla backend/security middleware yerine gecmez.

## Halen Server-Owner Olan Basliklar

Bu basliklar frontend tarafina degil backend owner'a aittir:

- Auth rate limit
- Token validation (header-only)
- Host bind (`127.0.0.1`)
- Security headers
- Cookie injection allowlist

## Sonraki Adimlar

- Search/bulk/panel URL olusturan tum helperlarda ortak `safeUrl` wrapper kullanmak.
- Runtime diagnostic loglarinda security-relevant redaction (token/cookie masking) eklemek.
