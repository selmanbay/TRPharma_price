/**
 * plan-mutations.js
 * Unified mutation pipeline for plan/approval related operations.
 */
(function initV23PlanMutations(globalScope) {
  if (!globalScope) return;

  function renderCurrentOperationSurface(runtime, deps) {
    const { state } = runtime || {};
    if (!state) return;
    const {
      renderVariantsPage,
      renderDetailPage,
      renderBulkPage,
    } = deps || {};

    if (state.currentPage === 'search-variants') {
      if (typeof renderVariantsPage === 'function') renderVariantsPage();
      return;
    }
    if (state.currentPage === 'search-detail') {
      if (typeof renderDetailPage === 'function') renderDetailPage();
      return;
    }
    if (state.currentPage === 'bulk') {
      if (typeof renderBulkPage === 'function') renderBulkPage();
    }
  }

  function finalizePlanMutation(runtime, deps, options = {}) {
    const {
      renderPlan = true,
      forcePlan = false,
      includeDrawer = true,
      renderActiveSurface = true,
      updateNav = true,
      refreshBulkDrawer = true,
    } = options;

    const { state } = runtime || {};
    const {
      updateNavSummary,
      renderPlanSurfaces,
      renderBulkDrawer,
    } = deps || {};

    if (updateNav && typeof updateNavSummary === 'function') updateNavSummary();
    if (renderPlan && typeof renderPlanSurfaces === 'function') {
      renderPlanSurfaces({
        includeDrawer,
        forcePage: forcePlan,
      });
    }
    if (renderActiveSurface) {
      renderCurrentOperationSurface(runtime, deps);
      if (
        refreshBulkDrawer
        && state?.currentPage === 'bulk'
        && state?.bulkDrawerIndex >= 0
        && typeof renderBulkDrawer === 'function'
      ) {
        const row = state.bulkRows?.[state.bulkDrawerIndex];
        if (row) renderBulkDrawer(row);
      }
    }
  }

  function upsertPlanOperationItem(item, deps) {
    const {
      normalizePlanItem,
      getOrderPlan,
      saveOrderPlan,
    } = deps || {};
    if (
      typeof normalizePlanItem !== 'function'
      || typeof getOrderPlan !== 'function'
      || typeof saveOrderPlan !== 'function'
    ) return null;

    const normalized = normalizePlanItem(item);
    if (!normalized) return null;
    const plan = getOrderPlan();
    const next = (plan || []).filter((entry) => (
      `${entry.key}::${entry.depotId || entry.depot || ''}`
      !== `${normalized.key}::${normalized.depotId || normalized.depot || ''}`
    ));
    next.push(normalized);
    saveOrderPlan(next);
    return normalized;
  }

  function patchPlanOperationItem(key, depotId, patch, deps) {
    const {
      normalizePlanItem,
      getOrderPlan,
      saveOrderPlan,
      isSamePlanRecord,
    } = deps || {};
    if (
      typeof normalizePlanItem !== 'function'
      || typeof getOrderPlan !== 'function'
      || typeof saveOrderPlan !== 'function'
    ) return null;

    const targetDepot = String(depotId || '').trim();
    let updatedItem = null;
    const next = (getOrderPlan() || []).map((item) => {
      const hit = typeof isSamePlanRecord === 'function'
        ? isSamePlanRecord(item, key, depotId)
        : item.key === key && (item.depotId || item.depot) === targetDepot;
      if (hit) {
        updatedItem = normalizePlanItem({ ...item, ...patch });
        return updatedItem;
      }
      return item;
    }).filter(Boolean);
    saveOrderPlan(next);
    return updatedItem;
  }

  function deletePlanOperationItem(key, depotId, deps) {
    const {
      getOrderPlan,
      saveOrderPlan,
      isSamePlanRecord,
    } = deps || {};
    if (typeof getOrderPlan !== 'function' || typeof saveOrderPlan !== 'function') {
      return null;
    }

    const targetDepot = String(depotId || '').trim();
    let removedItem = null;
    const next = (getOrderPlan() || []).filter((item) => {
      const isTarget = typeof isSamePlanRecord === 'function'
        ? isSamePlanRecord(item, key, depotId)
        : item.key === key && (item.depotId || item.depot) === targetDepot;
      if (isTarget) {
        removedItem = item;
        return false;
      }
      return true;
    });
    saveOrderPlan(next);
    return removedItem;
  }

  globalScope.V23PlanMutations = {
    renderCurrentOperationSurface,
    finalizePlanMutation,
    upsertPlanOperationItem,
    patchPlanOperationItem,
    deletePlanOperationItem,
  };
})(typeof window !== 'undefined' ? window : null);
