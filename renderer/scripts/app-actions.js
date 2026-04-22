/**
 * app-actions.js
 * Shared action aggregator for V2.3.1.
 * Search/detail/plan flows live in dedicated owner modules.
 */
(function initV23AppActions(globalScope) {
  if (!globalScope) return;

  const searchActions = globalScope.V23SearchActions || {};
  const detailActions = globalScope.V23DetailActions || {};
  const planActions = globalScope.V23PlanActions || {};

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

  function openDrawer() {
    document.getElementById('edit-drawer-overlay')?.classList.add('open');
    document.getElementById('edit-drawer')?.classList.add('open');
  }

  function closeDrawer(runtime = {}) {
    const { state } = runtime;
    document.getElementById('edit-drawer-overlay')?.classList.remove('open');
    document.getElementById('edit-drawer')?.classList.remove('open');
    if (state) state.planDrawerKey = '';
  }

  function openBulkDrawer(index = 0, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderBulkDrawer } = deps;
    const row = state?.bulkRows?.[index];
    if (!row) return;
    state.bulkDrawerIndex = index;
    renderBulkDrawer(row);
    document.getElementById('bulk-drawer-overlay')?.classList.add('open');
    document.getElementById('bulk-drawer')?.classList.add('open');
  }

  function closeBulkDrawer(runtime = {}) {
    const { state } = runtime;
    document.getElementById('bulk-drawer-overlay')?.classList.remove('open');
    document.getElementById('bulk-drawer')?.classList.remove('open');
    if (state) state.bulkDrawerIndex = -1;
  }

  function openPlanDrawer(groupKey, runtime = {}, deps = {}) {
    const { state } = runtime;
    const { renderPlanDrawer } = deps;
    if (!groupKey) return;
    state.planDrawerKey = groupKey;
    renderPlanDrawer(groupKey);
    openDrawer();
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
    dedupeOffersByKey,
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
    bindTitlebar,
    ...searchActions,
    ...detailActions,
    ...planActions,
  };
})(typeof window !== 'undefined' ? window : null);
