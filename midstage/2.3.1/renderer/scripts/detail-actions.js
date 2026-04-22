/**
 * detail-actions.js
 * Detail and bulk-detail interaction owner for V2.3.1 runtime.
 */
(function initV23DetailActions(globalScope) {
  if (!globalScope) return;

  function getOfferKey(item) {
    return `${item?.depotId || item?.depot || ''}::${item?.kodu || item?.ad || ''}`;
  }

  function getBulkRowQty(row) {
    return Math.max(Number(row?.desiredQty) || 1, 1);
  }

  function addSelectedOfferToPlan(runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getSelectedDetailItem: getSelectedDetailItemFn, buildPlanPayloadFromOffer, addPlanItem, finalizePlanMutation } = deps;
    const selected = typeof getSelectedDetailItemFn === 'function' ? getSelectedDetailItemFn() : null;
    if (!selected) return;
    const payload = buildPlanPayloadFromOffer({
      item: selected,
      key: state.currentVariantKey || selected.barkod || selected.ad,
      desiredQty: state.desiredQty,
      fallbackQuery: state.currentDetailQuery,
      alternatives: state.currentDetailItems,
      fallbackName: selected.ad || '',
    });
    if (!payload) return;
    addPlanItem(payload);
    finalizePlanMutation();
  }

  function addOfferToPlan(key, runtime = {}, deps = {}) {
    const { state } = runtime;
    const {
      getOfferKey: getOfferKeyFn,
      buildPlanPayloadFromOffer,
      addPlanItem,
      finalizePlanMutation,
    } = deps;
    const offerKey = String(key || '').trim();
    if (!offerKey) return;
    const selected = (state.currentDetailItems || []).find((entry) => (
      (typeof getOfferKeyFn === 'function' ? getOfferKeyFn(entry) : getOfferKey(entry)) === offerKey
    ));
    if (!selected) return;

    const payload = buildPlanPayloadFromOffer({
      item: selected,
      key: state.currentVariantKey || selected.barkod || selected.ad,
      desiredQty: state.desiredQty,
      fallbackQuery: state.currentDetailQuery,
      alternatives: state.currentDetailItems,
      fallbackName: selected.ad || '',
    });
    if (!payload) return;
    state.selectedOfferKey = offerKey;
    addPlanItem(payload);
    finalizePlanMutation();
  }

  function openSelectedOfferInDepot(runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getSelectedDetailItem: getSelectedDetailItemFn, copyAndOpenDepot } = deps;
    const selected = typeof getSelectedDetailItemFn === 'function' ? getSelectedDetailItemFn() : null;
    if (!selected?.depotUrl) return;
    copyAndOpenDepot(selected.depotUrl, selected.depotId || selected.depot || '', selected.barkod || selected.ad || state.currentDetailQuery || '');
  }

  function openOfferInDepot(key, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getOfferKey: getOfferKeyFn, copyAndOpenDepot } = deps;
    const item = (state.currentDetailItems || []).find((entry) => (typeof getOfferKeyFn === 'function' ? getOfferKeyFn(entry) : getOfferKey(entry)) === key);
    if (!item?.depotUrl) return;
    copyAndOpenDepot(item.depotUrl, item.depotId || item.depot || '', item.barkod || item.ad || state.currentDetailQuery || '');
  }

  function addBulkRowToPlan(index, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { openBulkDrawer, getBulkRowQty: getBulkRowQtyFn, buildPlanPayloadFromOffer, addPlanItem, finalizePlanMutation } = deps;
    const row = state.bulkRows[index];
    if (!row) return;
    if (!row.bestItem && row.requiresVariantChoice) {
      openBulkDrawer(index);
      return;
    }
    if (!row?.bestItem) return;
    const bestGroup = row.groups.find((group) => group.key === row.selectedGroupKey) || row.groups[0];
    if (!bestGroup) return;
    const desiredQty = typeof getBulkRowQtyFn === 'function' ? getBulkRowQtyFn(row) : getBulkRowQty(row);
    const payload = buildPlanPayloadFromOffer({
      item: row.bestItem,
      key: bestGroup?.key || row.bestItem.barkod || row.query,
      desiredQty,
      fallbackQuery: row.query,
      alternatives: bestGroup?.items || [],
      fallbackName: bestGroup?.name || row.query,
    });
    if (!payload) return;
    addPlanItem(payload);
    finalizePlanMutation();
  }

  function selectBulkOffer(rowIndex, groupIndex, offerKey, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getOfferKey: getOfferKeyFn, renderBulkPage, renderBulkDrawer } = deps;
    const row = state.bulkRows[rowIndex];
    const group = row?.groups?.[groupIndex];
    const item = group?.items?.find((entry) => (typeof getOfferKeyFn === 'function' ? getOfferKeyFn(entry) : getOfferKey(entry)) === offerKey);
    if (!item) return;
    row.bestItem = item;
    row.selectedGroupKey = group?.key || '';
    row.requiresVariantChoice = false;
    state.bulkRows[rowIndex] = row;
    renderBulkPage();
    renderBulkDrawer(row);
  }

  function addBulkOfferToPlan(rowIndex, groupIndex, offerKey, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getOfferKey: getOfferKeyFn, getBulkRowQty: getBulkRowQtyFn, buildPlanPayloadFromOffer, addPlanItem, closeBulkDrawer, finalizePlanMutation } = deps;
    const row = state.bulkRows[rowIndex];
    const group = row?.groups?.[groupIndex];
    const item = group?.items?.find((entry) => (typeof getOfferKeyFn === 'function' ? getOfferKeyFn(entry) : getOfferKey(entry)) === offerKey);
    if (!item) return;
    const desiredQty = typeof getBulkRowQtyFn === 'function' ? getBulkRowQtyFn(row) : getBulkRowQty(row);
    const payload = buildPlanPayloadFromOffer({
      item,
      key: group.key,
      desiredQty,
      fallbackQuery: row.query,
      alternatives: group.items,
      fallbackName: group.name || row.query,
    });
    if (!payload) return;
    addPlanItem(payload);
    closeBulkDrawer();
    finalizePlanMutation();
  }

  function openBulkVariant(rowIndex, groupIndex, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getOfferKey: getOfferKeyFn, getBulkRowQty: getBulkRowQtyFn, closeBulkDrawer, switchMock } = deps;
    const row = state.bulkRows[rowIndex];
    const group = row?.groups?.[groupIndex];
    if (!group) return;
    const targetQuery = String(group.barcode || row.query || '').trim();
    state.bulkDetailContext = { rowIndex, groupIndex };
    state.searchQuery = targetQuery;
    state.currentVariantKey = group.key;
    state.currentDetailItems = group.items;
    state.currentDetailQuery = targetQuery;
    state.selectedOfferKey = typeof getOfferKeyFn === 'function' ? getOfferKeyFn(group.bestItem || {}) : getOfferKey(group.bestItem || {});
    state.desiredQty = typeof getBulkRowQtyFn === 'function' ? getBulkRowQtyFn(row) : getBulkRowQty(row);
    closeBulkDrawer();
    switchMock('search-detail');
  }

  function returnToBulkDetail(rowIndex, deps = {}) {
    const { switchMock, openBulkDrawer } = deps;
    switchMock('bulk');
    requestAnimationFrame(() => {
      openBulkDrawer(rowIndex);
    });
  }

  function openHistorySearch(query, barcode, deps = {}) {
    const { runSearch } = deps;
    const searchValue = String(barcode || query || '').trim();
    if (!searchValue) return;
    const input = document.querySelector('.nav-search');
    if (input) input.value = searchValue;
    // switchMock to search-variants first so the page is visible when results arrive
    if (typeof window.switchMock === 'function') {
      window.switchMock('search-variants');
    }
    runSearch(searchValue);
  }

  globalScope.V23DetailActions = {
    addSelectedOfferToPlan,
    addOfferToPlan,
    openSelectedOfferInDepot,
    openOfferInDepot,
    addBulkRowToPlan,
    selectBulkOffer,
    addBulkOfferToPlan,
    openBulkVariant,
    returnToBulkDetail,
    openHistorySearch,
  };
})(typeof window !== 'undefined' ? window : null);
