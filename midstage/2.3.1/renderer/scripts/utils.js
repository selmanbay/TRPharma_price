/**
 * utils.js - Eczane App Saf Yardimci Fonksiyonlar
 *
 * Bu dosya sadece stateless, bagimsiiz, test edilebilir yardimcilar icerir.
 * Hic bir global state, DOM veya API baglamligi yoktur.
 * index.html'de auth.js ve app.js'den ONCE yuklenir.
 *
 * Faz 3 - Stabilizasyon: app.js'den ayristirilan moduler katman.
 */

// ── Barkod & QR ────────────────────────────────────────────────────────────────

/**
 * Urun kodundan 13 haneli barkod cikarir.
 * Barkodlar genellikle 8 ile baslar.
 */
function extractBarcode(kodu) {
  if (!kodu) return null;
  const str = String(kodu).trim();
  if (str.length >= 13 && str.startsWith('8')) return str;
  return null;
}

/**
 * Karekod (GS1 DataMatrix) icinden 13 haneli barkodu ayiklar.
 * Ornek: 010869953609011521... -> 8699536090115
 */
function parseQRCode(input) {
  if (!input) return null;
  const raw = String(input).trim();

  // 1. Zaten temiz barkodsa direkt dondur (0 dolgusuz 13 hane)
  if (/^869\d{10}$/.test(raw)) return raw;

  // 2. 0 ile baslayan 14 haneli (0+869...) ise 0'i at
  if (/^0869\d{10}$/.test(raw)) return raw.substring(1);

  // 3. GS1 DataMatrix: 01 ile baslar, 14 haneli GTIN icerir
  if (raw.startsWith('01') && raw.length >= 16) {
    // 01(2 hane) + 0(dolgu 1 hane) + 13(barkod)
    const gtinCandidate = raw.substring(3, 16);
    if (gtinCandidate.startsWith('869')) return gtinCandidate;

    // Bazi dolgu senaryolari icin (Padding check)
    const gtinCandidate2 = raw.substring(2, 15);
    if (gtinCandidate2.startsWith('869')) return gtinCandidate2;
  }

  // 4. Fallback search: Herhangi bir 869... 13 haneli dizisi bul
  const match = raw.match(/869\d{10}/);
  return match ? match[0] : raw;
}

/**
 * Verilen deger 13+ haneli rakam dizisi mi? (barkod sorgusu kontrolu)
 */
function isBarcodeQuery(value) {
  return /^\d{13,}$/.test(String(value || '').trim());
}

/**
 * Urun kimligi (plan / arama eslemesi) icin barkod kanonik formu.
 * Rakam disini kirp; 13+ hane varsa son 13 haneyi EAN-13 (869...) odakli alir.
 */
function normalizeProductBarcode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.length >= 13) {
    const tail = digits.slice(-13);
    if (tail.startsWith('869')) return tail;
    return tail;
  }
  return digits;
}

// ── Isin Adi Normalize ─────────────────────────────────────────────────────────

/**
 * Ilac adini normalize eder — buyuk harf, kisaltma standartlastirma.
 */
function normalizeDrugName(name) {
  if (!name) return 'Bilinmeyen Ilac Formu';
  let n = name.toUpperCase();
  n = n.replace(/\b(TABLET|TAB\.|TB\.|TAB|TB)\b/g, 'TAB');
  n = n.replace(/\b(KAPSUL|KAP\.|KPS\.)\b/g, 'KAP');
  n = n.replace(/\b(FILM TAB|FLM TAB|FLM\.TAB|F\.TAB|F\. TABLET|FILM TABLET)\b/g, 'FILM TAB');
  n = n.replace(/\b(SURUP|SRP|SYR)\b/g, 'SURUP');
  n = n.replace(/\b(SUSPANSIYON|SUSP\.)\b/g, 'SUSP');
  n = n.replace(/\b(PED\.|PEDIATRIK)\b/g, 'PED');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

/**
 * UTF-8 metnin latin1/cozulmemis okunmasindan kaynakli mojibake sorunlarini duzeltir.
 * Ornek: "MÃ¼steri" -> "Müşteri"
 */
function fixMojibakeText(value) {
  if (value == null) return '';
  const raw = String(value);
  if (!/[ÃÄÅÂâ]/.test(raw)) return raw;
  const replacements = [
    ['Ä±', 'ı'], ['Ä°', 'İ'],
    ['Ã¼', 'ü'], ['Ãœ', 'Ü'],
    ['Ã¶', 'ö'], ['Ã–', 'Ö'],
    ['Ã§', 'ç'], ['Ã‡', 'Ç'],
    ['ÅŸ', 'ş'], ['Åž', 'Ş'],
    ['ÄŸ', 'ğ'], ['Äž', 'Ğ'],
    ['â€“', '-'], ['â€”', '-'],
    ['â€˜', "'"], ['â€™', "'"],
    ['â€œ', '"'], ['â€\u009d', '"'],
    ['Â', ''],
  ];
  let next = raw;
  replacements.forEach(([from, to]) => {
    next = next.split(from).join(to);
  });
  return next;
}

// ── Slug ───────────────────────────────────────────────────────────────────────

function slugifyName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Gorsel URL ─────────────────────────────────────────────────────────────────

function normalizeImageUrl(url, baseUrl) {
  baseUrl = baseUrl || '';
  if (!url) return '';
  const raw = String(url).trim();
  if (!raw) return '';
  // Nevzat göreli görsel yolu (current-modular / depot-manager ile aynı semantik)
  if (raw.startsWith('/Resim')) {
    return 'https://www.nevzatecza.com.tr' + raw;
  }
  if (raw.startsWith('//')) return 'https:' + raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (baseUrl) {
    try {
      return new URL(raw, baseUrl).toString();
    } catch (_) {}
  }
  return raw;
}

function isUsableImageUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  return !['yok', 'no-image', 'noimage', 'default', 'c=.png'].some(function(keyword) {
    return lower.includes(keyword);
  });
}

function getImageFallbackSvg(size) {
  size = size || 24;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>';
}

// ── Para Formati ───────────────────────────────────────────────────────────────

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2).replace('.', ',')} ₺`;
}

// ── MF (Mal Fazlasi) Parser ────────────────────────────────────────────────────

/**
 * "10+3" -> { buy: 10, free: 3, total: 13 }
 * Gecersiz format icin null doner.
 */
function parseMf(mfStr) {
  if (!mfStr) return null;
  const m = String(mfStr).match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return null;
  const buy = parseInt(m[1], 10);
  const free = parseInt(m[2], 10);
  if (buy <= 0 || free <= 0) return null;
  return { buy: buy, free: free, total: buy + free };
}

// ── Dedupe Yardimcisi ──────────────────────────────────────────────────────────

function dedupeStoredItems(items, getKey) {
  const map = new Map();
  for (const item of (items || [])) {
    const key = getKey(item);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

// ── Concurrency Limiter ────────────────────────────────────────────────────────

/**
 * Saf JS concurrency limiter — bagimlilik eklemeye gerek kalmaz.
 * tasks: (() => Promise)[] dizisi
 * limit: max es zamanli calisan gorevi sayisi
 * Promise.all gibi sonuc dizer ama en fazla `limit` kadar paralel calisir.
 */
async function runConcurrent(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const i = nextIdx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = [];
  const concurrency = Math.min(limit, tasks.length);
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
