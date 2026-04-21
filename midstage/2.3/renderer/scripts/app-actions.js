/**
 * app-actions.js
 * Interactive action/runtime owner for V2.3.
 */
(function initV23AppActions(globalScope) {
  if (!globalScope) return;

  function getOfferKey(item) {
    return `${item?.depotId || item?.depot || ''}::${item?.kodu || item?.ad || ''}`;
  }

  function dedupeOffersByKey(items, getOfferKeyFn) {
    const seen = new Set();
    const out = [];
    for (const it of items || []) {
      const k = typeof getOfferKeyFn === 'function' ? getOfferKeyFn(it) : getOfferKey(it);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }

  function getSelectedDetailItem(runtime = {}, deps = {}) {
    const { state } = runtime;
    const { sortDepotItems } = deps;
    const sorted = typeof sortDepotItems === 'function' ? sortDepotItems(state.currentDetailItems) : (state.currentDetailItems || []);
    return sorted.find((item) => getOfferKey(item) === state.selectedOfferKey) || sorted[0] || null;
  }

  function normalizeBulkQueries(raw, deps = {}) {
    const { parseQRCode } = deps;
    const map = new Map();
    String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const canonical = (typeof parseQRCode === 'function' ? parseQRCode(line || '').trim() : '') || line;
      const key = String(canonical || '').trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { query: key, desiredQty: 0, sourceQueries: [] });
      }
      const entry = map.get(key);
      entry.desiredQty += 1;
      entry.sourceQueries.push(line);
    });
    return Array.from(map.values());
  }

  function getBulkRowQty(row) {
    return Math.max(Number(row?.desiredQty) || 1, 1);
  }

  function getBulkSelectedGroup(row) {
    if (!row) return null;
    return row.groups?.find((group) => group.key === row.selectedGroupKey) || row.groups?.[0] || null;
  }

  function changeBulkRowQty(rowIndex, delta, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { getBulkRowQty: getBulkRowQtyFn, renderBulkPage, renderBulkDrawer } = deps;
    const row = state.bulkRows[rowIndex];
    if (!row) return;
    const qty = typeof getBulkRowQtyFn === 'function' ? getBulkRowQtyFn(row) : getBulkRowQty(row);
    row.desiredQty = Math.max(qty + delta, 1);
    state.bulkRows[rowIndex] = row;
    renderBulkPage();
    if (state.bulkDrawerIndex === rowIndex) renderBulkDrawer(row);
  }

  function setBulkRowQty(rowIndex, value, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderBulkPage, renderBulkDrawer } = deps;
    const row = state.bulkRows[rowIndex];
    if (!row) return;
    row.desiredQty = Math.max(parseInt(value, 10) || 1, 1);
    state.bulkRows[rowIndex] = row;
    renderBulkPage();
    if (state.bulkDrawerIndex === rowIndex) renderBulkDrawer(row);
  }

  function selectBulkGroup(rowIndex, groupIndex, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderBulkPage, openBulkVariant } = deps;
    const row = state.bulkRows[rowIndex];
    const group = row?.groups?.[groupIndex];
    if (!row || !group) return;
    row.selectedGroupKey = group.key;
    row.bestItem = group.bestItem || null;
    row.requiresVariantChoice = false;
    if (group.barcode) {
      row.query = group.barcode;
      row.normalizedQuery = group.barcode;
    }
    state.bulkRows[rowIndex] = row;
    renderBulkPage();
    openBulkVariant(rowIndex, groupIndex);
  }

  function setDesiredQty(value, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderDetailPage } = deps;
    state.desiredQty = Math.max(parseInt(value, 10) || 1, 1);
    if (typeof renderDetailPage === 'function') renderDetailPage();
  }

  function changeDesiredQty(delta, runtime = {}, deps = {}) {
    const { state } = runtime;
    return setDesiredQty((state.desiredQty || 1) + delta, runtime, deps);
  }

  function selectOffer(key, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderDetailPage } = deps;
    state.selectedOfferKey = key;
    state.mfCalculatorOpen = false;
    if (typeof renderDetailPage === 'function') renderDetailPage();
  }

  function toggleMfCalculator(runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderDetailPage } = deps;
    state.mfCalculatorOpen = !state.mfCalculatorOpen;
    if (typeof renderDetailPage === 'function') renderDetailPage();
  }

  function renderHistoryEntry(group, deps = {}) {
    const { authFetch, API_BASE } = deps;
    if (!group?.bestItem || typeof authFetch !== 'function') return;
    authFetch(`${API_BASE}/api/history`, {
      method: 'POST',
      body: JSON.stringify({
        ilac: group.name,
        barkod: group.barcode || null,
        sonuclar: group.items.slice(0, 5).map((item) => ({
          depot: item.depot,
          fiyat: item.fiyat,
          fiyatNum: item.fiyatNum,
          mfStr: item.mfStr || '',
        })),
        enUcuz: {
          depot: group.bestItem.depot,
          fiyat: group.bestItem.fiyat,
          fiyatNum: group.bestItem.fiyatNum,
        },
      }),
    }).catch(() => {});
  }

  async function runSearch(query, runtime = {}, deps = {}) {
    const { state } = runtime;
    const {
      getSecurityGuardsBridge,
      parseQRCode,
      isBarcodeQuery,
      normalizeProductBarcode,
      searchAcrossDepotsProgressive,
      searchAcrossDepots,
      buildVariantGroups,
      getOfferKey: getOfferKeyFn,
      getItemBarcode,
      switchMock,
      renderHistoryEntry: renderHistoryEntryFn,
      SEARCH_RENDER_BATCH_MS,
      MIN_GATHER_TIME_MS,
      getPendingSearchRenderTimer,
      setPendingSearchRenderTimer,
    } = deps;

    const securityBridge = typeof getSecurityGuardsBridge === 'function' ? getSecurityGuardsBridge() : null;
    const sanitizeInput = securityBridge?.sanitizeSearchInput;
    const normalizedInput = typeof sanitizeInput === 'function'
      ? sanitizeInput(query || '')
      : String(query || '').trim();
    const rawTrim = String(normalizedInput || '').trim();
    if (!rawTrim) return;

    /**
     * V2.2 `doSearch` ile hizalama:
     * - Karekod: `parseQRCode` ciktisi **13 hane ve** `isBarcodeQuery` ise sorgu barkoda cekilir (doSearch satir 1376-1379).
     * - V2.3 eski bug: `parseQRCode(...) || normalizedInput` her zaman parse ciktisini alirdi (V2.2'de olmayan genisletme).
     * - Ek: bosluklu / kirpilmamis 13+ rakam → `normalizeProductBarcode` ile kanon GTIN (869 son 13) — yanlis "metin" sinifina dusmeyi onler.
     */
    let cleanQuery = rawTrim;
    if (typeof parseQRCode === 'function') {
      const parsed = parseQRCode(rawTrim);
      const ps = parsed != null ? String(parsed).trim() : '';
      if (ps.length === 13 && typeof isBarcodeQuery === 'function' && isBarcodeQuery(ps)) {
        cleanQuery = ps;
      }
    }
    let isBarcode = typeof isBarcodeQuery === 'function' && isBarcodeQuery(cleanQuery);
    if (
      !isBarcode
      && typeof normalizeProductBarcode === 'function'
      && typeof isBarcodeQuery === 'function'
    ) {
      const digits = rawTrim.replace(/\D/g, '');
      if (digits.length >= 13) {
        const nb = String(normalizeProductBarcode(digits) || '').trim();
        if (isBarcodeQuery(nb)) {
          cleanQuery = nb;
          isBarcode = true;
        }
      }
    }
    if (!cleanQuery) return;

    const runId = ++state.searchRunId;
    if (state.searchAbortController) state.searchAbortController.abort();
    state.searchAbortController = new AbortController();
    const controller = state.searchAbortController;
    state.searchQuery = cleanQuery;
    state.currentDetailQuery = cleanQuery;
    state.searchLoading = true;
    state.searchError = '';
    state.searchGroups = [];
    state.currentVariantKey = '';
    state.currentDetailItems = [];
    state.selectedOfferKey = '';
    state.desiredQty = 1;
    state.mfCalculatorOpen = false;
    state.bulkDetailContext = null;
    const searchStartTime = Date.now();
    const existingTimer = typeof getPendingSearchRenderTimer === 'function' ? getPendingSearchRenderTimer() : null;
    if (existingTimer) {
      clearTimeout(existingTimer);
      if (typeof setPendingSearchRenderTimer === 'function') setPendingSearchRenderTimer(null);
    }
    if (typeof switchMock === 'function') switchMock('search-variants');

    let allItems = [];
    let successCount = 0;
    let failureCount = 0;
    const failures = [];

    const classifySearchFailure = () => {
      const first = failures[0];
      if (!first) return 'Arama sirasinda hata olustu';
      if (first.status === 401) return 'Oturum suresi dolmus olabilir. Lutfen tekrar giris yapin.';
      if (first.status === 404) return 'Secilen depolarin baglantisi bulunamadi.';
      return first.message || 'Arama sirasinda hata olustu';
    };

    const applySearchSnapshot = (items, { final = false } = {}) => {
      if (runId !== state.searchRunId) return;
      if (!isBarcode && !final) {
        const elapsed = Date.now() - searchStartTime;
        if (elapsed < MIN_GATHER_TIME_MS) return;
      }

      const groups = typeof buildVariantGroups === 'function' ? buildVariantGroups(items, cleanQuery) : [];
      state.searchGroups = groups;
      state.searchLoading = false;

      if (!groups.length) {
        if (final && !state.searchError) {
          state.searchError = failureCount > 0 && successCount === 0 ? classifySearchFailure() : '';
        }
        if (typeof switchMock === 'function') switchMock('search-variants');
        return;
      }

      if (isBarcode || groups.length <= 1) {
        const group = groups[0];
        state.currentVariantKey = group?.key || '';
        state.currentDetailItems = group?.items || [];
        state.selectedOfferKey = (typeof getOfferKeyFn === 'function' ? getOfferKeyFn(group?.bestItem || {}) : getOfferKey(group?.bestItem || {}));
        if (final && typeof renderHistoryEntryFn === 'function') renderHistoryEntryFn(group);
        if (typeof switchMock === 'function') switchMock('search-detail');
        return;
      }

      if (typeof switchMock === 'function') switchMock('search-variants');
    };

    const scheduleSnapshotRender = () => {
      if (runId !== state.searchRunId) return;
      if (isBarcode) {
        applySearchSnapshot(allItems);
        return;
      }
      const timer = typeof getPendingSearchRenderTimer === 'function' ? getPendingSearchRenderTimer() : null;
      if (timer) clearTimeout(timer);
      const nextTimer = setTimeout(() => {
        if (runId !== state.searchRunId) return;
        applySearchSnapshot(allItems);
        if (typeof setPendingSearchRenderTimer === 'function') setPendingSearchRenderTimer(null);
      }, SEARCH_RENDER_BATCH_MS);
      if (typeof setPendingSearchRenderTimer === 'function') setPendingSearchRenderTimer(nextTimer);
    };

    try {
      await searchAcrossDepotsProgressive(cleanQuery, {
        signal: controller.signal,
        onDepotResult: (response) => {
          if (runId !== state.searchRunId) return;
          const responseError = response?.error ? new Error(response.error) : null;
          if (responseError) {
            failureCount++;
            failures.push(responseError);
            return;
          }
          successCount++;
          const depotItems = response?.results || [];
          if (depotItems.length) {
            allItems = allItems.concat(depotItems);
            scheduleSnapshotRender();
          }
        },
      });
    } catch (error) {
      if (runId !== state.searchRunId || error?.name === 'AbortError') return;
      failureCount++;
      failures.push(error);
    } finally {
      if (runId !== state.searchRunId) return;
      const timer = typeof getPendingSearchRenderTimer === 'function' ? getPendingSearchRenderTimer() : null;
      if (timer) {
        clearTimeout(timer);
        if (typeof setPendingSearchRenderTimer === 'function') setPendingSearchRenderTimer(null);
      }
      if (!allItems.length) {
        state.searchGroups = [];
        state.searchLoading = false;
        state.searchError = failureCount > 0 && successCount === 0 ? classifySearchFailure() : '';
        if (typeof switchMock === 'function') switchMock('search-variants');
      } else {
        state.searchError = '';
        let merged = allItems.slice();
        const canBarcodeFanout = !isBarcode
          && typeof getItemBarcode === 'function'
          && typeof isBarcodeQuery === 'function'
          && typeof searchAcrossDepots === 'function';
        if (canBarcodeFanout) {
          const uniqBc = new Set();
          merged.forEach((it) => {
            const b = getItemBarcode(it, cleanQuery);
            if (b && isBarcodeQuery(b)) uniqBc.add(b);
          });
          if (uniqBc.size === 1) {
            const fanBc = [...uniqBc][0];
            if (String(fanBc).trim() !== String(cleanQuery).trim()) {
              try {
                const extra = await searchAcrossDepots(fanBc, { signal: controller.signal });
                if (runId === state.searchRunId && Array.isArray(extra) && extra.length) {
                  merged = merged.concat(extra);
                }
              } catch (_) {
                /* ikinci asama (barkod) sessiz: birinci asama sonuclari korunur */
              }
            }
          }
        }
        merged = dedupeOffersByKey(merged, getOfferKeyFn);
        applySearchSnapshot(merged, { final: true });
      }
      if (runId === state.searchRunId) {
        state.searchAbortController = null;
      }
    }
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

  /**
   * V2.2 parity: varyant kartinda barkod varsa `doSearch` ile tum depolarda barkod aramasi.
   * V2.3: `searchAcrossDepots(canonicalBarcode)` + dedupe; `currentDetailQuery` ve `searchQuery` barkoda cekilir.
   */
  async function openVariantDetail(key, runtime = {}, deps = {}) {
    const { state } = runtime;
    const {
      getOfferKey: getOfferKeyFn,
      switchMock,
      getPendingSearchRenderTimer,
      setPendingSearchRenderTimer,
      searchAcrossDepots,
      isBarcodeQuery,
      normalizeProductBarcode,
      buildVariantGroups,
      renderDetailPage,
      renderVariantsPage,
      sortDepotItems,
    } = deps;
    const group = (state.searchGroups || []).find((entry) => entry.key === key);
    if (!group) return;

    if (state.searchAbortController) {
      state.searchAbortController.abort();
      state.searchAbortController = null;
    }
    const timer = typeof getPendingSearchRenderTimer === 'function' ? getPendingSearchRenderTimer() : null;
    if (timer) {
      clearTimeout(timer);
      if (typeof setPendingSearchRenderTimer === 'function') setPendingSearchRenderTimer(null);
    }
    state.searchRunId += 1;
    const runSnapshot = state.searchRunId;
    state.searchDrafting = false;
    state.bulkDetailContext = null;

    const pickSelectedKey = (items, preferred) => {
      const list = typeof sortDepotItems === 'function' ? sortDepotItems(items || []) : (items || []).slice();
      if (!list.length) return '';
      const prevDepot = String(preferred?.depotId || preferred?.depot || '').trim();
      const match = prevDepot
        ? list.find((it) => String(it.depotId || it.depot || '').trim() === prevDepot)
        : null;
      const pick = match || list.find((i) => Number(i.fiyatNum) > 0) || list[0];
      return typeof getOfferKeyFn === 'function' ? getOfferKeyFn(pick || {}) : getOfferKey(pick);
    };

    let rawBc = String(group.barcode || '').trim();
    if (!rawBc && String(group.key || '').startsWith('BARCODE_')) {
      rawBc = String(group.key).slice('BARCODE_'.length).trim();
    }
    if (rawBc && typeof normalizeProductBarcode === 'function') {
      const nb = String(normalizeProductBarcode(rawBc) || '').trim();
      if (nb) rawBc = nb;
    }

    const canFanOut = Boolean(
      rawBc
      && typeof isBarcodeQuery === 'function'
      && isBarcodeQuery(rawBc)
      && typeof searchAcrossDepots === 'function'
    );

    if (canFanOut) {
      state.searchLoading = true;
      if (typeof renderVariantsPage === 'function') renderVariantsPage();
      try {
        const extra = await searchAcrossDepots(rawBc, {});
        if (runSnapshot !== state.searchRunId) return;
        const merged = dedupeOffersByKey(extra || [], getOfferKeyFn);
        if (!merged.length) {
          state.currentVariantKey = key;
          state.currentDetailItems = group.items || [];
          state.currentDetailQuery = state.searchQuery;
          state.selectedOfferKey = pickSelectedKey(state.currentDetailItems, group.bestItem);
        } else {
          state.searchQuery = rawBc;
          state.currentDetailQuery = rawBc;
          state.currentVariantKey = `BARCODE_${rawBc}`;
          state.currentDetailItems = typeof sortDepotItems === 'function' ? sortDepotItems(merged) : merged;
          state.selectedOfferKey = pickSelectedKey(state.currentDetailItems, group.bestItem);
          if (typeof buildVariantGroups === 'function') {
            state.searchGroups = buildVariantGroups(merged, rawBc);
          }
        }
      } catch (_) {
        if (runSnapshot !== state.searchRunId) return;
        state.currentVariantKey = key;
        state.currentDetailItems = group.items || [];
        state.currentDetailQuery = state.searchQuery;
        state.selectedOfferKey = pickSelectedKey(state.currentDetailItems, group.bestItem);
      } finally {
        if (runSnapshot === state.searchRunId) {
          state.searchLoading = false;
        }
      }
      if (runSnapshot !== state.searchRunId) return;
      if (typeof switchMock === 'function') switchMock('search-detail');
      if (typeof renderDetailPage === 'function') renderDetailPage();
      return;
    }

    state.searchLoading = false;
    state.currentVariantKey = key;
    state.currentDetailItems = group.items || [];
    state.currentDetailQuery = state.searchQuery;
    state.selectedOfferKey = pickSelectedKey(state.currentDetailItems, group.bestItem);
    if (typeof switchMock === 'function') switchMock('search-detail');
    if (typeof renderDetailPage === 'function') renderDetailPage();
  }

  async function bulkSearch(runtime = {}, deps = {}) {
    const { state } = runtime;
    const {
      normalizeBulkQueries: normalizeBulkQueriesFn,
      renderBulkPage,
      searchAcrossDepots,
      buildVariantGroups,
      runConcurrent,
    } = deps;

    const textarea = document.getElementById('bulkInputArea');
    const raw = textarea?.value || state.bulkInput || '';
    state.bulkInput = raw;
    const normalizedQueries = typeof normalizeBulkQueriesFn === 'function' ? normalizeBulkQueriesFn(raw) : [];
    if (!normalizedQueries.length) {
      state.bulkRows = [];
      renderBulkPage();
      return;
    }

    const runId = Date.now();
    state.bulkSearchRunId = runId;
    state.bulkRows = normalizedQueries.map((entry) => ({
      query: entry.query,
      groups: [],
      groupCount: 0,
      totalItems: 0,
      bestItem: null,
      desiredQty: entry.desiredQty || 1,
      selectedGroupKey: '',
      requiresVariantChoice: false,
      status: 'loading',
      error: '',
      sourceQueries: entry.sourceQueries || [],
    }));
    renderBulkPage();

    const tasks = normalizedQueries.map((entry, index) => async () => {
      const query = entry.query;
      let nextRow;
      try {
        const items = await searchAcrossDepots(query);
        const groups = buildVariantGroups(items, query);
        const bestGroup = groups[0] || null;
        const requiresVariantChoice = groups.length > 1;
        nextRow = {
          query,
          groups,
          groupCount: groups.length,
          totalItems: items.length,
          bestItem: requiresVariantChoice ? null : (bestGroup?.bestItem || null),
          desiredQty: state.bulkRows[index]?.desiredQty || 1,
          selectedGroupKey: requiresVariantChoice ? '' : (bestGroup?.key || ''),
          requiresVariantChoice,
          status: 'ready',
          error: '',
        };
      } catch (error) {
        nextRow = {
          query,
          groups: [],
          groupCount: 0,
          totalItems: 0,
          bestItem: null,
          desiredQty: state.bulkRows[index]?.desiredQty || 1,
          selectedGroupKey: '',
          requiresVariantChoice: false,
          status: 'error',
          error: error?.message || 'Arama hatasi',
        };
      }

      if (state.bulkSearchRunId !== runId) return nextRow;
      state.bulkRows[index] = nextRow;
      if (state.currentPage === 'bulk') renderBulkPage();
      return nextRow;
    });

    await runConcurrent(tasks, Math.min(4, tasks.length));
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
    const input = document.querySelector('.nav-search');
    if (input) input.value = searchValue;
    runSearch(searchValue);
  }

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
    const cleanBarcode = typeof parseQRCode === 'function' ? parseQRCode(query) : '';
    const normalizedQuery = cleanBarcode && cleanBarcode.length === 13 ? cleanBarcode : query;

    if (depotId === 'anadolu-pharma' && normalizedQuery) return { url: `https://b2b.anadolupharma.com/UrunAra/1?search=${encodeURIComponent(normalizedQuery)}`, copyText: normalizedQuery };
    if (depotId === 'anadolu-itriyat' && normalizedQuery) return { url: `https://b4b.anadoluitriyat.com/Search?text=${encodeURIComponent(normalizedQuery)}`, copyText: normalizedQuery };
    if (depotId === 'selcuk' && normalizedQuery) return { url: `https://webdepo.selcukecza.com.tr/Siparis/hizlisiparis.aspx?ilcAdi=${encodeURIComponent(normalizedQuery)}`, copyText: normalizedQuery };
    if (depotId === 'nevzat' && normalizedQuery) return { url: `http://webdepo.nevzatecza.com.tr/Siparis/hizlisiparis.aspx?ilcAdi=${encodeURIComponent(normalizedQuery)}`, copyText: normalizedQuery };
    if (depotId === 'sentez' && normalizedQuery) return { url: `https://www.sentezb2b.com/tr-TR/Site/Liste?tip=Arama&arama=${encodeURIComponent(normalizedQuery)}&s=a`, copyText: normalizedQuery };
    return { url: fallbackUrl || '', copyText: normalizedQuery };
  }

  function copyAndOpenDepot(url, depotId, rawQuery = '', runtime = {}, deps = {}) {
    const { state } = runtime;
    const { buildChromeDepotTarget: buildChromeDepotTargetFn, openUrl: openUrlFn } = deps;
    const searchText = String(rawQuery || '').trim() || state.currentDetailQuery || state.searchQuery || '';
    const target = typeof buildChromeDepotTargetFn === 'function'
      ? buildChromeDepotTargetFn(depotId, searchText, url)
      : { url: url || '', copyText: searchText };
    if (!target.url) return;
    if (target.copyText && navigator.clipboard?.writeText) navigator.clipboard.writeText(target.copyText).catch(() => {});
    if (typeof openUrlFn === 'function') openUrlFn(target.url);
  }

  function openPlanInDepot(key = '', depotId = '', runtime = {}, deps = {}) {
    const { getOrderPlan, copyAndOpenDepot: copyAndOpenDepotFn } = deps;
    const plan = getOrderPlan();
    const target = key
      ? plan.find((item) => item.key === key && (!depotId || (item.depotId || item.depot) === depotId))
      : plan.find((item) => item?.depotUrl);
    if (!target) return;
    copyAndOpenDepotFn(target.depotUrl || '', target.depotId || target.depot || depotId || '', target.barcode || target.name || target.key || '');
  }

  function openDrawer() {
    document.getElementById('edit-drawer-overlay')?.classList.add('open');
    document.getElementById('edit-drawer')?.classList.add('open');
  }

  function closeDrawer(runtime = {}) {
    const { state } = runtime;
    state.planDrawerKey = '';
    document.getElementById('edit-drawer-overlay')?.classList.remove('open');
    document.getElementById('edit-drawer')?.classList.remove('open');
  }

  function openBulkDrawer(index = 0, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderBulkDrawer } = deps;
    if (!state.bulkRows[index]) {
      state.bulkDrawerIndex = -1;
      return;
    }
    state.bulkDrawerIndex = index;
    document.getElementById('bulk-drawer-overlay')?.classList.add('open');
    document.getElementById('bulk-drawer')?.classList.add('open');
    renderBulkDrawer(state.bulkRows[index]);
  }

  function closeBulkDrawer(runtime = {}) {
    const { state } = runtime;
    state.bulkDrawerIndex = -1;
    document.getElementById('bulk-drawer-overlay')?.classList.remove('open');
    document.getElementById('bulk-drawer')?.classList.remove('open');
  }

  function openPlanDrawer(groupKey, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { openDrawer: openDrawerFn, renderPlanDrawer } = deps;
    state.planDrawerKey = groupKey;
    openDrawerFn();
    renderPlanDrawer(groupKey);
  }

  async function saveDepotSettings(depotId, deps = {}) {
    const { authFetch, API_BASE, loadConfig, renderSettingsPage } = deps;
    const fields = Array.from(document.querySelectorAll(`[data-depot-id="${depotId}"]`));
    const credentials = {};
    fields.forEach((field) => {
      credentials[field.dataset.depotField] = field.value;
    });
    const status = document.getElementById(`settings-status-${depotId}`);
    if (status) status.textContent = 'Kaydediliyor...';
    const res = await authFetch(`${API_BASE}/api/config/depot`, {
      method: 'POST',
      body: JSON.stringify({ depotId, credentials }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      if (status) status.textContent = data.error || 'Kayit basarisiz';
      return;
    }
    await loadConfig();
    if (status) status.textContent = 'Kaydedildi';
    renderSettingsPage();
  }

  async function testDepotLogin(depotId, deps = {}) {
    const { authFetch, API_BASE, loadConfig, renderSettingsPage } = deps;
    const fields = Array.from(document.querySelectorAll(`[data-depot-id="${depotId}"]`));
    const credentials = {};
    fields.forEach((field) => {
      credentials[field.dataset.depotField] = field.value;
    });
    const status = document.getElementById(`settings-status-${depotId}`);
    const card = status?.closest('.settings-card');
    if (card) card.dataset.state = 'refreshing';
    if (status) status.textContent = 'Test login calisiyor...';
    const res = await authFetch(`${API_BASE}/api/test-login`, {
      method: 'POST',
      body: JSON.stringify({ depotId, credentials }),
    });
    const data = await res.json();
    if (status) status.textContent = data.success ? 'Login basarili' : (data.error || 'Login basarisiz');
    if (data.success) {
      await loadConfig();
      renderSettingsPage();
      return;
    }
    if (card) card.dataset.state = 'disconnected';
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleCompatPanel() {
    document.getElementById('compatPanel')?.toggleAttribute('open');
  }

  async function runCompatHealth(deps = {}) {
    const { authFetch, API_BASE } = deps;
    const res = await authFetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const box = document.getElementById('compatStatusBox');
    if (box) box.textContent = `Health ok=${data.ok} activeDepots=${data.activeDepots} service=${data.service}`;
  }

  async function runCompatDemo(deps = {}) {
    const { authFetch, API_BASE } = deps;
    const res = await authFetch(`${API_BASE}/api/demo/panel`);
    const data = await res.json();
    const box = document.getElementById('compatStatusBox');
    if (box) box.textContent = `Demo role=${data.selectedRole} accountCount=${(data.accounts || []).length}`;
  }

  async function runCompatUpdate(runtime = {}) {
    const { state } = runtime;
    const box = document.getElementById('compatStatusBox');
    if (window.electronAPI?.checkForUpdates) {
      await window.electronAPI.checkForUpdates();
      if (box) box.textContent = `Surum: ${state.appVersion || '-'} | Update kontrolu gonderildi`;
      return;
    }
    if (box) box.textContent = 'Update bridge kullanilamiyor';
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
      const updated = getOrderPlan().find((item) => item.key === groupKey && (item.depotId || item.depot) === nextSelectedDepotId);
      if (updated) upsertApprovalFromPlanItem(updated);
    }
    finalizePlanMutation();
  }

  function bindTitlebar() {
    const applyMaximizeState = (isMaximized) => {
      const icon = document.getElementById('maximizeIcon');
      if (!icon) return;
      icon.innerHTML = isMaximized
        ? '<rect x="3" y="5" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/><polyline points="6,5 6,3 10,3 10,7 8,7" fill="none" stroke="currentColor" stroke-width="1.2"/>'
        : '<rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    };
    document.getElementById('tbMinimize')?.addEventListener('click', () => window.electronAPI?.minimize?.());
    document.getElementById('tbMaximize')?.addEventListener('click', () => window.electronAPI?.maximize?.());
    document.getElementById('tbClose')?.addEventListener('click', () => window.electronAPI?.close?.());
    window.electronAPI?.isMaximized?.().then(applyMaximizeState).catch(() => {});
    window.electronAPI?.onMaximizeChange?.(applyMaximizeState);
  }

  globalScope.V23AppActions = {
    getOfferKey,
    getSelectedDetailItem,
    normalizeBulkQueries,
    getBulkRowQty,
    getBulkSelectedGroup,
    changeBulkRowQty,
    setBulkRowQty,
    selectBulkGroup,
    setDesiredQty,
    changeDesiredQty,
    selectOffer,
    toggleMfCalculator,
    renderHistoryEntry,
    runSearch,
    addSelectedOfferToPlan,
    addOfferToPlan,
    openSelectedOfferInDepot,
    openOfferInDepot,
    openVariantDetail,
    bulkSearch,
    addBulkRowToPlan,
    selectBulkOffer,
    addBulkOfferToPlan,
    openBulkVariant,
    returnToBulkDetail,
    openHistorySearch,
    openPlanPreview,
    openUrl,
    buildChromeDepotTarget,
    copyAndOpenDepot,
    openPlanInDepot,
    openDrawer,
    closeDrawer,
    openBulkDrawer,
    closeBulkDrawer,
    openPlanDrawer,
    saveDepotSettings,
    testDepotLogin,
    scrollToTop,
    toggleCompatPanel,
    runCompatHealth,
    runCompatDemo,
    runCompatUpdate,
    changePlanQty,
    removePlanItemAndRender,
    selectPlanAlternative,
    bindTitlebar,
  };
})(typeof window !== 'undefined' ? window : null);
