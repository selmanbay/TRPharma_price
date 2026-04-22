/**
 * operation-state.js
 * Search/plan/approval operation state helpers for V2.3 runtime.
 * Pure-ish module: all external behavior comes from injected deps/runtime.
 */
(function initV23OperationState(globalScope) {
  if (!globalScope) return;

  function getPlanSnapshotForIdentity(input, deps) {
    const {
      key = '',
      depotId = '',
      depot = '',
      barcode = '',
      planItems = null,
    } = input || {};
    const {
      buildPlanKeyCandidates,
      matchesDepotIdentity,
      getOrderPlan,
    } = deps || {};
    if (
      typeof buildPlanKeyCandidates !== 'function'
      || typeof matchesDepotIdentity !== 'function'
      || typeof getOrderPlan !== 'function'
    ) {
      return null;
    }

    const keyCandidates = buildPlanKeyCandidates(key, barcode, {
      isBarcodeQuery: deps?.isBarcodeQuery,
    });
    if (!keyCandidates?.size) return null;
    const plan = planItems || getOrderPlan();
    const normFn = deps?.normalizeProductBarcode;
    const norm = (v) => {
      if (typeof normFn === 'function') return String(normFn(v) || '').trim();
      const raw = String(v || '').trim();
      if (!raw) return '';
      const d = raw.replace(/\D/g, '');
      if (!d) return raw;
      return d.length >= 13 ? d.slice(-13) : d;
    };
    const wantedNorm = norm(barcode);

    const matched = (plan || []).find((item) => {
      const itemNorm = norm(item?.barcode || item?.barkod || '');
      if (wantedNorm && itemNorm && wantedNorm === itemNorm) {
        return matchesDepotIdentity(item, depotId || depot || '');
      }

      const itemKey = String(item?.key || '').trim();
      const keyHit = Boolean(itemKey && keyCandidates.has(itemKey));
      if (!keyHit) return false;
      return matchesDepotIdentity(item, depotId || depot || '');
    });
    if (!matched) return null;

    return {
      inPlan: true,
      desiredQty: Math.max(parseInt(matched.desiredQty, 10) || 1, 1),
      approvalStatus: String(matched.approvalStatus || '').trim(),
      approvedAt: String(matched.approvedAt || '').trim(),
    };
  }

  function resolveOperationStateForItem(item, options, deps) {
    const {
      fallbackKey = '',
      planItems = null,
    } = options || {};
    const { getPlanSnapshotForIdentity: getSnapshot } = deps || {};
    if (typeof getSnapshot !== 'function') {
      return {
        inPlan: Boolean(item?.inPlan),
        desiredQty: Math.max(parseInt(item?.planQty ?? item?.desiredQty, 10) || 0, 0),
        approvalStatus: String(item?.approvalStatus || '').trim(),
        approvedAt: String(item?.approvedAt || '').trim(),
        isApproved: String(item?.approvalStatus || '').trim() === 'approved',
      };
    }

    const key = String(
      fallbackKey
      || item?.barcode
      || item?.barkod
      || item?.key
      || item?.entityId
      || item?.name
      || item?.ad
      || ''
    ).trim();
    const barcode = String(
      options?.resolvedBarcode
      || item?.barcode
      || item?.barkod
      || ''
    ).trim();
    const depotId = String(item?.depotId || '').trim();
    const depot = String(item?.depot || '').trim();
    const snapshot = getSnapshot({ key, depotId, depot, barcode, planItems });
    const approvalStatus = String(item?.approvalStatus || snapshot?.approvalStatus || '').trim();
    const approvedAt = String(item?.approvedAt || snapshot?.approvedAt || '').trim();
    const desiredQty = Math.max(
      parseInt(item?.planQty ?? item?.desiredQty, 10)
        || Number(snapshot?.desiredQty)
        || 0,
      0
    );

    return {
      inPlan: Boolean(item?.inPlan || snapshot?.inPlan),
      desiredQty,
      approvalStatus,
      approvedAt,
      isApproved: approvalStatus === 'approved',
    };
  }

  function resolveGroupOperationState(group, deps) {
    const { resolveOperationStateForItem: resolveState } = deps || {};
    if (typeof resolveState !== 'function') {
      return { inPlan: false, isApproved: false, desiredQty: 0, inPlanCount: 0 };
    }
    const states = (group?.items || []).map((item) => resolveState(item, { fallbackKey: group?.key || '' }));
    const inPlanItems = states.filter((stateEntry) => stateEntry.inPlan);
    const approvedItems = states.filter((stateEntry) => stateEntry.isApproved);
    return {
      inPlan: inPlanItems.length > 0,
      isApproved: approvedItems.length > 0,
      desiredQty: inPlanItems[0]?.desiredQty || 0,
      inPlanCount: inPlanItems.length,
    };
  }

  function renderOperationStateBadges(operationState = {}, options = {}) {
    const inPlan = Boolean(operationState?.inPlan);
    const isApproved = Boolean(operationState?.isApproved);
    if (!inPlan && !isApproved) return '';

    const desiredQty = Math.max(parseInt(operationState?.desiredQty, 10) || 0, 0);
    const inPlanCount = Math.max(parseInt(operationState?.inPlanCount, 10) || 0, 0);
    const chips = [];

    if (inPlan) {
      const inPlanLabel = inPlanCount > 1
        ? `Planda (${inPlanCount} depo)`
        : (desiredQty > 0 ? `Planda • ${desiredQty} adet` : 'Planda');
      chips.push(`<span class="badge badge-outline" style="border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);">${inPlanLabel}</span>`);
    }
    if (isApproved) {
      chips.push('<span class="badge badge-outline" style="border-color:rgba(245,158,11,0.35); color:#a16207; background:rgba(245,158,11,0.12);">Onayda</span>');
    }

    const marginTop = options?.compact ? '6px' : '10px';
    return `<div class="product-badges" style="margin-top:${marginTop};">${chips.join('')}</div>`;
  }

  function synchronizeSearchItemOperationState(item, fallbackKey, options, deps) {
    const { resolveOperationStateForItem: resolveState, createDrugOperationEntity, state } = deps || {};
    const operationState = typeof resolveState === 'function'
      ? resolveState(item, {
        fallbackKey: fallbackKey || '',
        planItems: options?.planItems || null,
      })
      : {
        inPlan: Boolean(item?.inPlan),
        desiredQty: Number(item?.desiredQty) || 1,
        approvalStatus: String(item?.approvalStatus || '').trim(),
        approvedAt: String(item?.approvedAt || '').trim(),
      };
    const normalized = {
      ...item,
      inPlan: operationState.inPlan,
      planQty: operationState.desiredQty || 0,
      desiredQty: operationState.desiredQty || Number(item?.desiredQty) || 1,
      approvalStatus: operationState.approvalStatus || '',
      approvedAt: operationState.approvedAt || '',
    };
    const resolvedKey = String(
      fallbackKey
      || normalized.key
      || normalized.entityId
      || normalized.barcode
      || normalized.barkod
      || normalized.name
      || normalized.ad
      || ''
    ).trim();
    if (typeof createDrugOperationEntity !== 'function') return normalized;
    const operationEntity = createDrugOperationEntity({
      ...normalized,
      key: resolvedKey,
      operationSource: 'search',
    }, {
      source: 'search',
      key: resolvedKey,
      inPlan: normalized.inPlan,
      desiredQty: normalized.desiredQty || 1,
      sourceQuery: state?.searchQuery || state?.currentDetailQuery || '',
    });

    if (!operationEntity?.toSearchItem) return normalized;
    return {
      ...normalized,
      ...operationEntity.toSearchItem(),
    };
  }

  function synchronizeRuntimeOperationState(runtime, deps) {
    const {
      getOrderPlan,
      sortDepotItems,
      getOfferKey,
      currentVariantKey = '',
    } = deps || {};
    if (
      typeof getOrderPlan !== 'function'
      || typeof sortDepotItems !== 'function'
      || typeof getOfferKey !== 'function'
    ) {
      return runtime;
    }
    const planItems = getOrderPlan();
    const syncOptions = { planItems };
    const nextRuntime = {
      ...runtime,
      searchGroups: runtime?.searchGroups || [],
      currentDetailItems: runtime?.currentDetailItems || [],
      bulkRows: runtime?.bulkRows || [],
    };

    if (Array.isArray(nextRuntime.searchGroups) && nextRuntime.searchGroups.length) {
      nextRuntime.searchGroups = nextRuntime.searchGroups.map((group) => {
        const previousBestKey = getOfferKey(group?.bestItem || {});
        const nextItems = sortDepotItems((group?.items || []).map((item) => (
          synchronizeSearchItemOperationState(item, group?.key || '', syncOptions, deps)
        )));
        const nextBest = nextItems.find((item) => getOfferKey(item) === previousBestKey) || nextItems[0] || null;
        return {
          ...group,
          items: nextItems,
          bestItem: nextBest,
        };
      });
    }

    if (Array.isArray(nextRuntime.currentDetailItems) && nextRuntime.currentDetailItems.length) {
      nextRuntime.currentDetailItems = sortDepotItems(nextRuntime.currentDetailItems.map((item) => (
        synchronizeSearchItemOperationState(item, currentVariantKey || '', syncOptions, deps)
      )));
    }

    if (Array.isArray(nextRuntime.bulkRows) && nextRuntime.bulkRows.length) {
      nextRuntime.bulkRows = nextRuntime.bulkRows.map((row) => {
        if (!Array.isArray(row?.groups) || !row.groups.length) return row;
        const previousBestKey = getOfferKey(row?.bestItem || {});
        const nextGroups = row.groups.map((group) => {
          const previousGroupBestKey = getOfferKey(group?.bestItem || {});
          const nextItems = sortDepotItems((group?.items || []).map((item) => (
            synchronizeSearchItemOperationState(item, group?.key || row?.query || '', syncOptions, deps)
          )));
          const nextGroupBest = nextItems.find((item) => getOfferKey(item) === previousGroupBestKey) || nextItems[0] || null;
          return {
            ...group,
            items: nextItems,
            bestItem: nextGroupBest,
          };
        });
        const selectedGroup = nextGroups.find((group) => group.key === row.selectedGroupKey) || nextGroups[0] || null;
        const flattened = nextGroups.flatMap((group) => group.items || []);
        const nextBest = flattened.find((item) => getOfferKey(item) === previousBestKey)
          || selectedGroup?.bestItem
          || null;

        return {
          ...row,
          groups: nextGroups,
          selectedGroupKey: row.selectedGroupKey || selectedGroup?.key || '',
          bestItem: nextBest,
        };
      });
    }

    return nextRuntime;
  }

  globalScope.V23OperationState = {
    getPlanSnapshotForIdentity,
    resolveOperationStateForItem,
    resolveGroupOperationState,
    renderOperationStateBadges,
    synchronizeSearchItemOperationState,
    synchronizeRuntimeOperationState,
  };
})(typeof window !== 'undefined' ? window : null);
