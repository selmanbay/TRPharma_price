/**
 * plan-actions.js
 * Plan and depot opening interaction owner for V2.3.1 runtime.
 */
(function initV23PlanActions(globalScope) {
  if (!globalScope) return;

  function openPlanPreview(groupKey = '', deps = {}) {
    const { switchMock, openPlanDrawer } = deps;
    switchMock('plan');
    if (!groupKey) return;
    requestAnimationFrame(() => {
      openPlanDrawer(groupKey);
    });
  }

  function openUrl(url, deps = {}) {
    const { getSecurityGuardsBridge } = deps;
    if (!url) return;
    const securityBridge = typeof getSecurityGuardsBridge === 'function' ? getSecurityGuardsBridge() : null;
    const isSafeHttpUrl = securityBridge?.isSafeHttpUrl;
    if (typeof isSafeHttpUrl === 'function' && !isSafeHttpUrl(url)) {
      console.warn('[v2.3-security] Blocked unsafe url open attempt.');
      return;
    }
    if (window.electronAPI?.openUrlInChrome) {
      window.electronAPI.openUrlInChrome(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function buildChromeDepotTarget(depotId, rawQuery, fallbackUrl, deps = {}) {
    const { parseQRCode } = deps;
    const query = String(rawQuery || '').trim();
    const canonical = typeof parseQRCode === 'function'
      ? String(parseQRCode(query) || query).trim()
      : query;
    return {
      url: fallbackUrl || '',
      copyText: canonical || query,
      depotId: String(depotId || '').trim(),
    };
  }

  async function copyAndOpenDepot(url, depotId, rawQuery = '', runtime = {}, deps = {}) {
    const { state } = runtime;
    const { buildChromeDepotTarget: buildChromeDepotTargetFn, openUrl: openUrlFn } = deps;
    const target = typeof buildChromeDepotTargetFn === 'function'
      ? buildChromeDepotTargetFn(depotId, rawQuery, url)
      : { url: url || '', copyText: String(rawQuery || '').trim() };
    if (!target?.url) return;
    if (target.copyText && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(target.copyText);
      } catch (_) {
      }
    }
    if (typeof openUrlFn === 'function') {
      openUrlFn(target.url);
    }
    if (state) {
      state.planApprovalMode = false;
    }
  }

  function openPlanInDepot(key = '', depotId = '', runtime = {}, deps = {}) {
    const { getOrderPlan, copyAndOpenDepot } = deps;
    const item = (typeof getOrderPlan === 'function' ? getOrderPlan() : []).find((entry) => (
      String(entry?.key || '').trim() === String(key || '').trim()
      && String(entry?.depotId || entry?.depot || '').trim() === String(depotId || '').trim()
    ));
    if (!item?.depotUrl || typeof copyAndOpenDepot !== 'function') return;
    copyAndOpenDepot(item.depotUrl, item.depotId || item.depot || '', item.barcode || item.barkod || item.name || item.ad || key);
  }

  function changePlanQty(key, depotId, delta, runtime = {}, deps = {}) {
    const { getOrderPlan, calculatePlanning, patchPlanOperationItem, upsertApprovalFromPlanItem, finalizePlanMutation } = deps;
    const current = getOrderPlan().find((item) => item.key === key && (item.depotId || item.depot) === depotId);
    if (!current) return;
    const nextQty = Math.max((current.desiredQty || 1) + delta, 1);
    const planning = calculatePlanning(current, nextQty);
    const updatedPlanItem = patchPlanOperationItem(key, depotId, {
      desiredQty: planning.desiredQty,
      orderQty: planning.orderQty,
      receiveQty: planning.receiveQty,
      totalCost: planning.totalCost,
      effectiveUnit: planning.effectiveUnit,
    });
    if (updatedPlanItem?.approvalStatus === 'approved') {
      upsertApprovalFromPlanItem(updatedPlanItem);
    }
    finalizePlanMutation();
  }

  function removePlanItemAndRender(key, depotId, deps = {}) {
    const { removePlanItem, removeApprovalQueueEntry, finalizePlanMutation } = deps;
    removePlanItem(key, depotId);
    removeApprovalQueueEntry(key, depotId);
    finalizePlanMutation();
  }

  function samePlanRecord(item, key, depotId) {
    return String(item?.key || '').trim() === String(key || '').trim()
      && String(item?.depotId || item?.depot || '').trim() === String(depotId || '').trim();
  }

  function selectPlanAlternative(groupKey, depotId, deps = {}) {
    const {
      getOrderPlan,
      groupPlanItems,
      buildPlanPayloadFromOffer,
      removePlanItem,
      addPlanItem,
      removeApprovalQueueEntry,
      upsertApprovalFromPlanItem,
      finalizePlanMutation,
    } = deps;
    const plan = getOrderPlan();
    const group = groupPlanItems(plan).find((entry) => entry.key === groupKey);
    if (!group) return;
    const sourceItem = group.items[0];
    const alternative = (sourceItem?.alternatives || []).find((item) => (item.depotId || item.depot) === depotId);
    if (!alternative) return;

    const desiredQty = sourceItem?.desiredQty || 1;
    const wasApproved = sourceItem?.approvalStatus === 'approved';
    const approvedAt = sourceItem?.approvedAt || '';
    const alternativeItem = {
      ...alternative,
      mfStr: alternative.mfStr || alternative.malFazlasi || '',
      fiyatNum: Number(alternative.fiyatNum) || 0,
    };
    const payload = buildPlanPayloadFromOffer({
      item: alternativeItem,
      key: groupKey,
      desiredQty,
      fallbackQuery: sourceItem.barcode || '',
      alternatives: sourceItem.alternatives || [],
      fallbackName: sourceItem.name || group.name || '',
      approvalStatus: wasApproved ? 'approved' : '',
      approvedAt: wasApproved ? approvedAt || new Date().toISOString() : '',
    });
    if (!payload) return;
    removePlanItem(groupKey, sourceItem.depotId || sourceItem.depot);
    addPlanItem(payload);
    removeApprovalQueueEntry(groupKey, sourceItem.depotId || sourceItem.depot);
    const nextSelectedDepotId = alternative.depotId || alternative.depot || '';
    if (wasApproved && nextSelectedDepotId) {
      const updated = getOrderPlan().find((item) => samePlanRecord(item, groupKey, nextSelectedDepotId));
      if (updated) upsertApprovalFromPlanItem(updated);
    }
    finalizePlanMutation();
  }

  globalScope.V23PlanActions = {
    openPlanPreview,
    openUrl,
    buildChromeDepotTarget,
    copyAndOpenDepot,
    openPlanInDepot,
    changePlanQty,
    removePlanItemAndRender,
    selectPlanAlternative,
  };
})(typeof window !== 'undefined' ? window : null);
