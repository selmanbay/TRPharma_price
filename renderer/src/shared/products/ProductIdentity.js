export function getItemBarcode(item, fallbackQuery, deps) {
  const { extractBarcode, parseQRCode, isBarcodeQuery } = deps;
  const direct = String(item?.barkod || '').trim();
  if (direct) return direct;

  const extracted = extractBarcode(item?.kodu);
  if (extracted) return extracted;

  const parsedQuery = parseQRCode(fallbackQuery);
  return isBarcodeQuery(parsedQuery) ? parsedQuery : '';
}

export function getBarcodeHints(items, fallbackQuery, deps) {
  const { normalizeDrugName } = deps;
  const hints = new Map();
  for (const item of items || []) {
    const barcode = getItemBarcode(item, fallbackQuery, deps);
    const nameKey = normalizeDrugName(item?.ad);
    if (barcode && nameKey && !hints.has(nameKey)) {
      hints.set(nameKey, barcode);
    }
  }
  return hints;
}

export function resolveItemBarcode(item, barcodeHints, fallbackQuery, deps) {
  const { normalizeDrugName } = deps;
  return getItemBarcode(item, fallbackQuery, deps) || barcodeHints.get(normalizeDrugName(item?.ad)) || '';
}

export function getItemIdentityKey(item, barcodeHints, fallbackQuery, deps) {
  const { normalizeDrugName } = deps;
  const barcode = resolveItemBarcode(item, barcodeHints, fallbackQuery, deps);
  if (barcode) return `BARCODE_${barcode}`;
  return `NAME_${normalizeDrugName(item?.ad)}`;
}

export function chooseCanonicalProductName(items, fallbackName) {
  const names = (items || [])
    .map((item) => String(item?.ad || '').trim())
    .filter(Boolean);

  if (!names.length) {
    return fallbackName || 'Bilinmeyen Ilac Formu';
  }

  names.sort((a, b) => a.length - b.length || a.localeCompare(b, 'tr'));
  return names[0];
}

export function comparePreferredItems(a, b, deps) {
  const { isUsableImageUrl, normalizeImageUrl } = deps;
  const aInStock = a?.stokVar ? 1 : 0;
  const bInStock = b?.stokVar ? 1 : 0;
  if (aInStock !== bInStock) return bInStock - aInStock;

  const aHasPrice = a?.fiyatNum > 0 ? 1 : 0;
  const bHasPrice = b?.fiyatNum > 0 ? 1 : 0;
  if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice;

  if (aHasPrice && bHasPrice && a.fiyatNum !== b.fiyatNum) {
    return a.fiyatNum - b.fiyatNum;
  }

  const aHasImage = isUsableImageUrl(normalizeImageUrl(a?.imgUrl, a?.depotUrl)) ? 1 : 0;
  const bHasImage = isUsableImageUrl(normalizeImageUrl(b?.imgUrl, b?.depotUrl)) ? 1 : 0;
  if (aHasImage !== bHasImage) return bHasImage - aHasImage;

  const aName = String(a?.ad || '');
  const bName = String(b?.ad || '');
  return aName.length - bName.length || aName.localeCompare(bName, 'tr');
}

export function dedupeSearchItems(items, query, deps) {
  const { normalizeDrugName } = deps;
  if (!Array.isArray(items) || items.length === 0) return [];

  const barcodeHints = getBarcodeHints(items, query, deps);
  const groups = new Map();

  for (const item of items) {
    const barcode = resolveItemBarcode(item, barcodeHints, query, deps);
    const identityKey = barcode ? `BARCODE_${barcode}` : `NAME_${normalizeDrugName(item?.ad)}`;
    const prepared = {
      ...item,
      barkod: barcode || String(item?.barkod || '').trim(),
    };

    if (!groups.has(identityKey)) {
      groups.set(identityKey, []);
    }
    groups.get(identityKey).push(prepared);
  }

  const deduped = [];
  for (const groupItems of groups.values()) {
    const canonicalName = chooseCanonicalProductName(groupItems, query);
    const canonicalBarcode = groupItems.find((item) => item.barkod)?.barkod || '';
    const depotItems = new Map();

    for (const item of groupItems) {
      const depotKey = `${item.depotId || ''}::${item.depot || ''}`;
      const prepared = {
        ...item,
        ad: canonicalName,
        barkod: canonicalBarcode || item.barkod || '',
      };
      const existing = depotItems.get(depotKey);
      if (!existing || comparePreferredItems(prepared, existing, deps) < 0) {
        depotItems.set(depotKey, prepared);
      }
    }

    deduped.push(...depotItems.values());
  }

  return deduped;
}

export function getSearchIdentity(items, query, deps) {
  const { isBarcodeQuery, slugifyName } = deps;
  const normalizedItems = dedupeSearchItems(items || [], query, deps);
  const firstItem = normalizedItems?.[0] || items?.[0] || {};
  const barcodeHints = getBarcodeHints(normalizedItems, query, deps);
  const identityKeys = Array.from(new Set(normalizedItems.map((item) => getItemIdentityKey(item, barcodeHints, query, deps))));
  const barcode = isBarcodeQuery(query)
    ? query
    : (identityKeys.length === 1 ? resolveItemBarcode(firstItem, barcodeHints, query, deps) : '');
  const name = identityKeys.length === 1
    ? chooseCanonicalProductName(normalizedItems, firstItem.ad || query)
    : (query || firstItem.ad || '');

  return {
    name,
    barcode,
    query: barcode || query || name || '',
    key: barcode || slugifyName(name || query || 'urun'),
  };
}

export function getProductIdentity(items, query, deps) {
  return getSearchIdentity(items, query, deps);
}
