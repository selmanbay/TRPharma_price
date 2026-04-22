/**
 * plan-domain.js
 * V2.3 plan grouping and drawer option domain bridge.
 * Pure helpers only; no DOM dependency.
 */
(function initV23PlanDomain(globalScope) {
  if (!globalScope) return;

  function planLineGroupKey(item) {
    const bc = String(item?.barcode || item?.barkod || '').trim();
    const normFn = globalScope?.normalizeProductBarcode;
    const isBc = globalScope?.isBarcodeQuery;
    if (bc && typeof normFn === 'function') {
      const n = String(normFn(bc) || '').trim();
      if (n && typeof isBc === 'function' && isBc(n)) return n;
    }
    return String(item?.key || '').trim();
  }

  function groupPlanItems(plan) {
    const groups = new Map();
    for (const item of plan || []) {
      const key = planLineGroupKey(item);
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: item.name || item.ad || key,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    }
    return Array.from(groups.values());
  }

  function groupPlanItemsByDepot(plan, depotMeta) {
    const groups = new Map();
    for (const item of plan || []) {
      const key = item.depotId || item.depot || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          depotId: item.depotId || '',
          depot: item.depot || depotMeta?.[item.depotId]?.label || key,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    }
    return Array.from(groups.values());
  }

  function buildPlanDrawerOptions(input) {
    const group = input?.group || { key: '', name: '', items: [] };
    const normalizeAlternativeItems = input?.normalizeAlternativeItems;
    const normalizePlanItem = input?.normalizePlanItem;
    const calculatePlanning = input?.calculatePlanning;
    if (
      typeof normalizeAlternativeItems !== 'function'
      || typeof normalizePlanItem !== 'function'
      || typeof calculatePlanning !== 'function'
    ) {
      return [];
    }

    const byDepot = new Map();
    const desiredQty = Math.max(...(group.items || []).map((item) => item?.desiredQty || 1), 1);

    for (const planned of group.items || []) {
      const plannedDepot = planned.depotId || planned.depot;
      if (plannedDepot) {
        byDepot.set(plannedDepot, {
          ...planned,
          desiredQty,
          source: 'planned',
          selected: true,
          planning: calculatePlanning(planned, desiredQty),
        });
      }

      const alternatives = normalizeAlternativeItems(planned.alternatives, {
        key: group.key,
        barcode: planned.barcode || '',
        name: planned.name || group.name,
      });

      for (const alt of alternatives) {
        const depotKey = alt.depotId || alt.depot;
        if (!depotKey || byDepot.has(depotKey)) continue;
        const planning = calculatePlanning(alt, desiredQty);
        byDepot.set(depotKey, {
          ...normalizePlanItem({
            ...alt,
            key: group.key,
            desiredQty,
            orderQty: planning.orderQty,
            receiveQty: planning.receiveQty,
            totalCost: planning.totalCost,
            effectiveUnit: planning.effectiveUnit,
            alternatives,
          }),
          source: 'alternative',
          selected: false,
          planning,
        });
      }
    }

    return Array.from(byDepot.values()).sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return (a.planning?.effectiveUnit || a.effectiveUnit || Number.MAX_SAFE_INTEGER)
        - (b.planning?.effectiveUnit || b.effectiveUnit || Number.MAX_SAFE_INTEGER);
    });
  }

  globalScope.V23PlanDomain = {
    groupPlanItems,
    groupPlanItemsByDepot,
    buildPlanDrawerOptions,
  };
})(typeof window !== 'undefined' ? window : null);
