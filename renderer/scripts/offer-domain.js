/**
 * offer-domain.js
 * Offer pricing and plan payload owner for V2.3 runtime.
 */
(function initV23OfferDomain(globalScope) {
  if (!globalScope) return;

  function comparePlannerOptions(a, b) {
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

  function buildUnitOptions(items, targetQty = 1) {
    const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
    const allOptions = (items || [])
      .filter((item) => (Number(item?.fiyatNum) || Number(item?.unitPrice) || 0) > 0)
      .map((item) => {
        const unitPrice = Number(item?.fiyatNum) || Number(item?.unitPrice) || 0;
        return {
          depot: item?.depot,
          depotId: item?.depotId,
          depotUrl: item?.depotUrl,
          mf: null,
          mfStr: '',
          orderQty: safeQty,
          receiveQty: safeQty,
          totalCost: safeQty * unitPrice,
          effectiveUnit: unitPrice,
          unitPrice,
          availableMfStr: item?.mfStr || item?.malFazlasi || '',
          ad: item?.ad,
          sourceItem: item,
          pricingMode: 'unit',
        };
      });

    const bestPerDepot = new Map();
    allOptions.forEach((opt) => {
      const key = opt.depot || opt.depotId || 'unknown';
      if (!bestPerDepot.has(key) || opt.effectiveUnit < bestPerDepot.get(key).effectiveUnit) {
        bestPerDepot.set(key, opt);
      }
    });

    return Array.from(bestPerDepot.values()).sort(comparePlannerOptions);
  }

  function calcMfOptions(items, targetQty, deps = {}) {
    const parseMf = deps.parseMf;
    const allOptions = (items || [])
      .filter((item) => (Number(item?.fiyatNum) || Number(item?.unitPrice) || 0) > 0)
      .map((item) => {
        const mf = typeof parseMf === 'function' ? parseMf(item?.mfStr || item?.malFazlasi) : null;
        const unitPrice = Number(item?.fiyatNum) || Number(item?.unitPrice) || 0;

        // V2.2 parity: MF ancak kampanya toplam adedi yakalandiginda devreye girer.
        if (!mf || targetQty < mf.total) {
          return {
            depot: item?.depot,
            depotId: item?.depotId,
            depotUrl: item?.depotUrl,
            mf: null,
            mfStr: '',
            orderQty: targetQty,
            receiveQty: targetQty,
            totalCost: targetQty * unitPrice,
            effectiveUnit: unitPrice,
            unitPrice,
            availableMfStr: item?.mfStr || item?.malFazlasi || '',
            ad: item?.ad,
            sourceItem: item,
            pricingMode: 'unit',
          };
        }

        // V2.2 parity: bundle sayisi total (buy+free) uzerinden hesaplanir.
        const batches = Math.ceil(targetQty / mf.total);
        const orderQty = batches * mf.buy;
        const receiveQty = batches * mf.total;

        return {
          depot: item?.depot,
          depotId: item?.depotId,
          depotUrl: item?.depotUrl,
          mf,
          mfStr: item?.mfStr || item?.malFazlasi || '',
          orderQty,
          receiveQty,
          totalCost: orderQty * unitPrice,
          effectiveUnit: (orderQty * unitPrice) / receiveQty,
          unitPrice,
          availableMfStr: item?.mfStr || item?.malFazlasi || '',
          ad: item?.ad,
          sourceItem: item,
          pricingMode: 'mf',
        };
      });

    const bestPerDepot = new Map();
    allOptions.forEach((opt) => {
      const key = opt.depot || opt.depotId || 'unknown';
      if (!bestPerDepot.has(key) || comparePlannerOptions(opt, bestPerDepot.get(key)) < 0) {
        bestPerDepot.set(key, opt);
      }
    });

    return Array.from(bestPerDepot.values()).sort(comparePlannerOptions);
  }

  function shouldUseMfForQty(qty) {
    return Number.isInteger(qty) && qty > 1;
  }

  /**
   * V2.2 OrderDataEngine.parseMf ile ayni semantik: { buy, get, total }.
   * Orchestrator genelde `orderEngine` + `mapMfModel` gonderir, `parseMf` bos kalabiliyordu (MF devre disi bug).
   */
  function resolveParseMf(deps = {}) {
    const { parseMf: parseMfIn, orderEngine, mapMfModel } = deps || {};
    if (typeof parseMfIn === 'function') return parseMfIn;
    if (orderEngine && typeof orderEngine.parseMf === 'function') {
      return (mfStr) => orderEngine.parseMf(mfStr);
    }
    if (typeof mapMfModel === 'function') {
      return (mfStr) => {
        const m = mapMfModel(mfStr);
        if (!m) return null;
        const buy = Number(m.buy) || 0;
        const get = Number(m.free ?? m.get) || 0;
        const total = Number(m.total) || (buy + get);
        if (buy <= 0 || get <= 0 || total <= 0) return null;
        return { buy, get, total };
      };
    }
    return () => null;
  }

  function calculatePlanning(item, desiredQty, deps = {}) {
    const { depotMeta = {} } = deps;
    const parseMf = resolveParseMf(deps);
    const qty = Math.max(parseInt(desiredQty, 10) || 1, 1);
    const unitPrice = Number(item?.fiyatNum) || Number(item?.unitPrice) || 0;
    const sourceItem = {
      ...item,
      depot: item?.depot || depotMeta[item?.depotId]?.label || item?.depotId || 'Depo',
      fiyatNum: unitPrice,
    };
    const options = shouldUseMfForQty(qty)
      ? calcMfOptions([sourceItem], qty, { parseMf })
      : buildUnitOptions([sourceItem], qty);
    const best = options[0];

    if (!best) {
      return {
        desiredQty: qty,
        orderQty: qty,
        receiveQty: qty,
        totalCost: unitPrice * qty,
        effectiveUnit: unitPrice,
        planningMode: 'unit',
      };
    }

    return {
      desiredQty: qty,
      orderQty: Math.max(parseInt(best.orderQty, 10) || qty, 1),
      receiveQty: Math.max(parseInt(best.receiveQty, 10) || qty, 1),
      totalCost: Number(best.totalCost) || 0,
      effectiveUnit: Number(best.effectiveUnit) || unitPrice,
      planningMode: best.mf ? 'mf' : 'unit',
    };
  }

  function getOfferDisplayName(item, fallbackName = '') {
    return item?.ad || item?.name || fallbackName || item?.key || '';
  }

  function getOfferDepotLabel(item, deps = {}) {
    const { depotMeta = {} } = deps;
    return item?.depot || depotMeta[item?.depotId]?.label || item?.depotId || '';
  }

  function buildPlanPayloadFromOffer(input = {}, deps = {}) {
    const {
      item,
      key = '',
      desiredQty = 1,
      fallbackQuery = '',
      alternatives = [],
      fallbackName = '',
      approvalStatus = '',
      approvedAt = '',
      sourceQuery = '',
    } = input;
    const {
      depotMeta = {},
      calculatePlanning: calculatePlanningFn,
      getItemBarcode,
      resolveDepotIdentity,
      createDrugOperationEntity,
    } = deps;

    if (!item) return null;
    const planning = typeof calculatePlanningFn === 'function'
      ? calculatePlanningFn(item, desiredQty)
      : calculatePlanning(item, desiredQty, deps);
    const normalizedKey = String(key || item?.key || item?.barkod || item?.barcode || getOfferDisplayName(item, fallbackName)).trim();
    if (!normalizedKey) return null;

    const barcode = item?.barkod || item?.barcode || (typeof getItemBarcode === 'function' ? getItemBarcode(item, fallbackQuery) : '');
    const name = getOfferDisplayName(item, fallbackName || fallbackQuery);
    const depot = getOfferDepotLabel(item, { depotMeta });
    const depotId = typeof resolveDepotIdentity === 'function'
      ? resolveDepotIdentity(item?.depotId || depot || '')
      : (item?.depotId || depot || '');
    const payload = {
      key: normalizedKey,
      barcode,
      name,
      depot,
      depotId,
      desiredQty: planning.desiredQty,
      orderQty: planning.orderQty,
      receiveQty: planning.receiveQty,
      totalCost: planning.totalCost,
      effectiveUnit: planning.effectiveUnit,
      unitPrice: Number(item?.fiyatNum) || Number(item?.unitPrice) || 0,
      psf: Number(item?.psf) || Number(item?.psfFiyatNum) || 0,
      psfFiyatNum: Number(item?.psfFiyatNum) || Number(item?.psf) || 0,
      psfFiyat: String(item?.psfFiyat || '').trim(),
      mfStr: String(item?.mfStr || item?.malFazlasi || '').trim(),
      depotUrl: item?.depotUrl || '',
      alternatives: alternatives || [],
      approvalStatus: approvalStatus || '',
      approvedAt: approvedAt || '',
    };

    if (typeof createDrugOperationEntity === 'function') {
      const operationEntity = createDrugOperationEntity({
        ...payload,
        operationSource: 'plan',
        sourceQuery: sourceQuery || fallbackQuery || '',
      }, {
        source: 'plan',
        key: normalizedKey,
        desiredQty: planning.desiredQty,
        sourceQuery: sourceQuery || fallbackQuery || '',
      });
      if (operationEntity?.toPlanItem) {
        return operationEntity.toPlanItem();
      }
    }

    return payload;
  }

  globalScope.V23OfferDomain = {
    calculatePlanning,
    getOfferDisplayName,
    getOfferDepotLabel,
    buildPlanPayloadFromOffer,
  };
})(typeof window !== 'undefined' ? window : null);
