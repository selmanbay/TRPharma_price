/**
 * operation-identity.js
 * Identity and matching owner for plan/search/approval flows.
 */
(function initV23OperationIdentity(globalScope) {
  if (!globalScope) return;

  function resolveDepotIdentity(value = '', deps = {}) {
    const { depotMeta = {} } = deps;
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.toLowerCase();
    if (depotMeta[normalized]) return normalized;
    const hit = Object.entries(depotMeta).find(([depotId, meta]) => {
      const label = String(meta?.label || '').trim().toLowerCase();
      return depotId === normalized || label === normalized;
    });
    return hit ? hit[0] : raw;
  }

  function matchesDepotIdentity(item, depotToken = '', deps = {}) {
    const target = resolveDepotIdentity(depotToken, deps);
    if (!target) return true;
    const itemDepotId = resolveDepotIdentity(item?.depotId || '', deps);
    const itemDepotName = resolveDepotIdentity(item?.depot || '', deps);
    return itemDepotId === target || itemDepotName === target;
  }

  function buildPlanKeyCandidates(key = '', barcode = '', deps = {}) {
    const { isBarcodeQuery } = deps;
    const candidates = new Set();
    const rawKey = String(key || '').trim();
    const rawBarcode = String(barcode || '').trim();

    if (rawKey) {
      candidates.add(rawKey);
      if (rawKey.startsWith('BARCODE_')) {
        const value = rawKey.slice('BARCODE_'.length).trim();
        if (value) candidates.add(value);
      } else if (rawKey.startsWith('NAME_')) {
        const value = rawKey.slice('NAME_'.length).trim();
        if (value) candidates.add(value);
      } else if (typeof isBarcodeQuery === 'function' && isBarcodeQuery(rawKey)) {
        candidates.add(`BARCODE_${rawKey}`);
      }
    }

    if (rawBarcode) {
      candidates.add(rawBarcode);
      candidates.add(`BARCODE_${rawBarcode}`);
    }

    return candidates;
  }

  function normalizeBarcodeToken(value, deps = {}) {
    const fn = deps?.normalizeProductBarcode;
    if (typeof fn === 'function') return String(fn(value) || '').trim();
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return raw;
    if (digits.length >= 13) {
      return digits.slice(-13);
    }
    return digits;
  }

  function matchesPlanIdentity(item, key, depotToken = '', deps = {}) {
    const searchBarcode = String(deps.barcode || deps.queryBarcode || '').trim();
    const keyCandidates = buildPlanKeyCandidates(key, searchBarcode, deps);
    const itemKey = String(item?.key || '').trim();
    if (!itemKey || !keyCandidates.has(itemKey)) return false;
    return matchesDepotIdentity(item, depotToken, deps);
  }

  function findPlanItemByIdentity(key, depotToken = '', deps = {}) {
    const { getOrderPlan } = deps;
    const plan = typeof getOrderPlan === 'function' ? getOrderPlan() : [];
    return plan.find((item) => matchesPlanIdentity(item, key, depotToken, deps)) || null;
  }

  function isPlanEntryPresent(input = {}, deps = {}) {
    const {
      key = '',
      depotId = '',
      depot = '',
      planItems = null,
      barcode = '',
    } = input || {};
    const { getOrderPlan } = deps;
    const keyCandidates = buildPlanKeyCandidates(key, barcode, deps);
    if (!keyCandidates.size) return false;

    const targetDepotId = String(depotId || '').trim();
    const targetDepotName = String(depot || '').trim();
    const plan = Array.isArray(planItems) ? planItems : (typeof getOrderPlan === 'function' ? getOrderPlan() : []);

    const wantedBcRaw = String(barcode || '').trim();
    const wantedNorm = wantedBcRaw ? normalizeBarcodeToken(wantedBcRaw, deps) : '';

    return plan.some((item) => {
      const itemBcRaw = String(item?.barcode || item?.barkod || '').trim();
      const itemNorm = itemBcRaw ? normalizeBarcodeToken(itemBcRaw, deps) : '';
      if (wantedNorm && itemNorm && wantedNorm === itemNorm) {
        if (!targetDepotId && !targetDepotName) return true;
        return matchesDepotIdentity(item, targetDepotId || targetDepotName, deps);
      }

      const itemKey = String(item?.key || '').trim();
      const keyHit = Boolean(itemKey && keyCandidates.has(itemKey));
      if (!keyHit) return false;

      const itemDepotId = String(item?.depotId || '').trim();
      const itemDepotName = String(item?.depot || '').trim();

      if (targetDepotId) {
        if (itemDepotId) return itemDepotId === targetDepotId;
        return itemDepotName === targetDepotName || itemDepotName === targetDepotId;
      }
      if (targetDepotName) {
        if (itemDepotName) return itemDepotName === targetDepotName;
        return itemDepotId === targetDepotName;
      }
      return true;
    });
  }

  globalScope.V23OperationIdentity = {
    resolveDepotIdentity,
    matchesDepotIdentity,
    buildPlanKeyCandidates,
    normalizeBarcodeToken,
    matchesPlanIdentity,
    findPlanItemByIdentity,
    isPlanEntryPresent,
  };
})(typeof window !== 'undefined' ? window : null);
