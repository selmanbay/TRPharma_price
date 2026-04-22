export function comparePlannerOptions(a, b) {
  const aUnit = Number(a?.effectiveUnit) || Number.MAX_SAFE_INTEGER;
  const bUnit = Number(b?.effectiveUnit) || Number.MAX_SAFE_INTEGER;
  if (Math.abs(aUnit - bUnit) > 0.0001) return aUnit - bUnit;

  const aTotal = Number(a?.totalCost) || Number.MAX_SAFE_INTEGER;
  const bTotal = Number(b?.totalCost) || Number.MAX_SAFE_INTEGER;
  if (Math.abs(aTotal - bTotal) > 0.0001) return aTotal - bTotal;

  const aDepot = String(a?.depot || a?.depotId || '');
  const bDepot = String(b?.depot || b?.depotId || '');
  return aDepot.localeCompare(bDepot, 'tr');
}

function bestPerDepot(options) {
  const best = new Map();
  options.forEach((opt) => {
    const key = opt.depot;
    if (!best.has(key) || opt.effectiveUnit < best.get(key).effectiveUnit) {
      best.set(key, opt);
    }
  });
  return Array.from(best.values()).sort(comparePlannerOptions);
}

export function buildUnitOptions(items, targetQty = 1) {
  const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
  const allOptions = (items || [])
    .filter((i) => i.fiyatNum > 0)
    .map((item) => ({
      depot: item.depot,
      depotId: item.depotId,
      depotUrl: item.depotUrl,
      mf: null,
      mfStr: '',
      orderQty: safeQty,
      receiveQty: safeQty,
      totalCost: safeQty * item.fiyatNum,
      effectiveUnit: item.fiyatNum,
      unitPrice: item.fiyatNum,
      availableMfStr: item.malFazlasi || '',
      ad: item.ad,
      sourceItem: item,
      pricingMode: 'unit',
    }));
  return bestPerDepot(allOptions);
}

export function calcMfOptions(items, targetQty, deps) {
  const { parseMf } = deps;
  const allOptions = (items || [])
    .filter((i) => i.fiyatNum > 0)
    .map((item) => {
      const mf = parseMf(item.malFazlasi);
      const unitPrice = item.fiyatNum;

      if (!mf || targetQty < mf.total) {
        return {
          depot: item.depot,
          depotId: item.depotId,
          depotUrl: item.depotUrl,
          mf: null,
          mfStr: '',
          orderQty: targetQty,
          receiveQty: targetQty,
          totalCost: targetQty * unitPrice,
          effectiveUnit: unitPrice,
          unitPrice,
          availableMfStr: item.malFazlasi || '',
          ad: item.ad,
          sourceItem: item,
          pricingMode: 'unit',
        };
      }

      const batches = Math.ceil(targetQty / mf.total);
      const orderQty = batches * mf.buy;
      const receiveQty = batches * mf.total;
      return {
        depot: item.depot,
        depotId: item.depotId,
        depotUrl: item.depotUrl,
        mf,
        mfStr: item.malFazlasi,
        orderQty,
        receiveQty,
        totalCost: orderQty * unitPrice,
        effectiveUnit: (orderQty * unitPrice) / receiveQty,
        unitPrice,
        availableMfStr: item.malFazlasi || '',
        ad: item.ad,
        sourceItem: item,
        pricingMode: 'fallback',
      };
    });

  return bestPerDepot(allOptions);
}

export function getFallbackPlannerOptions(items, targetQty, deps) {
  const { shouldUseMfForQty, parseMf } = deps;
  const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
  return shouldUseMfForQty(safeQty)
    ? calcMfOptions(items, safeQty, { parseMf })
    : buildUnitOptions(items, safeQty);
}

export function getPlannerOptionDetailText(option, requestedQty) {
  const safeQty = Math.max(parseInt(requestedQty, 10) || 1, 1);
  const availableMf = option.availableMfStr || option.mfStr || '';
  const hasAppliedMf = safeQty > 1 && option.mfStr && (option.receiveQty > option.orderQty || !!option.mf);

  if (hasAppliedMf) {
    return `MF ${option.mfStr} · ${option.orderQty} al ${option.receiveQty} gel`;
  }
  if (availableMf) {
    return `MF ${availableMf}`;
  }
  return `${option.orderQty} adet`;
}

export function getBulkOfferDetailText(option, requestedQty, deps) {
  const { shouldUseMfForQty } = deps;
  const safeQty = Math.max(parseInt(requestedQty, 10) || 1, 1);
  const availableMf = option.availableMfStr || option.mfStr || '';
  if (!shouldUseMfForQty(safeQty)) {
    return availableMf ? `MF ${availableMf}` : `${safeQty} adet`;
  }
  if (availableMf) {
    return `Hedef ${safeQty} adet · MF ${availableMf}`;
  }
  return `Hedef ${safeQty} adet`;
}

export function buildQuoteCacheKey(item, option, targetQty) {
  return [
    item?.depotId || '',
    item?.kodu || item?.barcode || item?.ad || '',
    option?.mfStr || '',
    option?.orderQty || '',
    option?.receiveQty || '',
    targetQty || '',
  ].join('::');
}

export async function fetchQuotedOption(item, option, targetQty, deps) {
  const { authFetch, apiBase, quoteCache } = deps;
  if (!item?.depotId) return option;

  const cacheKey = buildQuoteCacheKey(item, option, targetQty);
  if (quoteCache.has(cacheKey)) {
    return quoteCache.get(cacheKey);
  }

  try {
    const res = await authFetch(`${apiBase}/api/quote-option`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depotId: item.depotId,
        item,
        option,
        targetQty,
      }),
    });
    const data = await res.json();
    if (data?.success && data.quote) {
      const quoted = { ...option, ...data.quote, sourceItem: item };
      quoteCache.set(cacheKey, quoted);
      return quoted;
    }
  } catch {
    // fall back to static option
  }
  return option;
}

export async function resolveQuotedOptions(items, targetQty, deps) {
  const { parseMf, runConcurrent, quoteConcurrencyLimit } = deps;
  const baseOptions = calcMfOptions(items, targetQty, { parseMf });
  if (!baseOptions.length) return [];
  const tasks = baseOptions.map((option) => () => fetchQuotedOption(option.sourceItem, option, targetQty, deps));
  const quoted = await runConcurrent(tasks, quoteConcurrencyLimit);
  return quoted.sort(comparePlannerOptions);
}

export async function resolvePlannerOptions(items, targetQty, deps) {
  const { shouldUseMfForQty } = deps;
  const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
  if (!shouldUseMfForQty(safeQty)) {
    return buildUnitOptions(items, safeQty);
  }
  return resolveQuotedOptions(items, safeQty, deps);
}
