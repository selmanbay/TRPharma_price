/**
 * search-actions.js
 * Search flow owner for V2.3.1 runtime.
 */
(function initV23SearchActions(globalScope) {
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
      patchBulkRow,
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
      if (state.currentPage === 'bulk') {
        const patched = typeof patchBulkRow === 'function' ? patchBulkRow(index) : false;
        if (!patched && typeof renderBulkPage === 'function') renderBulkPage();
      }
      return nextRow;
    });

    await runConcurrent(tasks, Math.min(4, tasks.length));
  }

  globalScope.V23SearchActions = {
    renderHistoryEntry,
    runSearch,
    openVariantDetail,
    bulkSearch,
  };
})(typeof window !== 'undefined' ? window : null);
