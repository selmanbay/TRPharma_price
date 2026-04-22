export const STORAGE_KEYS = {
  orderPlan: 'eczane.orderPlan.v1',
  routineList: 'eczane.routineList.v1',
};

export function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeOrderPlanItem(item, deps) {
  const {
    isBarcodeQuery,
    parseMf,
  } = deps;

  const barcode = String(item?.barcode || '').trim();
  if (!isBarcodeQuery(barcode)) {
    return null;
  }

  const desiredQty = Math.max(parseInt(item?.desiredQty, 10) || 1, 1);
  const rawOrderQty = Math.max(parseInt(item?.orderQty, 10) || 0, 0);
  const rawTotalCost = Number(item?.totalCost) || 0;
  const derivedUnit = Number(item?.effectiveUnit)
    || Number(item?.unitPrice)
    || (rawOrderQty > 0 ? rawTotalCost / rawOrderQty : 0)
    || (desiredQty > 0 ? rawTotalCost / desiredQty : 0);

  const nextItem = {
    ...item,
    key: barcode,
    barcode,
    query: barcode,
    desiredQty,
    orderQty: desiredQty,
    receiveQty: desiredQty,
    totalCost: derivedUnit > 0 ? derivedUnit * desiredQty : rawTotalCost,
    effectiveUnit: derivedUnit,
    planningMode: item?.planningMode || 'unit',
  };

  const legacyMf = parseMf(nextItem.mfStr);
  const isLegacySingleUnitMf =
    nextItem.planningMode !== 'mf' &&
    nextItem.desiredQty === 1 &&
    legacyMf &&
    nextItem.orderQty > 1 &&
    nextItem.receiveQty > 1 &&
    nextItem.totalCost > 0;

  if (isLegacySingleUnitMf) {
    const derivedUnitPrice = nextItem.orderQty > 0 ? nextItem.totalCost / nextItem.orderQty : nextItem.totalCost;
    nextItem.orderQty = 1;
    nextItem.receiveQty = 1;
    nextItem.totalCost = derivedUnitPrice;
    nextItem.effectiveUnit = derivedUnitPrice;
    nextItem.planningMode = 'unit';
  }

  return nextItem;
}

export function normalizeRoutineItem(item, deps) {
  const { slugifyName } = deps;
  const barcode = String(item?.barcode || '').trim();
  return {
    ...item,
    key: barcode || String(item?.key || slugifyName(item?.name || item?.query || 'urun')).trim(),
    barcode,
    query: String(barcode || item?.query || item?.name || '').trim(),
  };
}

export function getOrderPlan(deps) {
  const { dedupeStoredItems, normalizeOrderPlanItemFn } = deps;
  return dedupeStoredItems(
    readStoredJson(STORAGE_KEYS.orderPlan, []).map(normalizeOrderPlanItemFn).filter(Boolean),
    (item) => `${item.key}::${item.depot || ''}`
  );
}

export function saveOrderPlan(items, deps) {
  const { normalizeOrderPlanItemFn } = deps;
  writeStoredJson(
    STORAGE_KEYS.orderPlan,
    (items || []).map(normalizeOrderPlanItemFn).filter(Boolean)
  );
}

export function getRoutineList(deps) {
  const { dedupeStoredItems, normalizeRoutineItemFn } = deps;
  return dedupeStoredItems(
    readStoredJson(STORAGE_KEYS.routineList, []).map(normalizeRoutineItemFn),
    (item) => item.key
  );
}

export function saveRoutineList(items) {
  writeStoredJson(STORAGE_KEYS.routineList, items);
}

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
