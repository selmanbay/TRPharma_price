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
  const { isBarcodeQuery, parseMf } = deps;
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

export function createLocalJsonStore() {
  return {
    STORAGE_KEYS,
    readStoredJson,
    writeStoredJson,
    normalizeOrderPlanItem,
    normalizeRoutineItem,
    getOrderPlan,
    saveOrderPlan,
    getRoutineList,
    saveRoutineList,
  };
}
