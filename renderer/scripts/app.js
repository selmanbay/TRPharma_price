const API_BASE = 'http://localhost:3000';

// -- Global error reporting (sessiz kirilmalari konsola ceker) --
const DIAGNOSTIC_BUFFER_LIMIT = 120;

const diagnosticsBuffer = [];
let diagnosticsSequence = 0;
let latestUpdatePayload = null;
let updateStatusBridgeBound = false;
let activeSettingsTab = 'general';
let lastSearchAttempt = { query: '', timestamp: 0 };
let searchUiState = 'idle';
let searchErrorState = null;

window.addEventListener('error', function(e) {
  console.error('[GlobalError]', e.message, e.filename + ':' + e.lineno);
  pushDiagnosticEvent('renderer-error', e.message || 'Bilinmeyen renderer hatası', {
    filename: e.filename || '',
    line: e.lineno || 0,
  });
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('[UnhandledPromise]', e.reason);
  pushDiagnosticEvent('renderer-promise', String(e.reason?.message || e.reason || 'Unhandled promise'));
});



// ──── Title bar controls ────
if (window.electronAPI) {
  document.getElementById('tbMinimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('tbMaximize').addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('tbClose').addEventListener('click', () => window.electronAPI.close());

  window.electronAPI.onMaximizeChange((isMaximized) => {
    const icon = document.getElementById('maximizeIcon');
    if (isMaximized) {
      icon.innerHTML = '<rect x="3" y="5" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/><polyline points="6,5 6,3 12,3 12,9 9,9" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    } else {
      icon.innerHTML = '<rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    }
  });
} else {
  // Tarayıcı ortamında (Localhost:3000 Web) çalışıyorsa Electron özel Titlebar'ı gizle
  const titlebar = document.getElementById('titlebar');
  if (titlebar) titlebar.style.display = 'none';
}

// ──── Navigation with transitions ────
let currentPage = 'home';

function pushDiagnosticEvent(type, message, meta = {}) {
  diagnosticsSequence += 1;
  diagnosticsBuffer.unshift({
    id: diagnosticsSequence,
    type,
    message,
    meta,
    timestamp: Date.now(),
  });
  if (diagnosticsBuffer.length > DIAGNOSTIC_BUFFER_LIMIT) diagnosticsBuffer.length = DIAGNOSTIC_BUFFER_LIMIT;
  if (currentPage === 'settings' && activeSettingsTab === 'developer') {
    renderSettings();
  }
}

function getDiagnosticsSnapshot() {
  return diagnosticsBuffer.slice();
}

function clearDiagnosticsBuffer() {
  diagnosticsBuffer.length = 0;
  diagnosticsSequence = 0;
}

function setupElectronDiagnosticsBridge() {
  if (updateStatusBridgeBound || !window.electronAPI?.onUpdateStatus) return;
  updateStatusBridgeBound = true;
  window.electronAPI.onUpdateStatus((payload) => {
    latestUpdatePayload = payload || null;
    pushDiagnosticEvent('updater', payload?.phase || 'unknown', payload || {});
    if (currentPage === 'settings') renderSettings();
  });
}

function showPage(name) {
  if (name === currentPage) return;

  if (name !== 'order-plan' && planEditorDrawerState.open) {
    closePlanEditorDrawer();
  }

  const fromPage = document.getElementById('page-' + currentPage);
  const toPage = document.getElementById('page-' + name);
  const isBack = (name === 'home');

  if (fromPage) {
    const exitClass = isBack ? 'page-exit-back' : 'page-exit';
    if (currentPage === 'home') {
      fromPage.classList.add('page-exit-home');
    } else {
      fromPage.classList.add(exitClass);
    }

    const onExit = () => {
      fromPage.classList.remove('active', 'page-exit', 'page-exit-back', 'page-exit-home');
      fromPage.removeEventListener('animationend', onExit);
    };
    fromPage.addEventListener('animationend', onExit, { once: true });

    setTimeout(() => {
      fromPage.classList.remove('active', 'page-exit', 'page-exit-back', 'page-exit-home');
    }, 300);
  }

  setTimeout(() => {
    toPage.classList.add('active');
    const enterClass = isBack ? 'page-enter-home' : 'page-enter';
    if (name === 'home') {
      toPage.classList.add('page-enter-home');
    } else {
      toPage.classList.add(enterClass);
    }

    const onEnter = () => {
      toPage.classList.remove('page-enter', 'page-enter-back', 'page-enter-home');
      toPage.removeEventListener('animationend', onEnter);
    };
    toPage.addEventListener('animationend', onEnter, { once: true });

    setTimeout(() => {
      toPage.classList.remove('page-enter', 'page-enter-back', 'page-enter-home');
    }, 450);

    currentPage = name;

    if (name === 'home') {
      document.getElementById('homeSearchInput').focus();
      renderHomeDashboard();
    }
    if (name === 'search') document.getElementById('searchInput').focus();
    if (name === 'settings') renderSettings();
    if (name === 'history') renderHistory();
    if (name === 'order-plan') renderOrderPlanDetail();
  }, isBack ? 180 : 200);
}

// ──── Profile menu ────
function toggleProfileMenu() {
  document.querySelector('.profile-wrapper').classList.toggle('open');
}

function closeProfileMenu() {
  document.querySelector('.profile-wrapper').classList.remove('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.profile-wrapper')) {
    closeProfileMenu();
  }
});

document.getElementById('profileHistoryBtn')?.addEventListener('click', () => {
  showPage('history');
  closeProfileMenu();
});

document.getElementById('profileSettingsBtn')?.addEventListener('click', () => {
  showPage('settings');
  closeProfileMenu();
});

document.getElementById('profileQuitBtn')?.addEventListener('click', () => {
  closeProfileMenu();
  if (window.electronAPI?.quitApp) {
    window.electronAPI.quitApp();
  }
});

document.getElementById('profileLogoutBtn')?.addEventListener('click', () => {
  closeProfileMenu();
  logout();
});

function homeSearch() {
  let q = document.getElementById('homeSearchInput').value.trim();
  if (!q) return;

  // Karekod mu?
  const cleanBarcode = parseQRCode(q);
  if (cleanBarcode && cleanBarcode.length === 13) {
    q = cleanBarcode;
    selectedBarcode = cleanBarcode;
  }

  document.getElementById('searchInput').value = q;
  showPage('search');
  doSearch();
}

document.getElementById('homeSearchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    homeSearch();
  }
});
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doSearch();
  }
});
bindSearchErrorActions();

// ──── Keyboard shortcuts ────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    if (currentPage === 'home') {
      document.getElementById('homeSearchInput').focus();
    } else if (currentPage === 'search') {
      document.getElementById('searchInput').focus();
    }
  }
  if (e.key === 'Escape') {
    if (document.getElementById('planEditorPanel')?.classList.contains('open')) {
      closePlanEditorDrawer();
    } else if (document.getElementById('depotPanel').classList.contains('open')) {
      closeDepotPanel();
    } else if (currentPage !== 'home') {
      showPage('home');
    }
  }
  if (e.key === 'F5') {
    e.preventDefault();
    if (currentPage === 'search') doSearch();
  }
});

// ──── Search ────
let selectedBarcode = null;
let selectedVariant = null;
let currentDetailItems = [];
let currentDetailQuery = '';
let currentSelectedOfferKey = '';
let activePlanDetailEditorKey = '';
const planEditorDrawerState = {
  open: false,
  loading: false,
  error: '',
  key: '',
  depot: '',
  qty: 1,
  name: '',
  barcode: '',
  items: [],
  options: [],
  selectedKey: '',
  userSelected: false,
  quoteVersion: 0,
};

function resetSearchDetailState() {
  currentDetailItems = [];
  currentDetailQuery = '';
  currentSelectedOfferKey = '';
  const actionQtyInput = document.getElementById('searchActionQtyInput');
  if (actionQtyInput) actionQtyInput.value = '1';
}

function hideSearchResultSections() {
  document.getElementById('variantSelectionLayer').style.display = 'none';
  document.getElementById('productCard').style.display = 'none';
  document.getElementById('bestPriceCard').style.display = 'none';
  document.getElementById('searchActionPanel').style.display = 'none';
  document.getElementById('otherDepots').style.display = 'none';
  setSearchInlineLoading(false);
  document.getElementById('stockCalcPanel').classList.remove('open');
  document.getElementById('stockCalcTrigger').style.display = 'none';
  document.getElementById('stockCalcTrigger').classList.remove('open');
}

function clearSearchErrorState() {
  searchErrorState = null;
  const card = document.getElementById('searchErrorCard');
  const authBtn = document.getElementById('searchAuthBtn');
  if (card) card.style.display = 'none';
  if (authBtn) authBtn.style.display = 'none';
}

function setSearchInlineLoading(visible, text = 'Diger depo teklifleri yukleniyor...') {
  const el = document.getElementById('searchInlineLoading');
  if (!el) return;
  const textEl = el.querySelector('span');
  if (textEl) textEl.textContent = text;
  el.style.display = visible ? 'flex' : 'none';
}

function classifySearchFailure(error) {
  const status = Number(error?.status) || 0;
  if (status === 401 || error?.type === 'auth') {
    return {
      type: 'auth',
      title: 'Oturum yenilenmeli',
      message: 'Oturum doğrulaması sona ermiş olabilir. Giriş ekranını açıp tekrar deneyin.',
    };
  }
  if (error?.type === 'timeout') {
    return {
      type: 'network',
      title: 'Arama zaman aşımına uğradı',
      message: 'Depolar zamanında yanıt vermedi. Bağlantınızı kontrol edip tekrar deneyin.',
    };
  }
  return {
    type: 'network',
    title: 'Sonuçlar yüklenemedi',
    message: 'Depolardan sonuç alınamadı. Tekrar deneyin.',
  };
}

function showSearchErrorState(errorInfo) {
  searchUiState = 'error';
  searchErrorState = errorInfo;
  const card = document.getElementById('searchErrorCard');
  const title = document.getElementById('searchErrorTitle');
  const message = document.getElementById('searchErrorMessage');
  const authBtn = document.getElementById('searchAuthBtn');
  if (title) title.textContent = errorInfo?.title || 'Sonuçlar yüklenemedi';
  if (message) message.textContent = errorInfo?.message || 'Tekrar deneyin.';
  if (authBtn) authBtn.style.display = errorInfo?.type === 'auth' ? 'inline-flex' : 'none';
  if (card) card.style.display = 'block';
}

function bindSearchErrorActions() {
  document.getElementById('searchRetryBtn')?.addEventListener('click', () => {
    if (!lastSearchAttempt.query) return;
    document.getElementById('searchInput').value = lastSearchAttempt.query;
    doSearch();
  });
  document.getElementById('searchAuthBtn')?.addEventListener('click', () => {
    if (typeof showAuthOverlay === 'function') showAuthOverlay('login');
  });
}

const STORAGE_KEYS = {
  orderPlan: 'eczane.orderPlan.v1',
  routineList: 'eczane.routineList.v1',
};

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getOrderPlan() {
  return dedupeStoredItems(
    readStoredJson(STORAGE_KEYS.orderPlan, []).map(normalizeOrderPlanItem).filter(Boolean),
    (item) => `${item.key}::${item.depot || ''}`
  );
}

function saveOrderPlan(items) {
  writeStoredJson(
    STORAGE_KEYS.orderPlan,
    (items || []).map(normalizeOrderPlanItem).filter(Boolean)
  );
}

function getRoutineList() {
  return dedupeStoredItems(
    readStoredJson(STORAGE_KEYS.routineList, []).map(normalizeRoutineItem),
    (item) => item.key
  );
}

function saveRoutineList(items) {
  writeStoredJson(STORAGE_KEYS.routineList, items);
}

function normalizeOrderPlanItem(item) {
  const barcode = String(item?.barcode || '').trim();
  if (!isBarcodeQuery(barcode)) {
    return null;
  }

  const desiredQty = Math.max(parseInt(item?.desiredQty, 10) || 1, 1);
  const rawOrderQty = Math.max(parseInt(item?.orderQty, 10) || 0, 0);
  const rawReceiveQty = Math.max(parseInt(item?.receiveQty, 10) || 0, 0);
  const rawTotalCost = Number(item?.totalCost) || 0;
  const derivedUnit = Number(item?.effectiveUnit)
    || Number(item?.unitPrice)
    || (rawOrderQty > 0 ? rawTotalCost / rawOrderQty : 0)
    || (desiredQty > 0 ? rawTotalCost / desiredQty : 0);

  const nextItem = {
    ...item,
    key: barcode,
    barcode,
    query: barcode,
    desiredQty,
    orderQty: desiredQty,
    receiveQty: desiredQty,
    totalCost: derivedUnit > 0 ? derivedUnit * desiredQty : rawTotalCost,
    effectiveUnit: derivedUnit,
    planningMode: item?.planningMode || 'unit',
  };

  const legacyMf = parseMf(nextItem.mfStr);
  const isLegacySingleUnitMf =
    nextItem.planningMode !== 'mf' &&
    nextItem.desiredQty === 1 &&
    legacyMf &&
    nextItem.orderQty > 1 &&
    nextItem.receiveQty > 1 &&
    nextItem.totalCost > 0;

  if (isLegacySingleUnitMf) {
    const derivedUnitPrice = nextItem.orderQty > 0 ? nextItem.totalCost / nextItem.orderQty : nextItem.totalCost;
    nextItem.orderQty = 1;
    nextItem.receiveQty = 1;
    nextItem.totalCost = derivedUnitPrice;
    nextItem.effectiveUnit = derivedUnitPrice;
    nextItem.planningMode = 'unit';
  }

  return nextItem;
}

function normalizeRoutineItem(item) {
  const barcode = String(item?.barcode || '').trim();
  return {
    ...item,
    key: barcode || String(item?.key || slugifyName(item?.name || item?.query || 'urun')).trim(),
    barcode,
    query: String(barcode || item?.query || item?.name || '').trim(),
  };
}

function buildVariantImageMarkup(url) {
  const normalized = normalizeImageUrl(url);
  if (!normalized || !isUsableImageUrl(normalized)) {
    return `<div class="v-list-img-fallback">${getImageFallbackSvg(24)}</div>`;
  }

  return `
    <img
      src="${esc(normalized)}"
      alt=""
      loading="lazy"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    />
    <div class="v-list-img-fallback" style="display:none;">${getImageFallbackSvg(24)}</div>
  `;
}

function getItemBarcode(item, fallbackQuery = '') {
  const direct = String(item?.barkod || '').trim();
  if (direct) return direct;

  const extracted = extractBarcode(item?.kodu);
  if (extracted) return extracted;

  const parsedQuery = parseQRCode(fallbackQuery);
  return isBarcodeQuery(parsedQuery) ? parsedQuery : '';
}

function getBarcodeHints(items, fallbackQuery = '') {
  const hints = new Map();
  for (const item of items || []) {
    const barcode = getItemBarcode(item, fallbackQuery);
    const nameKey = normalizeDrugName(item?.ad);
    if (barcode && nameKey && !hints.has(nameKey)) {
      hints.set(nameKey, barcode);
    }
  }
  return hints;
}

function resolveItemBarcode(item, barcodeHints, fallbackQuery = '') {
  return getItemBarcode(item, fallbackQuery) || barcodeHints.get(normalizeDrugName(item?.ad)) || '';
}

function getItemIdentityKey(item, barcodeHints, fallbackQuery = '') {
  const barcode = resolveItemBarcode(item, barcodeHints, fallbackQuery);
  if (barcode) return `BARCODE_${barcode}`;
  return `NAME_${normalizeDrugName(item?.ad)}`;
}

function chooseCanonicalProductName(items, fallbackName = '') {
  const names = (items || [])
    .map((item) => String(item?.ad || '').trim())
    .filter(Boolean);

  if (!names.length) {
    return fallbackName || 'Bilinmeyen Ilac Formu';
  }

  names.sort((a, b) => a.length - b.length || a.localeCompare(b, 'tr'));
  return names[0];
}

function comparePreferredItems(a, b) {
  const aInStock = a?.stokVar ? 1 : 0;
  const bInStock = b?.stokVar ? 1 : 0;
  if (aInStock !== bInStock) return bInStock - aInStock;

  const aHasPrice = a?.fiyatNum > 0 ? 1 : 0;
  const bHasPrice = b?.fiyatNum > 0 ? 1 : 0;
  if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice;

  if (aHasPrice && bHasPrice && a.fiyatNum !== b.fiyatNum) {
    return a.fiyatNum - b.fiyatNum;
  }

  const aHasImage = isUsableImageUrl(normalizeImageUrl(a?.imgUrl, a?.depotUrl)) ? 1 : 0;
  const bHasImage = isUsableImageUrl(normalizeImageUrl(b?.imgUrl, b?.depotUrl)) ? 1 : 0;
  if (aHasImage !== bHasImage) return bHasImage - aHasImage;

  const aName = String(a?.ad || '');
  const bName = String(b?.ad || '');
  return aName.length - bName.length || aName.localeCompare(bName, 'tr');
}

function dedupeSearchItems(items, query = '') {
  if (!Array.isArray(items) || items.length === 0) return [];

  const barcodeHints = getBarcodeHints(items, query);
  const groups = new Map();

  for (const item of items) {
    const barcode = resolveItemBarcode(item, barcodeHints, query);
    const identityKey = barcode ? `BARCODE_${barcode}` : `NAME_${normalizeDrugName(item?.ad)}`;
    const prepared = {
      ...item,
      barkod: barcode || String(item?.barkod || '').trim(),
    };

    if (!groups.has(identityKey)) {
      groups.set(identityKey, []);
    }
    groups.get(identityKey).push(prepared);
  }

  const deduped = [];
  for (const groupItems of groups.values()) {
    const canonicalName = chooseCanonicalProductName(groupItems, query);
    const canonicalBarcode = groupItems.find((item) => item.barkod)?.barkod || '';
    const depotItems = new Map();

    for (const item of groupItems) {
      const depotKey = `${item.depotId || ''}::${item.depot || ''}`;
      const prepared = {
        ...item,
        ad: canonicalName,
        barkod: canonicalBarcode || item.barkod || '',
      };
      const existing = depotItems.get(depotKey);
      if (!existing || comparePreferredItems(prepared, existing) < 0) {
        depotItems.set(depotKey, prepared);
      }
    }

    deduped.push(...depotItems.values());
  }

  return deduped;
}

let searchStartTime = 0;
const MIN_GATHER_TIME = 1500; // 1.5 saniye bekle ki kartlar ziplamasm
let pendingSearchRenderTimer = null;
let pendingSearchWatchdogTimer = null;
const SEARCH_WATCHDOG_MS = 8000;

// Faz 2 - Render batching: depo yanitlari tek noktal gelirse 120ms throttle ile birlestir
const RENDER_BATCH_MS = 120;
let _batchRenderTimer = null;

/**
 * Gelen her depo yaniti icin aninda render etmek yerine
 * RENDER_BATCH_MS ms bekleyip son birlesik state ile render yapar.
 * Barkod aramalarinda bypass edilir (hiz kritik).
 */
function scheduleRender(getItems, query, searchId, isBarcodeQ) {
  // Barkodlarda throttle yok - direkt render
  if (isBarcodeQ) {
    if (searchId !== _activeSearchId) return;
    renderResults(getItems(), query);
    return;
  }

  if (_batchRenderTimer) clearTimeout(_batchRenderTimer);
  _batchRenderTimer = setTimeout(function() {
    _batchRenderTimer = null;
    if (searchId !== _activeSearchId) return;
    const items = getItems();
    if (items.length > 0) renderResults(items, query);
  }, RENDER_BATCH_MS);
}

let lastSearchQuery = null;
let lastSearchTime = 0;

// Race condition koruması: her aramaya artan bir kimlik atanır.
// Eski bir aramanın geç gelen yanıtı yeni sonucu ezemez.
let _activeSearchId = 0;

async function doSearch() {
  const nowTime = Date.now();
  const input = document.getElementById('searchInput');
  let query = selectedBarcode || input.value.trim();

  // Karekod analizi
  const cleanBarcode = parseQRCode(query);
  if (cleanBarcode && cleanBarcode.length === 13) {
    query = cleanBarcode;
    input.value = cleanBarcode;
  }

  // 300ms icinde ayni arama geldiyse (karekod hizi) blokla
  if (query === lastSearchQuery && (nowTime - lastSearchTime < 300)) return;
  
  lastSearchQuery = query;
  lastSearchTime = nowTime;
  lastSearchAttempt = { query, timestamp: nowTime };
  selectedVariant = null;
  searchStartTime = nowTime;
  selectedBarcode = null; 
  if (!query) return;

  const loading = document.getElementById('loading');
  const status = document.getElementById('statusMsg');
  clearSearchErrorState();
  if (pendingSearchRenderTimer) {
    clearTimeout(pendingSearchRenderTimer);
    pendingSearchRenderTimer = null;
  }

  searchUiState = 'loading';
  loading.style.display = 'block';
  status.textContent = 'Sonuçlar aranıyor...';
  status.className = 'status-msg';
  pushDiagnosticEvent('search-start', `Arama başlatıldı: ${query}`, { query });

  if (!cachedConfig) {
    await loadDepotStatus();
  }
  if (!cachedConfig || !cachedConfig.depots) {
    searchUiState = 'error';
    loading.style.display = 'none';
    status.textContent = 'Depo ayarlari yuklenemedi. Lutfen tekrar deneyin.';
    status.className = 'status-msg error';
    showSearchErrorState({
      type: 'network',
      title: 'Depo ayarlari okunamadi',
      message: 'Ayarlar yuklenemedi. Birkac saniye sonra tekrar deneyin.',
    });
    return;
  }

  const activeDepots = DEPOT_LIST.filter(d => {
    const info = (cachedConfig.depots && cachedConfig.depots[d.id]) ? cachedConfig.depots[d.id] : null;
    return info && (info.hasCredentials || info.hasCookies || info.hasToken);
  });

  if (activeDepots.length === 0) {
    searchUiState = 'error';
    loading.style.display = 'none';
    status.textContent = 'Ayarlanmis depo bulunamadi.';
    showSearchErrorState({
      type: 'network',
      title: 'Aktif depo bulunamadi',
      message: 'Once Ayarlar ekranindan en az bir depo baglantisi tanimlayin.',
    });
    return;
  }

  // Race condition koruması: bu aramaya özel token oluştur
  const searchId = ++_activeSearchId;

  let allItems = [];
  let pendingReqs = activeDepots.length;
  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  activeDepots.forEach(depot => {
    authFetch(`${API_BASE}/api/search-depot?q=${encodeURIComponent(query)}&depotId=${depot.id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(data?.error || `HTTP ${res.status}`);
          err.status = res.status;
          err.type = res.status === 401 ? 'auth' : 'network';
          throw err;
        }
        return data;
      })
      .then(data => {
        if (searchId !== _activeSearchId) return;

        if (data?.error) {
          const err = new Error(data.error);
          err.type = 'network';
          throw err;
        }

        successCount++;
        if (!data.error && data.results && data.results.length > 0) {
          const depotUrl = data.depotUrl || '';
          data.results.forEach(r => { r.depotUrl = depotUrl; r.depotId = depot.id; });
          allItems = allItems.concat(data.results);
          const isBarcode = isBarcodeQuery(query);
          scheduleRender(function() {
            return allItems.slice().sort(function(a, b) {
              if (a.fiyatNum === 0 && b.fiyatNum !== 0) return 1;
              if (b.fiyatNum === 0 && a.fiyatNum !== 0) return -1;
              return a.fiyatNum - b.fiyatNum;
            });
          }, query, searchId, isBarcode);
          if (!isBarcode && selectedVariant === null) {
            const remaining = Math.max(MIN_GATHER_TIME - (Date.now() - searchStartTime), 0);
            if (pendingSearchRenderTimer) clearTimeout(pendingSearchRenderTimer);
            pendingSearchRenderTimer = setTimeout(function() {
              if (searchId !== _activeSearchId) return;
              if (allItems.length > 0) renderResults(allItems, query);
              pendingSearchRenderTimer = null;
            }, remaining + 10);
          }
        }
      })
      .catch(err => {
        if (searchId !== _activeSearchId) return;
        console.error(`${depot.name} error:`, err);
        failureCount++;
        failures.push({ depot: depot.name, error: err });
        pushDiagnosticEvent('search-depot-error', `${depot.name} araması başarısız`, {
          depotId: depot.id,
          message: err?.message || String(err),
          type: err?.type || 'network',
          status: err?.status || 0,
          query,
        });
      })
      .finally(() => {
        pendingReqs--;
        if (pendingReqs === 0) {
          // Sadece hâlâ aktif aramanın sonunda loading'i kapat
          if (searchId === _activeSearchId) {
            loading.style.display = 'none';
            if (allItems.length === 0) {
              if (failureCount > 0 && successCount === 0) {
                const classified = classifySearchFailure(failures[0]?.error || {});
                status.textContent = '';
                status.className = 'status-msg';
                showSearchErrorState(classified);
                pushDiagnosticEvent('search-error', `Arama hata durumuna düştü: ${query}`, {
                  query,
                  failureCount,
                  activeDepots: activeDepots.length,
                  reason: classified.type,
                });
              } else {
                searchUiState = 'idle';
                hideSearchResultSections();
                currentDetailItems = [];
                currentDetailQuery = '';
                currentSelectedOfferKey = '';
                const actionQtyInput = document.getElementById('searchActionQtyInput');
                if (actionQtyInput) actionQtyInput.value = '1';
                status.textContent = 'Ilac bulunamadi (veya stokta yok).';
                status.className = 'status-msg error';
                pushDiagnosticEvent('search-empty', `Arama sonucu bulunamadı: ${query}`, {
                  query,
                  successCount,
                  failureCount,
                });
              }
            } else {
              searchUiState = 'success';
              status.textContent = '';
              saveHistory(allItems, query);
              pushDiagnosticEvent('search-success', `Arama tamamlandı: ${query}`, {
                query,
                resultCount: allItems.length,
                successCount,
                failureCount,
              });
            }
            if (pendingSearchRenderTimer && allItems.length === 0) {
              clearTimeout(pendingSearchRenderTimer);
              pendingSearchRenderTimer = null;
            }
          }
        }
      });
  });
}

function renderResults(items, query) {
  if (!items || items.length === 0) return;
  clearSearchErrorState();
  items = dedupeSearchItems(items, query);

  const isBarcode = isBarcodeQuery(query);
  const now = Date.now();
  const elapsed = now - searchStartTime;
  const barcodeHints = getBarcodeHints(items, query);

  // 1.5 saniye dolmadan sonuç gösterme (Görsel stabilite için)
  if (!isBarcode && selectedVariant === null && elapsed < MIN_GATHER_TIME) {
    return;
  }

  if (isBarcode || selectedVariant !== null) {
    // If scanning a barcode or if user already picked a variant, show final details.
    const filteredItems = isBarcode
      ? items
      : items.filter(i => getItemIdentityKey(i, barcodeHints, query) === selectedVariant);
    
    // Switch UI
    document.getElementById('variantSelectionLayer').style.display = 'none';
    
    if (filteredItems.length > 0) {
      renderDetailResults(filteredItems, query);
    }
    return;
  }

  // Not a barcode and no variant selected yet: GROUP MODE
  
  const groups = new Map();
  items.forEach(i => {
    const barcode = resolveItemBarcode(i, barcodeHints, query);
    const normName = normalizeDrugName(i.ad);
    const groupKey = barcode ? `BARCODE_${barcode}` : `NAME_${normName}`;
    const normalizedImgUrl = normalizeImageUrl(i.imgUrl, i.depotUrl);
    const hasValidImg = isUsableImageUrl(normalizedImgUrl);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: groupKey,
        barcode: barcode,
        normalizedName: normName,
        originalName: i.ad,
        count: 0,
        bestPrice: Infinity,
        imgUrl: hasValidImg ? normalizedImgUrl : null
      });
    }
    const g = groups.get(groupKey);
    g.count++;
    
    if (i.fiyatNum > 0 && i.fiyatNum < g.bestPrice) {
      g.bestPrice = i.fiyatNum;
    }
    
    if (!g.imgUrl && hasValidImg) g.imgUrl = normalizedImgUrl;
    
    // İsim temizleme: En kısa olanı (en jenerik olanı) seç
    if (i.ad.length < g.originalName.length) {
      g.originalName = i.ad;
    }
  });

  const uniqueGroups = Array.from(groups.values());

  if (uniqueGroups.length === 1) {
    // Auto-select if only 1 variant exists (or if normalization merged everything into 1)
    selectedVariant = uniqueGroups[0].id;
    document.getElementById('variantSelectionLayer').style.display = 'none';
    renderDetailResults(items, query);
    return;
  }

  // Render the Variant Layer
  renderVariantSelectionLayer(uniqueGroups, query, items);
}

function renderVariantSelectionLayer(groups, query, allItems) {
  // Sort variants alphabetically for consistent jumping fix
  groups.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

  document.getElementById('productCard').style.display = 'none';
  document.getElementById('bestPriceCard').style.display = 'none';
  document.getElementById('otherDepots').style.display = 'none';

  const layer = document.getElementById('variantSelectionLayer');
  layer.style.display = 'block';

  document.getElementById('variantCount').textContent = groups.length;
  const container = document.getElementById('variantCardsContainer');
  container.innerHTML = '';

  groups.forEach(g => {
    const card = document.createElement('div');
    card.className = 'variant-card-list';
    const hasPrice = g.bestPrice !== Infinity;
    const priceText = hasPrice ? `TL ${g.bestPrice.toFixed(2)}'den baslayan` : 'Stokta yok';
    
    card.innerHTML = `
      <div class="v-list-img">${buildVariantImageMarkup(g.imgUrl)}</div>
      <div class="v-list-content">
        <div class="variant-card-title">${g.originalName}</div>
        <div class="variant-card-meta">
          <span class="v-list-price">${priceText}</span>
          <span class="v-list-dot"></span>
          <span class="v-list-count">${g.count} Depo</span>
        </div>
      </div>
      <div class="v-list-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;

    card.onclick = () => {
      // ... click logic remains same ...
      if (g.barcode) {
        selectedBarcode = g.barcode;
        document.getElementById('searchInput').value = g.barcode;
        doSearch();
      } else {
        selectedVariant = g.id;
        renderResults(allItems, query);
      }
    };

    container.appendChild(card);
  });
}

function renderDetailResults(items, query) {
  if (!items || items.length === 0) return;
  clearSearchErrorState();
  items = dedupeSearchItems(items, query).slice().sort(compareDepotItems);
  currentDetailItems = items.slice();
  currentDetailQuery = query;

  const bestItem = items.find(i => i.fiyatNum > 0) || items[0];
  const selectedItem = resolveSelectedOfferItem(items) || bestItem;
  setSelectedOffer(selectedItem, items);

  const productCard = document.getElementById('productCard');
  const bestPriceCard = document.getElementById('bestPriceCard');
  const otherDepots = document.getElementById('otherDepots');
  let otherDepotsTitle = document.getElementById('otherDepotsTitle');
  if (!otherDepotsTitle && otherDepots) {
    const header = otherDepots.querySelector('.others-header');
    if (header) {
      header.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = '';
        }
      });
      otherDepotsTitle = document.createElement('span');
      otherDepotsTitle.id = 'otherDepotsTitle';
      header.appendChild(otherDepotsTitle);
    }
  }
  const tbody = document.getElementById('resultsBody');

  const firstName = chooseCanonicalProductName(items, query);
  document.getElementById('productName').textContent = firstName;
  const barcodeTag = document.getElementById('productBarcode');
  const barcodeText = document.getElementById('productBarcodeText');

  const barcodeHints = getBarcodeHints(items, query);
  const displayBarcode = isBarcodeQuery(query) ? query : resolveItemBarcode(items[0], barcodeHints, query);
  if (displayBarcode) {
    barcodeText.textContent = displayBarcode;
    barcodeTag.style.display = 'inline-flex';
  } else {
    barcodeTag.style.display = 'none';
  }
  document.getElementById('productCount').textContent = 'Toplam ' + items.length + ' Teklif Bulundu';

  const imgEl = document.getElementById('productImg');
  const preferredDepotOrder = ['Selçuk Ecza', 'Sentez B2B', 'Nevzat Ecza', 'Anadolu İtriyat', 'Alliance Healthcare', 'Anadolu Pharma'];
  const imgCandidates = items
    .map((item) => ({ ...item, resolvedImgUrl: normalizeImageUrl(item.imgUrl, item.depotUrl) }))
    .filter((item) => item.resolvedImgUrl && isUsableImageUrl(item.resolvedImgUrl));
  imgCandidates.sort((a, b) => {
    let indexA = preferredDepotOrder.indexOf(a.depot);
    let indexB = preferredDepotOrder.indexOf(b.depot);
    if (indexA === -1) indexA = 99;
    if (indexB === -1) indexB = 99;
    return indexA - indexB;
  });
  const firstValidImg = imgCandidates.length > 0 ? imgCandidates[0].resolvedImgUrl : null;

  const imgFallback = document.getElementById('productImgFallback');
  if (firstValidImg) {
    imgEl.onerror = () => {
      imgEl.style.display = 'none';
      imgFallback.style.display = 'block';
      imgEl.removeAttribute('src');
    };
    imgEl.src = firstValidImg;
    imgEl.style.display = 'block';
    imgFallback.style.display = 'none';
  } else {
    imgEl.onerror = null;
    imgEl.removeAttribute('src');
    imgEl.style.display = 'none';
    imgFallback.style.display = 'block';
  }
  productCard.style.display = 'flex';
  productCard.classList.add('result-card-enter');
  setTimeout(() => productCard.classList.remove('result-card-enter'), 400);

  document.getElementById('bestDepotName').textContent = bestItem.depot;
  if (otherDepotsTitle) otherDepotsTitle.textContent = 'DEPO TEKLIFLERI';
  document.getElementById('bestPrice').textContent = 'TL ' + bestItem.fiyat;

  const stockText = bestItem.stokVar
    ? (bestItem.stok > 0 && bestItem.stokGosterilsin ? bestItem.stok + ' Adet' : 'Stokta var')
    : 'Stok yok';
  const bestStockEl = document.getElementById('bestStock');
  bestStockEl.textContent = stockText;
  bestStockEl.style.color = bestItem.stokVar ? 'var(--status-green)' : 'var(--status-red)';

  const bestMfGroup = document.getElementById('bestMfGroup');
  const bestMf = document.getElementById('bestMf');
  if (bestItem.malFazlasi) {
    bestMf.textContent = bestItem.malFazlasi;
    bestMfGroup.style.display = 'block';
  } else {
    bestMfGroup.style.display = 'none';
  }

  const bestLinkEl = document.getElementById('bestDepotLink');
  if (bestItem.depotUrl) {
    bestLinkEl.dataset.url = bestItem.depotUrl;
    bestLinkEl.dataset.depotId = bestItem.depotId || '';
    bestLinkEl.style.display = 'inline-flex';
    bestLinkEl.onclick = () => copyAndOpenDepot(bestItem.depotUrl, bestItem.depotId);
  } else {
    bestLinkEl.style.display = 'none';
  }

  try {
    updateBestOfferCard(items);
  } catch (err) {
    console.error('Best offer render failed:', err);
  }

  bestPriceCard.style.display = 'block';
  bestPriceCard.classList.add('result-best-enter');
  setTimeout(() => bestPriceCard.classList.remove('result-best-enter'), 500);

  const tableItems = items.slice();
  tbody.innerHTML = '';
  if (tableItems.length > 0) {
    tableItems.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const isBestRow = item === bestItem;
      const isSelectedRow = getOfferSelectionKey(item) === currentSelectedOfferKey;
      tr.className = 'stagger-enter stagger-delay-' + Math.min(idx, 9)
        + (isBestRow ? ' is-best' : '')
        + (isSelectedRow ? ' is-selected' : '');
      const isInStock = item.stokVar;
      const stockStr = isInStock
        ? (item.stok > 0 && item.stokGosterilsin ? item.stok + ' Adet' : 'Stokta var')
        : 'Stok yok';

      const depotBtnHtml = item.depotUrl
        ? `<button class="btn-depot-link" data-url="${esc(item.depotUrl)}" data-depot-id="${esc(item.depotId || '')}">Depoya Git <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></button>`
        : '';
      const selectBtnHtml = `<button class="btn-plan-select ${isSelectedRow ? 'active' : ''}" data-offer-key="${esc(getOfferSelectionKey(item))}" aria-pressed="${isSelectedRow ? 'true' : 'false'}">${isSelectedRow ? 'Secili' : 'Plana Sec'}</button>`;

      tr.innerHTML = `
        <td>
          <div class="depot-name-cell">
            <div class="depot-icon-sm">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
             </div>
            <span class="depot-name-text">${esc(item.depot)}</span>
            ${isSelectedRow ? '<span class="depot-selected-pill">Secili Siparis Deposu</span>' : ''}
            ${isBestRow ? '<span class="depot-best-pill">En Ucuz Teklif</span>' : ''}
          </div>
        </td>
        <td>
          <div class="stock-cell">
            <span class="stock-dot ${isInStock ? 'yes' : 'no'}"></span>
            <span class="stock-text ${isInStock ? 'yes' : 'no'}">${stockStr}</span>
          </div>
        </td>
        <td>
          <span style="color:var(--accent);font-weight:600;font-size:13px;">${esc(item.malFazlasi)}</span>
        </td>
        <td class="price-cell">TL ${esc(item.fiyat)}</td>
        <td>
          <div class="depot-actions">
            ${selectBtnHtml}
            ${depotBtnHtml}
          </div>
        </td>
      `;

      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      tr.setAttribute('aria-label', `${item.depot} deposunu siparis plani icin sec`);
      tr.addEventListener('click', () => {
        setSelectedOffer(item, items);
        renderDetailResults(items, query);
      });
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedOffer(item, items);
          renderDetailResults(items, query);
        }
      });


      const selectBtn = tr.querySelector('.btn-plan-select');
      if (selectBtn) {
        selectBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelectedOffer(item, items);
          renderDetailResults(items, query);
        });
      }

      const btn = tr.querySelector('.btn-depot-link');
      if (btn) {
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          copyAndOpenDepot(btn.dataset.url, btn.dataset.depotId);
        });
      }

      tbody.appendChild(tr);
    });
    const selectedRow = tbody.querySelector('tr.is-selected');
    if (selectedRow && document.activeElement === document.body) {
      selectedRow.focus();
    }
    otherDepots.style.display = 'block';
    otherDepots.classList.add('result-table-enter');
    setTimeout(() => otherDepots.classList.remove('result-table-enter'), 500);
  } else {
    otherDepots.style.display = 'none';
  }

  initStockCalc(items);
  renderSearchActionPanel(items, query);
}

function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function exportOrderPlanCsv(plan) {
  if (!plan || !plan.length) {
    showToast('Disa aktarilacak plan yok');
    return;
  }

  const csvEscape = (val) => {
    const str = val == null ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headers = ['Urun', 'Barkod', 'Depo', 'Adet', 'Birim Fiyat (TL)', 'Toplam (TL)', 'MF', 'Planlama'];
  const rows = plan.map(item => [
    item.name || '',
    item.barcode || '',
    item.depot || '',
    item.desiredQty || 1,
    item.effectiveUnit > 0 ? item.effectiveUnit.toFixed(2) : '',
    item.totalCost > 0 ? item.totalCost.toFixed(2) : '',
    item.mfStr || '',
    item.planningMode === 'mf' ? 'MF' : 'Normal',
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\r\n');

  const bom = '\uFEFF'; // Excel UTF-8 BOM
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siparis-plani-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Plan CSV olarak indirildi');
}

function getSearchIdentity(items, query) {
  const normalizedItems = dedupeSearchItems(items || [], query);
  const firstItem = normalizedItems?.[0] || items?.[0] || {};
  const barcodeHints = getBarcodeHints(normalizedItems, query);
  const identityKeys = Array.from(new Set(normalizedItems.map(item => getItemIdentityKey(item, barcodeHints, query))));
  const barcode = isBarcodeQuery(query)
    ? query
    : (identityKeys.length === 1 ? resolveItemBarcode(firstItem, barcodeHints, query) : '');
  const name = identityKeys.length === 1
    ? chooseCanonicalProductName(normalizedItems, firstItem.ad || query)
    : (query || firstItem.ad || '');
  return {
    name,
    barcode,
    query: barcode || query || name || '',
    key: barcode || slugifyName(name || query || 'urun'),
  };
}

function refreshOrderPlanViews() {
  renderHomeOrderPlan();
  if (currentPage === 'order-plan') {
    renderOrderPlanDetail();
  }
}

function addPlannerOptionToOrderPlan(option, desiredQty, { toastLabel = '' } = {}) {
  if (!option) return false;

  const hasDedicatedSourceItem = !!option.sourceItem;
  const sourceItem = hasDedicatedSourceItem
    ? option.sourceItem
    : (resolveSelectedOfferItem(currentDetailItems) || currentDetailItems[0] || null);
  const sourceItems = hasDedicatedSourceItem
    ? [sourceItem].filter(Boolean)
    : (currentDetailItems.length ? currentDetailItems : ([sourceItem].filter(Boolean)));
  const sourceQuery = hasDedicatedSourceItem
    ? (sourceItem?.barcode || sourceItem?.barkod || sourceItem?.ad || '')
    : (currentDetailQuery || sourceItem?.barcode || sourceItem?.barkod || sourceItem?.ad || '');
  const identity = getSearchIdentity(sourceItems, sourceQuery);
  const barcode = String(identity.barcode || getItemBarcode(sourceItem, sourceQuery) || '').trim();
  const requestedQty = Math.max(parseInt(desiredQty, 10) || 1, 1);

  if (!isBarcodeQuery(barcode)) {
    showToast('Plana eklemek icin gecerli barkod gerekli');
    return false;
  }

  const normalizedOption = {
    ...option,
    orderQty: Math.max(parseInt(option.orderQty, 10) || 0, 0),
    receiveQty: Math.max(parseInt(option.receiveQty, 10) || 0, 0),
    totalCost: Number(option.totalCost) || 0,
    effectiveUnit: Number(option.effectiveUnit) || 0,
    unitPrice: Number(option.unitPrice) || 0,
  };
  const effectiveUnit = normalizedOption.effectiveUnit
    || normalizedOption.unitPrice
    || (normalizedOption.orderQty > 0 ? normalizedOption.totalCost / normalizedOption.orderQty : 0);
  const totalCost = normalizedOption.totalCost > 0 && normalizedOption.orderQty === requestedQty
    ? Number(normalizedOption.totalCost)
    : (effectiveUnit > 0 ? effectiveUnit * requestedQty : (Number(normalizedOption.totalCost) || 0));

  const nextEntry = normalizeOrderPlanItem({
    key: barcode,
    barcode,
    query: barcode,
    name: identity.name || normalizedOption.ad || sourceItem?.ad || 'Urun',
    depot: normalizedOption.depot || sourceItem?.depot || '',
    depotId: normalizedOption.depotId || sourceItem?.depotId || '',
    depotUrl: normalizedOption.depotUrl || sourceItem?.depotUrl || '',
    desiredQty: requestedQty,
    orderQty: requestedQty,
    receiveQty: requestedQty,
    totalCost,
    effectiveUnit,
    unitPrice: normalizedOption.unitPrice || effectiveUnit || 0,
    mfStr: normalizedOption.mfStr || '',
    planningMode: normalizedOption.mf ? 'mf' : (normalizedOption.planningMode || 'unit'),
    addedAt: new Date().toISOString(),
  });

  if (!nextEntry) {
    showToast('Plan kaydi olusturulamadi');
    return false;
  }

  const plan = getOrderPlan().filter((item) => !(item.key === nextEntry.key && item.depot === nextEntry.depot));
  plan.unshift(nextEntry);
  saveOrderPlan(plan);
  refreshOrderPlanViews();
  showToast(toastLabel || `${nextEntry.name} siparis planina eklendi`);
  return true;
}

function getOfferSelectionKey(item) {
  if (!item) return '';
  return [
    item.depotId || '',
    item.depot || '',
    item.depotUrl || '',
    item.ad || '',
    item.fiyat || '',
  ].join('|');
}

function resolveSelectedOfferItem(items) {
  if (!items || !items.length) return null;
  return items.find((item) => getOfferSelectionKey(item) === currentSelectedOfferKey)
    || items.find((item) => item.fiyatNum > 0)
    || items[0]
    || null;
}

function setSelectedOffer(item, items = currentDetailItems) {
  const selectedItem = item || resolveSelectedOfferItem(items);
  currentSelectedOfferKey = selectedItem ? getOfferSelectionKey(selectedItem) : '';
}

function removeOrderPlanItem(key, depot = '') {
  const next = getOrderPlan().filter((item) => !(item.key === key && item.depot === depot));
  saveOrderPlan(next);
  refreshOrderPlanViews();
}

function updateOrderPlanItemQuantity(key, depot = '', desiredQty = 1) {
  const safeQty = Math.max(parseInt(desiredQty, 10) || 1, 1);
  const next = getOrderPlan().map((item) => {
    if (!(item.key === key && item.depot === depot)) return item;
    const effectiveUnit = Number(item.effectiveUnit) || Number(item.unitPrice) || 0;
    return normalizeOrderPlanItem({
      ...item,
      desiredQty: safeQty,
      orderQty: safeQty,
      receiveQty: safeQty,
      totalCost: effectiveUnit > 0 ? effectiveUnit * safeQty : Number(item.totalCost) || 0,
    });
  }).filter(Boolean);
  saveOrderPlan(next);
  refreshOrderPlanViews();
}

function getPlannerOption(items, qty, { useMf = false } = {}) {
  const safeQty = Math.max(parseInt(qty, 10) || 1, 1);
  const options = useMf ? calcMfOptions(items, safeQty) : buildUnitOptions(items, safeQty);
  if (options.length > 0) {
    return { qty: safeQty, option: options[0] };
  }
  return null;
}

function getDesiredPlanQty() {
  const actionInput = document.getElementById('searchActionQtyInput');
  const inputQty = parseInt(actionInput?.value, 10);
  if (Number.isInteger(inputQty) && inputQty > 0) {
    return inputQty;
  }
  return Math.max(parseInt(_scActiveQty, 10) || 1, 1);
}

function shouldUseMfForQty(qty) {
  return Number.isInteger(qty) && qty > 1;
}

function syncSearchActionQtyInputs(desiredQty = getDesiredPlanQty()) {
  const actionInput = document.getElementById('searchActionQtyInput');
  const stockInput = document.getElementById('stockQtyInput');
  const stockValue = shouldUseMfForQty(_scActiveQty) ? String(_scActiveQty) : '';

  if (actionInput && actionInput.value !== String(desiredQty)) {
    actionInput.value = String(desiredQty);
  }
  if (stockInput && stockInput.value !== stockValue) {
    stockInput.value = stockValue;
  }
}

function updateSearchActionQtyUi() {
  const addBtnSub = document.getElementById('addToPlanBtnSub');
  if (!addBtnSub) return;
  const selectedItem = resolveSelectedOfferItem(currentDetailItems);
  const depotText = selectedItem?.depot ? ` ${selectedItem.depot} deposundan` : '';
  addBtnSub.textContent = `${getDesiredPlanQty()} adet${depotText} aktif plana eklenir`;
}

function setSearchActionQty(nextQty) {
  const parsedQty = Math.max(parseInt(nextQty, 10) || 1, 1);
  _scActiveQty = shouldUseMfForQty(parsedQty) ? parsedQty : null;
  syncSearchActionQtyInputs(parsedQty);

  if (_scItems.length && shouldUseMfForQty(parsedQty)) {
    renderStockCalc(_scItems, parsedQty);
  } else {
    const calcResults = document.getElementById('stockCalcResults');
    if (calcResults) calcResults.innerHTML = '';
  }

  document.querySelectorAll('.mf-chip').forEach((chip) => {
    const chipQty = parseInt(chip.textContent, 10);
    chip.classList.toggle('active', shouldUseMfForQty(parsedQty) && chipQty === parsedQty);
  });

  updateBestOfferCard(_scItems.length ? _scItems : currentDetailItems);
  updateSearchActionMeta();
  updateSearchActionQtyUi();
}

function renderSearchActionPanel(items, query) {
  const panel = document.getElementById('searchActionPanel');
  if (!panel) return;
  panel.style.display = items && items.length ? 'flex' : 'none';
  syncSearchActionQtyInputs(getDesiredPlanQty());
  updateSearchActionQtyUi();
  updateSearchActionMeta();
}

function getActiveBestSelection(items) {
  if (!items || !items.length) return null;

  const desiredQty = getDesiredPlanQty();
  const hasExplicitQty = shouldUseMfForQty(desiredQty);
  const planned = getPlannerOption(items, desiredQty, { useMf: hasExplicitQty });
  if (!planned || !planned.option) return null;

  const option = planned.option;
  const baseItem = items.find((item) => item.depot === option.depot) || items[0];
  return {
    qty: planned.qty,
    hasExplicitQty,
    option,
    item: {
      ...baseItem,
      depot: option.depot,
      depotId: option.depotId || baseItem?.depotId || '',
      depotUrl: option.depotUrl || baseItem?.depotUrl || '',
      fiyatNum: option.effectiveUnit || baseItem?.fiyatNum || 0,
      fiyat: (option.effectiveUnit || 0).toFixed(2).replace('.', ','),
      malFazlasi: option.mfStr || baseItem?.malFazlasi || '',
      stokVar: baseItem?.stokVar,
      stok: baseItem?.stok,
      stokGosterilsin: baseItem?.stokGosterilsin,
    },
  };
}

function updateBestPlanMenu(selection) {
  const menu = document.getElementById('bestPlanMenu');
  const meta = document.getElementById('bestPlanMeta');
  const addBtn = document.getElementById('bestPlanAddBtn');
  const depotBtn = document.getElementById('bestPlanDepotBtn');
  if (!menu || !meta || !addBtn || !depotBtn) return;

  if (!selection || !selection.hasExplicitQty) {
    menu.style.display = 'none';
    depotBtn.style.display = 'none';
    return;
  }

  const { option, qty } = selection;
  const modeText = option.mfStr
    ? `${option.mfStr} kampanyasi ile ${option.orderQty} alinir, ${option.receiveQty} birim gelir.`
    : `${qty} birim icin kampanyasiz plan hazirlandi.`;
  meta.textContent = `${option.depot} secildi. ${modeText} Toplam odeme ${formatCurrency(option.totalCost)}.`;

  menu.style.display = 'flex';
  depotBtn.style.display = option.depotUrl ? 'inline-flex' : 'none';
  depotBtn.onclick = () => {
    if (option.depotUrl) copyAndOpenDepot(option.depotUrl, option.depotId || '');
  };
  addBtn.onclick = () => addCurrentToOrderPlan();
}

function updateBestOfferCard(items) {
  const selection = getActiveBestSelection(items);
  if (!selection) return;

  const bestItem = selection.item;
  document.getElementById('bestDepotName').textContent = bestItem.depot;
  document.getElementById('bestPrice').textContent = formatCurrency(bestItem.fiyatNum || 0);

  const stockText = bestItem.stokVar
    ? (bestItem.stok > 0 && bestItem.stokGosterilsin ? bestItem.stok + ' Adet' : 'Stokta var')
    : 'Stok yok';
  const bestStockEl = document.getElementById('bestStock');
  bestStockEl.textContent = stockText;
  bestStockEl.style.color = bestItem.stokVar ? 'var(--status-green)' : 'var(--status-red)';

  const bestMfGroup = document.getElementById('bestMfGroup');
  const bestMf = document.getElementById('bestMf');
  if (bestItem.malFazlasi) {
    bestMf.textContent = bestItem.malFazlasi;
    bestMfGroup.style.display = 'block';
  } else {
    bestMfGroup.style.display = 'none';
  }

  const bestLinkEl = document.getElementById('bestDepotLink');
  if (bestItem.depotUrl) {
    bestLinkEl.dataset.url = bestItem.depotUrl;
    bestLinkEl.dataset.depotId = bestItem.depotId || '';
    bestLinkEl.style.display = 'inline-flex';
    bestLinkEl.onclick = () => copyAndOpenDepot(bestItem.depotUrl, bestItem.depotId || '');
  } else {
    bestLinkEl.style.display = 'none';
  }

  updateBestPlanMenu(selection);
}

function updateSearchActionMeta() {
  const productEl = document.getElementById('searchActionProduct');
  if (!productEl || !currentDetailItems.length) return;
  const identity = getSearchIdentity(currentDetailItems, currentDetailQuery);
  const selectedItem = resolveSelectedOfferItem(currentDetailItems);
  const depotSuffix = selectedItem?.depot ? ` (${selectedItem.depot})` : '';
  productEl.textContent = (identity.name || 'Secili urun') + depotSuffix;
}

function compareDepotItems(a, b) {
  const aPrice = Number(a?.fiyatNum) || Number.MAX_SAFE_INTEGER;
  const bPrice = Number(b?.fiyatNum) || Number.MAX_SAFE_INTEGER;
  if (Math.abs(aPrice - bPrice) > 0.0001) return aPrice - bPrice;

  const aDepot = String(a?.depot || a?.depotId || '');
  const bDepot = String(b?.depot || b?.depotId || '');
  const depotCompare = aDepot.localeCompare(bDepot, 'tr');
  if (depotCompare !== 0) return depotCompare;

  const aName = String(a?.ad || '');
  const bName = String(b?.ad || '');
  return aName.localeCompare(bName, 'tr');
}

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

// ───────────────────────────────────────────────────
// STOCK CALCULATOR
// ───────────────────────────────────────────────────
let _scItems = [];
let _scActiveQty = null;
let _scQuoteVersion = 0;
const _scQuoteCache = new Map();

function buildUnitOptions(items, targetQty = 1) {
  const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
  const allOptions = items
    .filter(i => i.fiyatNum > 0)
    .map(item => ({
      depot: item.depot,
      depotId: item.depotId,
      depotUrl: item.depotUrl,
      mf: null,
      mfStr: '',
      orderQty: safeQty,
      receiveQty: safeQty,
      totalCost: safeQty * item.fiyatNum,
      effectiveUnit: item.fiyatNum,
      unitPrice: item.fiyatNum,
      availableMfStr: item.malFazlasi || '',
      ad: item.ad,
      sourceItem: item,
      pricingMode: 'unit',
    }));

  const bestPerDepot = new Map();
  allOptions.forEach(opt => {
    const key = opt.depot;
    if (!bestPerDepot.has(key) || opt.effectiveUnit < bestPerDepot.get(key).effectiveUnit) {
      bestPerDepot.set(key, opt);
    }
  });

  return Array.from(bestPerDepot.values()).sort(comparePlannerOptions);
}

function calcMfOptions(items, targetQty) {
  const allOptions = items
    .filter(i => i.fiyatNum > 0)
    .map(item => {
      const mf = parseMf(item.malFazlasi);
      const unitPrice = item.fiyatNum;

      if (!mf) {
        return {
          depot: item.depot,
          depotId: item.depotId,
          depotUrl: item.depotUrl,
          mf: null,
          mfStr: '',
          orderQty: targetQty,
          receiveQty: targetQty,
        totalCost: targetQty * unitPrice,
        effectiveUnit: unitPrice,
        unitPrice,
        availableMfStr: item.malFazlasi || '',
        ad: item.ad,
        sourceItem: item,
      };
      }

      // Hedef miktar bir MF batchi dolduramiyorsa (orn: 3 adet icin MF 19+1)
      // MF zorla uygulanmaz - unit fiyatiyla hesaplanir, MF 'mevcut' olarak gosterilir.
      if (targetQty < mf.total) {
        return {
          depot: item.depot,
          depotId: item.depotId,
          depotUrl: item.depotUrl,
          mf: null,
          mfStr: '',
          orderQty: targetQty,
          receiveQty: targetQty,
          totalCost: targetQty * unitPrice,
          effectiveUnit: unitPrice,
          unitPrice,
          availableMfStr: item.malFazlasi || '',
          ad: item.ad,
          sourceItem: item,
        };
      }

      const batches = Math.ceil(targetQty / mf.total);
      const orderQty = batches * mf.buy;
      const receiveQty = batches * mf.total;

      return {
        depot: item.depot,
        depotId: item.depotId,
        depotUrl: item.depotUrl,
        mf,
        mfStr: item.malFazlasi,
        orderQty,
        receiveQty,
        totalCost: orderQty * unitPrice,
        effectiveUnit: (orderQty * unitPrice) / receiveQty,
        unitPrice,
        availableMfStr: item.malFazlasi || '',
        ad: item.ad,
        sourceItem: item,
      };
    });

  const bestPerDepot = new Map();
  allOptions.forEach(opt => {
    const key = opt.depot;
    if (!bestPerDepot.has(key) || opt.effectiveUnit < bestPerDepot.get(key).effectiveUnit) {
      bestPerDepot.set(key, opt);
    }
  });

  return Array.from(bestPerDepot.values()).sort(comparePlannerOptions);
}

function getFallbackPlannerOptions(items, targetQty) {
  const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
  return shouldUseMfForQty(safeQty)
    ? calcMfOptions(items, safeQty)
    : buildUnitOptions(items, safeQty);
}

function getPlannerOptionDetailText(option, requestedQty) {
  const safeQty = Math.max(parseInt(requestedQty, 10) || 1, 1);
  const availableMf = option.availableMfStr || option.mfStr || '';
  const hasAppliedMf = safeQty > 1 && option.mfStr && (option.receiveQty > option.orderQty || !!option.mf);

  if (hasAppliedMf) {
    return `MF ${option.mfStr} · ${option.orderQty} al ${option.receiveQty} gel`;
  }
  if (availableMf) {
    return `MF ${availableMf}`;
  }
  return `${option.orderQty} adet`;
}

function getBulkOfferDetailText(option, requestedQty) {
  const safeQty = Math.max(parseInt(requestedQty, 10) || 1, 1);
  const availableMf = option.availableMfStr || option.mfStr || '';
  if (!shouldUseMfForQty(safeQty)) {
    return availableMf ? `MF ${availableMf}` : `${safeQty} adet`;
  }
  if (availableMf) {
    return `Hedef ${safeQty} adet · MF ${availableMf}`;
  }
  return `Hedef ${safeQty} adet`;
}

function buildQuoteCacheKey(item, option, targetQty) {
  return [
    item?.depotId || '',
    item?.kodu || item?.barcode || item?.ad || '',
    option?.mfStr || '',
    option?.orderQty || '',
    option?.receiveQty || '',
    targetQty || '',
  ].join('::');
}

async function fetchQuotedOption(item, option, targetQty) {
  if (!item?.depotId) return option;

  const cacheKey = buildQuoteCacheKey(item, option, targetQty);
  if (_scQuoteCache.has(cacheKey)) {
    return _scQuoteCache.get(cacheKey);
  }

  try {
    const res = await authFetch(API_BASE + '/api/quote-option', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depotId: item.depotId,
        item,
        option,
        targetQty,
      }),
    });
    const data = await res.json();
    if (data?.success && data.quote) {
      const quoted = {
        ...option,
        ...data.quote,
        sourceItem: item,
      };
      _scQuoteCache.set(cacheKey, quoted);
      return quoted;
    }
  } catch {}

  return option;
}

// Max 2 quote istegi esanli gider - backend ve agi yormuyor
const QUOTE_CONCURRENCY_LIMIT = 2;

// NOT: Global _activeQuoteId kaldirildi - paralel bulk kart cagrilari birbirini
// iptal ediyordu. Her caller kendi version tracking'ini kullaniyor:
// renderStockCalc -> _scQuoteVersion, refreshQuotes -> state.quoteVersion
async function resolveQuotedOptions(items, targetQty) {
  const baseOptions = calcMfOptions(items, targetQty);
  if (!baseOptions.length) return [];

  // Her option icin factory fonksiyon olustur (lazy evaluation)
  const tasks = baseOptions.map((option) => () => fetchQuotedOption(option.sourceItem, option, targetQty));

  // Max QUOTE_CONCURRENCY_LIMIT kadar paralel, sirasyla calistir
  const quoted = await runConcurrent(tasks, QUOTE_CONCURRENCY_LIMIT);

  return quoted.sort(comparePlannerOptions);
}

async function resolvePlannerOptions(items, targetQty) {
  const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
  if (!shouldUseMfForQty(safeQty)) {
    return buildUnitOptions(items, safeQty);
  }
  return resolveQuotedOptions(items, safeQty);
}
function buildMfChips(items) {
  const chipsContainer = document.getElementById('stockMfChips');
  chipsContainer.innerHTML = '';
  const seen = new Set();
  const suggestions = [];

  items.forEach(item => {
    const mf = parseMf(item.malFazlasi);
    if (!mf) return;
    for (let mult = 1; mult <= 5; mult++) {
      const qty = mf.total * mult;
      if (qty > 0 && qty <= 500 && !seen.has(qty)) {
        seen.add(qty);
        suggestions.push({ qty, buy: mf.buy * mult, mf, depot: item.depot });
      }
    }
  });

  suggestions.sort((a, b) => a.qty - b.qty);
  const topSuggestions = suggestions.slice(0, 10);

  if (topSuggestions.length === 0) return;

  let bestQty = null;
  let bestEff = Infinity;
  topSuggestions.forEach(s => {
    const opts = calcMfOptions(items, s.qty);
    if (opts.length > 0 && opts[0].effectiveUnit < bestEff) {
      bestEff = opts[0].effectiveUnit;
      bestQty = s.qty;
    }
  });

  topSuggestions.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'mf-chip';
    const isBest = s.qty === bestQty;
    let label = `${s.qty}`;
    let sub = `<span class="mf-chip-label">${s.buy} al -> ${s.qty}</span>`;
    if (isBest) sub += ` <span class="mf-chip-best">en uygun</span>`;
    chip.innerHTML = label + ' ' + sub;
    chip.addEventListener('click', () => {
      document.getElementById('stockQtyInput').value = s.qty;
      document.querySelectorAll('.mf-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      setSearchActionQty(s.qty);
    });
    chipsContainer.appendChild(chip);
  });
}

function renderStockCalcOptions(container, options, qty) {
  if (!container) return;
  if (!options.length) {
    container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-3); font-size:13px;">Fiyat verisi bulunamadi.</div>';
    return;
  }

  const bestEff = options[0].effectiveUnit;
  container.innerHTML = options.map((opt, idx) => {
    const isBest = idx === 0;
    const saving = opt.effectiveUnit > bestEff
      ? ((1 - bestEff / opt.effectiveUnit) * 100).toFixed(1)
      : 0;

    const mfDetail = opt.mf
      ? `MF <strong>${opt.mfStr}</strong> - ${opt.orderQty} al -> ${opt.receiveQty} gel`
      : `Kampanyasiz - ${opt.orderQty} adet`;

    const liveBadge = opt.pricingMode === 'live'
      ? '<div class="sc-live-badge">Canli fiyat</div>'
      : '';

    return `
      <div class="sc-row sc-row-clickable ${isBest ? 'sc-best' : ''}" data-sc-option-index="${idx}" tabindex="0" role="button">
        <div class="sc-rank">${idx + 1}</div>
        <div class="sc-depot">
          <div class="sc-depot-name sc-depot-link" data-depot-url="${esc(opt.depotUrl || '')}" data-depot-id="${esc(opt.depotId || '')}" title="Depoya git">${esc(opt.depot)}</div>
          <div class="sc-depot-detail">${mfDetail}</div>
        </div>
        <div class="sc-prices">
          ${isBest ? '<div class="sc-best-badge">EN UYGUN</div>' : ''}
          ${liveBadge}
          <div class="sc-unit-price">TL ${opt.effectiveUnit.toFixed(2).replace('.', ',')}</div>
          <div class="sc-total-price">Toplam: TL ${opt.totalCost.toFixed(2).replace('.', ',')}</div>
          ${!isBest && saving > 0 ? `<div class="sc-saving">1. sira %${saving} daha ucuz</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-sc-option-index]').forEach((row) => {
    const option = options[parseInt(row.dataset.scOptionIndex, 10)];
    const addRowOption = async () => {
      if (!option) return;
      const quotedOption = await fetchQuotedOption(option.sourceItem, option, qty);
      addPlannerOptionToOrderPlan(quotedOption || option, qty, { toastLabel: `${option.depot} siparis planina eklendi` });
    };
    row.addEventListener('click', addRowOption);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        addRowOption();
      }
    });
  });

  container.querySelectorAll('.sc-depot-link').forEach((nameEl) => {
    if (!nameEl.dataset.depotUrl) return;
    nameEl.addEventListener('click', (e) => {
      e.stopPropagation();
      copyAndOpenDepot(nameEl.dataset.depotUrl, nameEl.dataset.depotId);
    });
  });
}

async function renderStockCalc(items, qty) {
  const container = document.getElementById('stockCalcResults');
  if (!qty || qty <= 0) {
    container.innerHTML = '';
    return;
  }

  const requestVersion = ++_scQuoteVersion;
  const fallbackOptions = calcMfOptions(items, qty);
  renderStockCalcOptions(container, fallbackOptions, qty);

  resolveQuotedOptions(items, qty)
    .then((quotedOptions) => {
      if (requestVersion !== _scQuoteVersion) return;
      if (!quotedOptions.length) return;

      const hasLiveChanges = quotedOptions.some((opt, idx) => {
        const base = fallbackOptions[idx];
        if (!base) return true;
        return Math.abs((opt.totalCost || 0) - (base.totalCost || 0)) > 0.01
          || Math.abs((opt.effectiveUnit || 0) - (base.effectiveUnit || 0)) > 0.01
          || (opt.pricingMode || '') !== (base.pricingMode || '');
      });

      if (hasLiveChanges) {
        renderStockCalcOptions(container, quotedOptions, qty);
      }
    })
    .catch(() => {});
}

function initStockCalc(items) {
  _scItems = items;
  _scActiveQty = null;
  _scQuoteCache.clear();

  const trigger = document.getElementById('stockCalcTrigger');
  const panel = document.getElementById('stockCalcPanel');
  const input = document.getElementById('stockQtyInput');
  const results = document.getElementById('stockCalcResults');

  const hasMf = items.some(i => parseMf(i.malFazlasi));
  trigger.style.display = hasMf ? 'inline-flex' : 'none';
  trigger.classList.remove('open');
  panel.classList.remove('open');

  input.value = '';
  results.innerHTML = '';
  buildMfChips(items);
  syncSearchActionQtyInputs(1);
  updateSearchActionQtyUi();
  updateBestOfferCard(items);
  updateSearchActionMeta();
}

function toggleStockCalc() {
  const trigger = document.getElementById('stockCalcTrigger');
  const panel = document.getElementById('stockCalcPanel');
  const isOpen = panel.classList.contains('open');

  if (isOpen) {
    panel.classList.remove('open');
    trigger.classList.remove('open');
  } else {
    panel.classList.add('open');
    trigger.classList.add('open');
    setTimeout(() => document.getElementById('stockQtyInput').focus(), 350);
  }
}

(function setupStockCalcEvents() {
  const input = document.getElementById('stockQtyInput');
  const minus = document.getElementById('stockMinus');
  const plus = document.getElementById('stockPlus');
  const trigger = document.getElementById('stockCalcTrigger');
  const closeBtn = document.getElementById('stockCalcClose');
  let debounce = null;

  function triggerCalc() {
    const val = parseInt(input.value, 10);
    if (val > 0) {
      setSearchActionQty(val);
    } else {
      _scActiveQty = null;
      document.getElementById('stockCalcResults').innerHTML = '';
      document.querySelectorAll('.mf-chip').forEach(c => c.classList.remove('active'));
      syncSearchActionQtyInputs();
      updateSearchActionQtyUi();
    }
  }

  trigger.addEventListener('click', toggleStockCalc);
  closeBtn.addEventListener('click', toggleStockCalc);

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(triggerCalc, 250);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounce);
      triggerCalc();
    }
  });

  minus.addEventListener('click', () => {
    let val = parseInt(input.value, 10) || 0;
    if (val > 1) { input.value = val - 1; triggerCalc(); }
  });

  plus.addEventListener('click', () => {
    let val = parseInt(input.value, 10) || 0;
    input.value = val + 1;
    triggerCalc();
  });
})();

(function setupSearchActionQtyEvents() {
  const input = document.getElementById('searchActionQtyInput');
  const minus = document.getElementById('searchActionQtyMinus');
  const plus = document.getElementById('searchActionQtyPlus');
  if (!input || !minus || !plus) return;

  let debounce = null;

  function applyQty(nextQty) {
    clearTimeout(debounce);
    setSearchActionQty(nextQty);
  }

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => applyQty(input.value), 200);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyQty(input.value);
    }
  });

  minus.addEventListener('click', () => {
    const nextQty = Math.max((parseInt(input.value, 10) || 1) - 1, 1);
    applyQty(nextQty);
  });

  plus.addEventListener('click', () => {
    const nextQty = Math.max(parseInt(input.value, 10) || 1, 1) + 1;
    applyQty(nextQty);
  });
})();

// ──── Depoya Git — open in depot panel ────
function buildChromeDepotTarget(depotId, rawQuery, fallbackUrl) {
  const query = String(rawQuery || '').trim();
  const cleanBarcode = parseQRCode(query);
  const normalizedQuery = cleanBarcode && cleanBarcode.length === 13 ? cleanBarcode : query;

  if (depotId === 'anadolu-pharma' && normalizedQuery) {
    return {
      url: `https://b2b.anadolupharma.com/UrunAra/1?search=${encodeURIComponent(normalizedQuery)}`,
      copyText: normalizedQuery,
    };
  }

  if (depotId === 'anadolu-itriyat' && normalizedQuery) {
    return {
      url: `https://b4b.anadoluitriyat.com/Search?text=${encodeURIComponent(normalizedQuery)}`,
      copyText: normalizedQuery,
    };
  }

  if (depotId === 'selcuk' && normalizedQuery) {
    return {
      url: `https://webdepo.selcukecza.com.tr/Siparis/hizlisiparis.aspx?ilcAdi=${encodeURIComponent(normalizedQuery)}`,
      copyText: normalizedQuery,
    };
  }

  if (depotId === 'nevzat' && normalizedQuery) {
    return {
      url: `http://webdepo.nevzatecza.com.tr/Siparis/hizlisiparis.aspx?ilcAdi=${encodeURIComponent(normalizedQuery)}`,
      copyText: normalizedQuery,
    };
  }

  if (depotId === 'sentez' && normalizedQuery) {
    return {
      url: `https://www.sentezb2b.com/tr-TR/Site/Liste?tip=Arama&arama=${encodeURIComponent(normalizedQuery)}&s=a`,
      copyText: normalizedQuery,
    };
  }

  return {
    url: depotId === 'alliance'
      ? 'https://esiparisv2.alliance-healthcare.com.tr/Sales/QuickOrder'
      : fallbackUrl,
    copyText: normalizedQuery,
  };
}

function copyAndOpenDepot(url, depotId) {
  const rawQuery = selectedBarcode
    || document.getElementById('searchInput').value.trim()
    || '';
  const target = buildChromeDepotTarget(depotId, rawQuery, url);
  const textToCopy = target.copyText || '';

  if (textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('"' + textToCopy + '" kopyalandı');
    }).catch(() => {});
  }

  if (window.electronAPI?.openUrlInChrome) {
    window.electronAPI.openUrlInChrome(target.url).catch(() => {
      window.open(target.url, '_blank');
    });
  } else {
    window.open(target.url, '_blank');
  }
}


function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ──── Autocomplete ────
function setupAutocomplete(inputId, suggestionsId, onSelect) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(suggestionsId);
  let debounceTimer = null;
  let abortController = null;
  let selectedIndex = -1;
  let loadingTimer = null;
  const suggestionCache = new Map();

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    selectedIndex = -1;
    selectedBarcode = null;
    const selDrug = document.getElementById('selectedDrug');
    if (selDrug) selDrug.style.display = 'none';

    if (q.length < 2) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      return;
    }

    if ((q.length === 8 || q.length >= 13) && /^\d+$/.test(q)) {
      dropdown.classList.remove('open');
      selectedBarcode = q;
      const selDrugName = document.getElementById('selectedDrugName');
      const selDrugCode = document.getElementById('selectedDrugCode');
      if (selDrugName && selDrugCode) {
        selDrugName.textContent = 'Barkod Taraması';
        selDrugCode.textContent = 'Barkod: ' + q;
        document.getElementById('selectedDrug').style.display = 'flex';
      }
      if (!document.getElementById('page-search').classList.contains('active')) {
        document.getElementById('searchInput').value = q;
        showPage('search');
      }
      doSearch();
      return;
    }

    debounceTimer = setTimeout(() => fetchSuggestions(q), 120);
  });

  async function fetchSuggestions(q) {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    clearTimeout(loadingTimer);

    const cached = suggestionCache.get(q);
    if (cached) {
      renderSuggestions(q, cached);
      return;
    }

    loadingTimer = setTimeout(() => {
      dropdown.innerHTML = '<div class="suggestion-loading">Aranıyor...</div>';
      dropdown.classList.add('open');
    }, 120);

    try {
      const res = await authFetch(API_BASE + '/api/autocomplete?q=' + encodeURIComponent(q), {
        signal: abortController.signal,
      });
      const data = await res.json();
      clearTimeout(loadingTimer);

      if (!data.suggestions || data.suggestions.length === 0) {
        dropdown.innerHTML = '<div class="suggestion-loading">Sonuç bulunamadı</div>';
        dropdown.classList.add('open');
        return;
      }

      suggestionCache.set(q, data);
      if (suggestionCache.size > 20) {
        const firstKey = suggestionCache.keys().next().value;
        suggestionCache.delete(firstKey);
      }
      renderSuggestions(q, data);
    } catch (err) {
      clearTimeout(loadingTimer);
      if (err.name !== 'AbortError') {
        dropdown.innerHTML = '<div class="suggestion-loading">Hata oluştu</div>';
        dropdown.classList.add('open');
      }
    }
  }

  function renderSuggestions(q, data) {
    dropdown.innerHTML = '';
    dropdown.classList.add('open');
    const items = (data.suggestions || []).slice(0, 10);
    const regex = new RegExp('(' + escRegex(q) + ')', 'gi');

    items.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      const highlighted = esc(item.ad).replace(regex, '<mark>$1</mark>');
      const barcode = item.barcode || extractBarcode(item.kodu);
      div.innerHTML = `
        <span class="suggestion-name">${highlighted}</span>
        <span class="suggestion-meta">
          ${barcode ? '<span class="suggestion-code">' + esc(barcode) + '</span>' : ''}
          <span class="suggestion-price">TL ${esc(item.fiyat)}</span>
        </span>
      `;
      div.addEventListener('click', () => {
        input.value = item.ad;
        dropdown.classList.remove('open');
        onSelect(item);
      });
      dropdown.appendChild(div);
    });

    if (data.source) {
      const srcDiv = document.createElement('div');
      srcDiv.style.cssText = 'padding: 4px 16px; font-size: 11px; color: #aaa; text-align: right; border-top: 1px solid #f0f0f0;';
      srcDiv.textContent = 'Kaynak: ' + data.source;
      dropdown.appendChild(srcDiv);
    }
  }

  input.addEventListener('keydown', e => {
    const items = dropdown.querySelectorAll('.suggestion-item');
    if (!items.length || !dropdown.classList.contains('open')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelected(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelected(items);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      selectedIndex = -1;
    }
  });

  function updateSelected(items) {
    items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
    if (items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('open');
      selectedIndex = -1;
    }
  });
}

function escRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function onDrugSelected(item) {
  const barcode = item.barcode || extractBarcode(item.kodu);
  if (barcode) {
    selectedBarcode = barcode;
    document.getElementById('selectedDrug').style.display = 'flex';
    document.getElementById('selectedDrugName').textContent = item.ad;
    document.getElementById('selectedDrugCode').textContent = 'Barkod: ' + barcode;
  } else {
    selectedBarcode = null;
    document.getElementById('selectedDrug').style.display = 'none';
  }
  if (!document.getElementById('page-search').classList.contains('active')) {
    document.getElementById('searchInput').value = item.ad;
    showPage('search');
  }
  doSearch();
}

setupAutocomplete('homeSearchInput', 'homeSuggestions', onDrugSelected);
setupAutocomplete('searchInput', 'searchSuggestions', onDrugSelected);

// ──── Depot status ────
const DEPOT_LIST = [
  { id: 'selcuk', name: 'Selçuk Ecza' },
  { id: 'nevzat', name: 'Nevzat Ecza' },
  { id: 'anadolu-pharma', name: 'Anadolu Pharma' },
  { id: 'anadolu-itriyat', name: 'Anadolu İtriyat' },
  { id: 'alliance', name: 'Alliance Healthcare' },
  { id: 'sentez', name: 'Sentez B2B' },
];

let cachedConfig = null;
let safeCreds = {};

async function loadDepotStatus() {
  try {
    const res = await authFetch(API_BASE + '/api/config');
    cachedConfig = await res.json();

    safeCreds = {};
    for (const [id, info] of Object.entries(cachedConfig.depots || {})) {
      safeCreds[id] = info.credentials || {};
    }

    const cards = document.getElementById('depotCards');
    cards.innerHTML = '';

    const navDepots = document.getElementById('navDepots');
    navDepots.innerHTML = '';

    for (const d of DEPOT_LIST) {
      const info = cachedConfig.depots[d.id];
      const connected = info && (info.hasCredentials || info.hasCookies || info.hasToken);

      const card = document.createElement('div');
      card.className = 'depot-card';
      card.innerHTML = `
        <div class="depot-dot ${connected ? 'connected' : 'disconnected'}"></div>
        <div>
          <div class="depot-card-name">${esc(d.name)}</div>
          <div class="depot-card-status">${connected ? 'Bağlı' : 'Bağlı değil'}</div>
        </div>
      `;
      cards.appendChild(card);

      const dot = document.createElement('div');
      dot.className = 'nav-depot-dot ' + (connected ? 'on' : 'off');
      dot.title = d.name + (connected ? ' (Bağlı)' : ' (Bağlı değil)');
      navDepots.appendChild(dot);
    }
    pushDiagnosticEvent('config', 'Depo durumları yenilendi', {
      connectedCount: DEPOT_LIST.filter((d) => {
        const info = cachedConfig.depots[d.id];
        return info && (info.hasCredentials || info.hasCookies || info.hasToken);
      }).length,
    });
  } catch (e) {
    console.error('Depot status load failed:', e);
    cachedConfig = { depots: {} };
    pushDiagnosticEvent('config-error', 'Depo durumları yüklenemedi', {
      message: e?.message || String(e),
    });
  }
}

// ──── App Init (auth guard) ──────────────────────────────────────────────────

async function initApp() {
  const authed = await requireAuthOrRedirect();
  if (!authed) return;
  setupElectronDiagnosticsBridge();

  // Profil adını kullanıcıdan al
  const currentUser = getUser();
  if (currentUser?.displayName) {
    const nameEl   = document.querySelector('.profile-name');
    const avatarEl = document.querySelector('.profile-avatar');
    if (nameEl)   nameEl.textContent   = currentUser.displayName;
    if (avatarEl) avatarEl.textContent = currentUser.displayName[0].toUpperCase();
  }

  await loadDepotStatus();
  applyHumanUiCopy();
  renderHomeDashboard();
}

initApp();

// ──── Settings ────
const DEPOT_FORMS = {
  selcuk: {
    name: 'Selçuk Ecza Deposu',
    fields: [
      { id: 'hesapKodu', label: 'Hesap Kodu', placeholder: 'ör: 1201800051' },
      { id: 'kullaniciAdi', label: 'Kullanıcı Adı', placeholder: 'ör: sel1510038608' },
      { id: 'sifre', label: 'Şifre', placeholder: 'Depot şifreniz', type: 'password' },
    ],
    hasCookieField: true,
  },
  nevzat: {
    name: 'Nevzat Ecza Deposu',
    fields: [
      { id: 'hesapKodu', label: 'Hesap Kodu', placeholder: 'Hesap kodunuz' },
      { id: 'kullaniciAdi', label: 'Kullanıcı Adı', placeholder: 'Kullanıcı adınız' },
      { id: 'sifre', label: 'Şifre', placeholder: 'Depot şifreniz', type: 'password' },
    ],
    hasCookieField: true,
  },
  'anadolu-pharma': {
    name: 'Anadolu Pharma',
    fields: [
      { id: 'kullaniciAdi', label: 'Kullanıcı Adı', placeholder: 'Kullanıcı adınız' },
      { id: 'sifre', label: 'Şifre', placeholder: 'Şifreniz', type: 'password' },
      { id: 'cariKod', label: 'Cari Kod', placeholder: 'ör: 120.3575' },
    ],
    hasCookieField: false,
    hasTokenField: true,
  },
  'anadolu-itriyat': {
    name: 'Anadolu İtriyat',
    fields: [
      { id: 'hesapKodu', label: 'Müşteri Kodu', placeholder: 'ör: 120.00912' },
      { id: 'kullaniciAdi', label: 'Kullanıcı Adı', placeholder: 'Kullanıcı adınız' },
      { id: 'sifre', label: 'Şifre', placeholder: 'Şifreniz', type: 'password' },
    ],
    hasCookieField: true,
  },
  alliance: {
    name: 'Alliance Healthcare (Cencora)',
    fields: [
      { id: 'hesapKodu', label: 'Link Kodu', placeholder: 'ör: 8594' },
      { id: 'kullaniciAdi', label: 'Kullanıcı Adı', placeholder: 'Kullanıcı adınız' },
      { id: 'sifre', label: 'Şifre', placeholder: 'Şifreniz', type: 'password' },
    ],
    hasCookieField: true,
  },
  sentez: {
    name: 'Sentez B2B',
    fields: [
      { id: 'kullaniciAdi', label: 'Kullanıcı Adı', placeholder: 'ör: 8680001219957' },
      { id: 'sifre', label: 'Şifre', placeholder: 'Şifreniz', type: 'password' },
    ],
    hasCookieField: true,
  },
};

function getUpdateStatusPresentation(payload, version) {
  const phase = payload?.phase || '';
  const map = {
    checking: ['active', 'Kontrol ediliyor...'],
    available: ['active', `Yeni sürüm: v${payload?.version || '?'} - indiriliyor`],
    downloading: ['active', `İndiriliyor... %${Math.round(payload?.percent || 0)}`],
    downloaded: ['ok', 'Güncelleme hazır - uygulama kapanınca kurulacak'],
    'up-to-date': ['ok', `Güncel (v${payload?.version || version || '-'})`],
    error: ['error', 'Güncelleme kontrolü başarısız'],
    'dev-mode': ['', 'Geliştirici modu - güncelleme devre dışı'],
    'already-checking': ['active', 'Zaten kontrol ediliyor...'],
    'already-downloaded': ['ok', 'Güncelleme zaten indirildi'],
  };
  return map[phase] || ['', payload?.phase || '-'];
}

function buildGeneralSettingsMarkup() {
  const user = getUser();
  const connectedCount = DEPOT_LIST.filter((d) => {
    const info = cachedConfig?.depots?.[d.id];
    return info && (info.hasCredentials || info.hasCookies || info.hasToken);
  }).length;

  return `
    <div class="settings-grid">
      <section class="settings-card settings-panel">
        <div class="settings-panel-header">
          <div>
            <h3>Genel</h3>
            <p>Uygulama durumu, güncelleme ve temel bakım işlemleri.</p>
          </div>
        </div>
        <div class="app-info-card">
          <div class="app-info-header">
            <span class="app-info-title">Uygulama</span>
            <span class="app-version" id="appVersionLabel">Sürüm yükleniyor...</span>
          </div>
          <div class="app-update-row">
            <span class="app-update-status" id="appUpdateStatus">-</span>
            <button class="btn-check-update" id="btnCheckUpdate" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Güncelleme Kontrol Et
            </button>
          </div>
        </div>
        <div class="settings-summary-grid">
          <div class="settings-summary-item">
            <span class="settings-summary-label">Profil</span>
            <strong>${esc(user?.displayName || 'Eczane')}</strong>
          </div>
          <div class="settings-summary-item">
            <span class="settings-summary-label">Bağlı Depo</span>
            <strong>${connectedCount}/${DEPOT_LIST.length}</strong>
          </div>
          <div class="settings-summary-item">
            <span class="settings-summary-label">Kapanış Davranışı</span>
            <strong>Tam çıkış</strong>
          </div>
        </div>
      </section>
      <section class="settings-card settings-panel">
        <div class="settings-panel-header">
          <div>
            <h3>Bakım Yardımcıları</h3>
            <p>Geliştirme sürecinde sık kullanılan güvenli araçlar.</p>
          </div>
        </div>
        <div class="settings-tools-list">
          <button class="btn btn-outline" id="refreshDepotStatusBtn" type="button">Depo Durumlarını Yenile</button>
          <button class="btn btn-outline" id="clearDiagnosticsBtn" type="button">Tanı Loglarını Temizle</button>
          <button class="btn btn-danger" id="quitAppFromSettingsBtn" type="button">Uygulamayı Kapat</button>
        </div>
      </section>
    </div>
  `;
}

function buildDepotSettingsMarkup() {
  let html = '<div class="settings-stack">';
  for (const [depotId, form] of Object.entries(DEPOT_FORMS)) {
    const depotInfo = cachedConfig?.depots?.[depotId];
    const isConfigured = depotInfo && (depotInfo.hasCredentials || depotInfo.hasCookies || depotInfo.hasToken);

    let fieldsHtml = '<div class="form-row">';
    form.fields.forEach((f) => {
      const savedVal = depotInfo ? (safeCreds[depotId]?.[f.id] || '') : '';
      fieldsHtml += `
        <div class="form-group">
          <label>${esc(f.label)}</label>
          <input type="${f.type || 'text'}" id="${depotId}-${f.id}" placeholder="${esc(f.placeholder)}" value="${esc(savedVal)}" />
        </div>
      `;
    });
    fieldsHtml += '</div>';

    let extraHtml = '';
    if (form.hasCookieField) {
      extraHtml += `
        <hr class="divider" />
        <div class="form-group">
          <label>Manuel Cookie (opsiyonel)</label>
          <textarea id="${depotId}-cookies" placeholder="Cookie string..."></textarea>
          <div class="hint">Chrome DevTools -> Application -> Cookies</div>
        </div>
      `;
    }
    if (form.hasTokenField) {
      extraHtml += `
        <hr class="divider" />
        <div class="form-group">
          <label>Manuel JWT Token (opsiyonel)</label>
          <textarea id="${depotId}-token" placeholder="eyJ..."></textarea>
          <div class="hint">Chrome DevTools -> Network -> Authorization header'dan kopyalayın</div>
        </div>
      `;
    }

    html += `
      <section class="settings-card settings-panel">
        <h3>
          ${esc(form.name)}
          <span class="badge ${isConfigured ? 'badge-ok' : 'badge-off'}">${isConfigured ? 'bağlı' : 'bağlı değil'}</span>
        </h3>
        ${fieldsHtml}
        <div class="btn-row">
          <button class="btn btn-primary" data-action="test-login" data-depot="${depotId}" type="button">Giriş Yap & Kaydet</button>
          <button class="btn btn-outline" data-action="save" data-depot="${depotId}" type="button">Sadece Kaydet</button>
          ${isConfigured ? '<button class="btn btn-danger" data-action="delete" data-depot="' + depotId + '" type="button">Sil</button>' : ''}
          <span id="${depotId}-status" class="action-status"></span>
        </div>
        ${extraHtml}
      </section>
    `;
  }
  html += '</div>';
  return html;
}

function buildDeveloperSettingsMarkup() {
  const lastSearch = lastSearchAttempt.query
    ? `${esc(lastSearchAttempt.query)}`
    : 'Henüz arama yapılmadı';
  const diagnostics = getDiagnosticsSnapshot();
  const diagnosticsHtml = diagnostics.length
    ? diagnostics.map((entry) => `
        <div class="diagnostic-item">
          <div class="diagnostic-item-top">
            <span class="diagnostic-type">${esc(entry.type)}</span>
            <span class="diagnostic-time">${new Date(entry.timestamp).toLocaleTimeString('tr-TR')}</span>
          </div>
          <div class="diagnostic-message">${esc(entry.message)}</div>
        </div>
      `).join('')
    : '<div class="diagnostic-empty">Henüz tanı kaydı oluşmadı.</div>';

  return `
    <div class="settings-grid">
      <section class="settings-card settings-panel">
        <div class="settings-panel-header">
          <div>
            <h3>Oturum ve Uygulama Sağlığı</h3>
            <p>Geliştirme sırasında hızlı kontrol için anlık durum özeti.</p>
          </div>
        </div>
        <div class="settings-summary-grid">
          <div class="settings-summary-item">
            <span class="settings-summary-label">Arama Durumu</span>
            <strong>${esc(searchUiState)}</strong>
          </div>
          <div class="settings-summary-item">
            <span class="settings-summary-label">Son Sorgu</span>
            <strong>${lastSearch}</strong>
          </div>
          <div class="settings-summary-item">
            <span class="settings-summary-label">Son Güncelleme Olayı</span>
            <strong>${esc(latestUpdatePayload?.phase || '-')}</strong>
          </div>
        </div>
      </section>
      <section class="settings-card settings-panel">
        <div class="settings-panel-header">
          <div>
            <h3>Tanı Kayıtları</h3>
            <p>Arama, auth, updater ve renderer hataları için son olay listesi.</p>
          </div>
        </div>
        <div class="diagnostics-list">${diagnosticsHtml}</div>
      </section>
    </div>
  `;
}

function bindSettingsTabActions() {
  document.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSettingsTab = btn.dataset.settingsTab;
      renderSettings();
    });
  });

  document.getElementById('btnCheckUpdate')?.addEventListener('click', triggerUpdateCheck);
  document.getElementById('refreshDepotStatusBtn')?.addEventListener('click', async () => {
    await loadDepotStatus();
    renderSettings();
  });
  document.getElementById('clearDiagnosticsBtn')?.addEventListener('click', () => {
    clearDiagnosticsBuffer();
    renderSettings();
  });
  const quitBtn = document.getElementById('quitAppFromSettingsBtn');
  if (quitBtn) {
    quitBtn.disabled = !window.electronAPI?.quitApp;
    quitBtn.addEventListener('click', () => {
      if (window.electronAPI?.quitApp) window.electronAPI.quitApp();
    });
  }

  document.querySelectorAll('[data-action="test-login"]').forEach((btn) => {
    btn.addEventListener('click', () => testDepotLogin(btn.dataset.depot));
  });
  document.querySelectorAll('[data-action="save"]').forEach((btn) => {
    btn.addEventListener('click', () => saveDepot(btn.dataset.depot));
  });
  document.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteDepot(btn.dataset.depot));
  });
}

function refreshSettingsGeneralStatus(version) {
  const versionLabel = document.getElementById('appVersionLabel');
  const updateStatus = document.getElementById('appUpdateStatus');
  const checkBtn = document.getElementById('btnCheckUpdate');
  if (versionLabel) versionLabel.innerHTML = `Sürüm: <strong>${esc(version)}</strong>`;

  if (!window.electronAPI?.checkForUpdates) {
    if (checkBtn) checkBtn.disabled = true;
    if (updateStatus) updateStatus.textContent = 'Güncelleme yalnızca Electron uygulamasında çalışır';
    return;
  }

  if (updateStatus) {
    const [cls, text] = getUpdateStatusPresentation(latestUpdatePayload, version);
    updateStatus.className = 'app-update-status';
    if (cls) updateStatus.classList.add(cls);
    updateStatus.textContent = text;
  }

  if (checkBtn) {
    const phase = latestUpdatePayload?.phase;
    checkBtn.disabled = phase === 'checking' || phase === 'downloading';
  }
}

function renderSettings() {
  const container = document.getElementById('settingsContainer');
  if (!container) return;

  const tabs = [
    { id: 'general', label: 'Genel' },
    { id: 'depots', label: 'Depolar' },
    { id: 'developer', label: 'Geliştirici' },
  ];

  let contentHtml = '';
  if (activeSettingsTab === 'depots') contentHtml = buildDepotSettingsMarkup();
  else if (activeSettingsTab === 'developer') contentHtml = buildDeveloperSettingsMarkup();
  else contentHtml = buildGeneralSettingsMarkup();

  container.innerHTML = `
    <div class="settings-tabs" role="tablist" aria-label="Ayarlar sekmeleri">
      ${tabs.map((tab) => `
        <button
          class="settings-tab ${activeSettingsTab === tab.id ? 'active' : ''}"
          data-settings-tab="${tab.id}"
          type="button"
          role="tab"
          aria-selected="${activeSettingsTab === tab.id ? 'true' : 'false'}">${tab.label}</button>
      `).join('')}
    </div>
    <div class="settings-tab-panel">${contentHtml}</div>
  `;

  bindSettingsTabActions();

  if (activeSettingsTab === 'general') {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((version) => {
        if (currentPage === 'settings' && activeSettingsTab === 'general') {
          refreshSettingsGeneralStatus(`v${version}`);
        }
      }).catch(() => {
        refreshSettingsGeneralStatus('Sürüm alınamadı');
      });
    } else {
      refreshSettingsGeneralStatus('Web modu');
    }
  }
}

async function triggerUpdateCheck() {
  const btn    = document.getElementById('btnCheckUpdate');
  const status = document.getElementById('appUpdateStatus');
  if (!window.electronAPI?.checkForUpdates) return;
  if (btn) btn.disabled = true;
  if (status) { status.className = 'app-update-status active'; status.textContent = 'Kontrol ediliyor...'; }
  pushDiagnosticEvent('updater', 'Manuel güncelleme kontrolü başlatıldı');
  const result = await window.electronAPI.checkForUpdates();
  // Sonuç event olarak da gelir (onUpdateStatus), ama anlık geri dönüş için de göster
  if (result?.status === 'dev-mode') {
    if (btn) btn.disabled = true;
    if (status) { status.className = 'app-update-status'; status.textContent = 'Geliştirici modu - güncelleme devre dışı'; }
  } else if (result?.status === 'already-downloaded') {
    if (btn) btn.disabled = false;
    if (status) { status.className = 'app-update-status ok'; status.textContent = 'Güncelleme zaten indirildi'; }
  }
}

async function testDepotLogin(depotId) {
  const statusEl = document.getElementById(depotId + '-status');
  statusEl.textContent = 'Giriş deneniyor...';
  statusEl.className = 'action-status';

  const form = DEPOT_FORMS[depotId];
  const credentials = {};
  form.fields.forEach(f => {
    credentials[f.id] = document.getElementById(depotId + '-' + f.id).value.trim();
  });

  try {
    const res = await authFetch(API_BASE + '/api/test-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depotId, credentials }),
    });
    const data = await res.json();

    if (data.success) {
      await loadDepotStatus();
      renderSettings();
      const newStatusEl = document.getElementById(depotId + '-status');
      if (newStatusEl) {
        newStatusEl.textContent = 'Giriş başarılı!';
        newStatusEl.className = 'action-status success';
        setTimeout(() => { newStatusEl.textContent = ''; newStatusEl.className = 'action-status'; }, 3000);
      }
    } else {
      statusEl.textContent = data.error || 'Giriş başarısız';
      statusEl.className = 'action-status fail';
    }
  } catch (err) {
    statusEl.textContent = 'Hata: ' + err.message;
    statusEl.className = 'action-status fail';
  }
}

async function saveDepot(depotId) {
  const statusEl = document.getElementById(depotId + '-status');
  const form = DEPOT_FORMS[depotId];
  const credentials = {};
  form.fields.forEach(f => {
    credentials[f.id] = document.getElementById(depotId + '-' + f.id).value.trim();
  });

  const body = { depotId, credentials };

  if (form.hasCookieField) {
    const cookieVal = document.getElementById(depotId + '-cookies')?.value.trim();
    if (cookieVal) body.cookies = cookieVal;
  }
  if (form.hasTokenField) {
    const tokenVal = document.getElementById(depotId + '-token')?.value.trim();
    if (tokenVal) body.token = tokenVal;
  }

  try {
    const res = await authFetch(API_BASE + '/api/config/depot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      await loadDepotStatus();
      renderSettings();
      const newStatusEl = document.getElementById(depotId + '-status');
      if (newStatusEl) {
        newStatusEl.textContent = 'Kaydedildi!';
        newStatusEl.className = 'action-status success';
        setTimeout(() => { newStatusEl.textContent = ''; newStatusEl.className = 'action-status'; }, 3000);
      }
    }
  } catch (err) {
    statusEl.textContent = 'Hata: ' + err.message;
    statusEl.className = 'action-status fail';
  }
}

async function deleteDepot(depotId) {
  try {
    await authFetch(API_BASE + '/api/config/depot/' + depotId, { method: 'DELETE' });
    await loadDepotStatus();
    renderSettings();
  } catch (e) {}
}

// ──── Eczaci workflow helpers ────
async function addCurrentToOrderPlan() {
  try {
    if (!currentDetailItems.length) {
      showToast('Plana eklemek icin once bir urun secin');
      return;
    }
    const desiredQty = getDesiredPlanQty();
    const selectedItem = resolveSelectedOfferItem(currentDetailItems);
    if (!selectedItem) {
      showToast('Secili depo bulunamadi');
      return;
    }
    const useMfPlanning = shouldUseMfForQty(desiredQty);
    const planned = getPlannerOption([selectedItem], desiredQty, { useMf: useMfPlanning });
    if (!planned || !planned.option) {
      showToast('Plan secenegi olusturulamadi');
      return;
    }

    const quotedOption = await fetchQuotedOption(selectedItem, planned.option, desiredQty);
    addPlannerOptionToOrderPlan(quotedOption || planned.option, planned.qty, {
      toastLabel: `${selectedItem.ad || 'Urun'} siparis planina eklendi`,
    });
  } catch (err) {
    console.error('addCurrentToOrderPlan failed:', err);
    showToast('Siparis planina eklenemedi');
  }
}

function clearOrderPlan() {
  saveOrderPlan([]);
  refreshOrderPlanViews();
}

function addCurrentToRoutineList() {
  if (!currentDetailItems.length) {
    showToast('Listeye eklemek icin once bir urun secin');
    return;
  }

  const identity = getSearchIdentity(currentDetailItems, currentDetailQuery);
  const list = getRoutineList();
  const exists = list.some(item => item.key === identity.key);
  if (exists) {
    showToast('Bu urun zaten sabit listede');
    return;
  }

  list.unshift({
    key: identity.key,
    name: identity.name,
    barcode: identity.barcode || '',
    query: identity.query,
    addedAt: new Date().toISOString(),
  });

  saveRoutineList(list.slice(0, 24));
  renderRoutineList();
  showToast(`${identity.name} sabit listeye eklendi`);
}

function removeRoutineItem(key) {
  const next = getRoutineList().filter(item => item.key !== key);
  saveRoutineList(next);
  renderRoutineList();
  if (currentPage === 'history') renderHistory();
}

function openSavedProduct(item) {
  const query = item?.barcode || item?.query || item?.name || '';
  if (!query) {
    showToast('Bu kayit icin arama bilgisi bulunamadi');
    return;
  }
  openHistorySearch(query, query);
}

function openOrderPlanDetail() {
  showPage('order-plan');
}

function getPlanDrawerEntry() {
  return getOrderPlan().find((item) => item.key === planEditorDrawerState.key && item.depot === planEditorDrawerState.depot) || null;
}

function getSelectedPlanDrawerOption() {
  return planEditorDrawerState.options.find((option) => getOfferSelectionKey(option.sourceItem) === planEditorDrawerState.selectedKey)
    || planEditorDrawerState.options[0]
    || null;
}

function applyPlanDrawerOptions(options, { preferExistingDepot = false } = {}) {
  planEditorDrawerState.options = options || [];
  if (!planEditorDrawerState.options.length) {
    planEditorDrawerState.selectedKey = '';
    return;
  }

  if (planEditorDrawerState.userSelected) {
    const stillValid = planEditorDrawerState.options.some((option) => getOfferSelectionKey(option.sourceItem) === planEditorDrawerState.selectedKey);
    if (stillValid) return;
    planEditorDrawerState.userSelected = false;
  }

  if (preferExistingDepot) {
    const existing = planEditorDrawerState.options.find((option) => option.depot === planEditorDrawerState.depot);
    if (existing) {
      planEditorDrawerState.selectedKey = getOfferSelectionKey(existing.sourceItem);
      return;
    }
  }

  planEditorDrawerState.selectedKey = getOfferSelectionKey(planEditorDrawerState.options[0].sourceItem);
}

async function refreshPlanEditorQuotes() {
  if (!planEditorDrawerState.items.length) return;
  const qty = Math.max(parseInt(planEditorDrawerState.qty, 10) || 1, 1);
  const requestVersion = ++planEditorDrawerState.quoteVersion;
  const fallbackOptions = getFallbackPlannerOptions(planEditorDrawerState.items, qty);
  applyPlanDrawerOptions(fallbackOptions, { preferExistingDepot: !planEditorDrawerState.userSelected });
  renderPlanEditorDrawer();

  try {
    const quotedOptions = await resolvePlannerOptions(planEditorDrawerState.items, qty);
    if (requestVersion !== planEditorDrawerState.quoteVersion || !quotedOptions.length) return;
    applyPlanDrawerOptions(quotedOptions, { preferExistingDepot: !planEditorDrawerState.userSelected });
    renderPlanEditorDrawer();
  } catch (error) {
    console.error('refreshPlanEditorQuotes failed:', error);
  }
}

function closePlanEditorDrawer() {
  planEditorDrawerState.open = false;
  planEditorDrawerState.loading = false;
  planEditorDrawerState.error = '';
  planEditorDrawerState.quoteVersion += 1;
  const overlay = document.getElementById('planEditorOverlay');
  const panel = document.getElementById('planEditorPanel');
  if (overlay) overlay.classList.remove('open');
  if (panel) {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
}

function renderPlanEditorDrawer() {
  const overlay = document.getElementById('planEditorOverlay');
  const panel = document.getElementById('planEditorPanel');
  const body = document.getElementById('planEditorBody');
  const title = document.getElementById('planEditorTitle');
  const subtitle = document.getElementById('planEditorSubtitle');
  if (!overlay || !panel || !body || !title || !subtitle) return;

  if (!planEditorDrawerState.open) {
    overlay.classList.remove('open');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    return;
  }

  overlay.classList.add('open');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  title.textContent = planEditorDrawerState.name || 'Plan Kalemi';
  subtitle.textContent = planEditorDrawerState.barcode
    ? `Barkod: ${planEditorDrawerState.barcode}`
    : 'Barkod bilgisi bulunamadi';

  if (planEditorDrawerState.loading) {
    body.innerHTML = `
      <div class="plan-editor-status">
        <div class="plan-editor-loading">
          <div class="spinner"></div>
          <span>Depolar, kampanyalar ve MF secenekleri yukleniyor...</span>
        </div>
      </div>
    `;
    return;
  }

  if (planEditorDrawerState.error) {
    body.innerHTML = `
      <div class="plan-editor-error">
        <strong>Plan duzenleyici yuklenemedi</strong>
        <p>${esc(planEditorDrawerState.error)}</p>
      </div>
    `;
    return;
  }

  const selectedOption = getSelectedPlanDrawerOption();
  if (!selectedOption) {
    body.innerHTML = `
      <div class="plan-editor-error">
        <strong>Teklif bulunamadi</strong>
        <p>Bu kalem icin aktif depolardan teklif toplanamadi.</p>
      </div>
    `;
    return;
  }

  const detailText = getBulkOfferDetailText(selectedOption, planEditorDrawerState.qty);
  const unitPrice = Number(selectedOption.effectiveUnit || 0);
  const totalPrice = Number(selectedOption.totalCost || 0);
  const planningLabel = selectedOption.mfStr ? `MF ${selectedOption.mfStr}` : 'Normal alim';

  body.innerHTML = `
    <section class="plan-editor-summary">
      <div class="plan-editor-summary-top">
        <div class="plan-editor-tags">
          <span>${esc(selectedOption.depot || '')}</span>
          <span>${esc(planEditorDrawerState.qty)} adet</span>
          <span>${esc(planningLabel)}</span>
        </div>
        <div class="plan-editor-summary-price">
          <span>Guncel toplam</span>
          <strong>${formatCurrency(totalPrice)}</strong>
        </div>
      </div>
      <div class="plan-editor-grid">
        <div class="plan-editor-cell">
          <span>Birim Maliyet</span>
          <strong>${formatCurrency(unitPrice)}</strong>
        </div>
        <div class="plan-editor-cell">
          <span>Toplam Odeme</span>
          <strong>${formatCurrency(totalPrice)}</strong>
        </div>
        <div class="plan-editor-cell">
          <span>Secilen Depo</span>
          <strong>${esc(selectedOption.depot || '')}</strong>
        </div>
        <div class="plan-editor-cell">
          <span>Plan Ozeti</span>
          <strong>${esc(detailText)}</strong>
        </div>
      </div>
    </section>

    <section class="plan-editor-controls">
      <div class="plan-editor-section-head">
        <div>
          <strong>Miktar ve MF Hesabi</strong>
          <p>Depodan alinacak net maliyeti bu alanda aninda gorun.</p>
        </div>
        <span>${esc(detailText)}</span>
      </div>
      <div class="plan-editor-qty-row">
        <button class="action-qty-step" type="button" data-plan-drawer-minus>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <input class="action-qty-input" type="number" min="1" value="${Math.max(parseInt(planEditorDrawerState.qty, 10) || 1, 1)}" data-plan-drawer-qty />
        <button class="action-qty-step" type="button" data-plan-drawer-plus>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </section>

    <section class="plan-editor-offers">
      <div class="plan-editor-section-head">
        <div>
          <strong>Depo Secimi</strong>
          <p>Farkli depolari karsilastirip aktif plan icin en uygun secenegi belirleyin.</p>
        </div>
      </div>
      ${planEditorDrawerState.options.map((option, idx) => {
        const isSelected = getOfferSelectionKey(option.sourceItem) === planEditorDrawerState.selectedKey;
        const optionDetail = getBulkOfferDetailText(option, planEditorDrawerState.qty);
        return `
          <article class="plan-editor-offer ${isSelected ? 'is-selected' : ''}" data-plan-drawer-offer="${idx}" tabindex="0" role="button">
            <div class="plan-editor-offer-top">
              <div class="plan-editor-offer-name">
                <span>${esc(option.depot || '')}</span>
                ${idx === 0 ? '<span class="plan-editor-offer-badge">En Uygun</span>' : ''}
                ${isSelected ? '<span class="plan-editor-offer-badge selected">Secili</span>' : ''}
              </div>
              <div class="plan-editor-offer-price">
                <strong>${formatCurrency(option.totalCost || 0)}</strong>
                <span>Birim ${formatCurrency(option.effectiveUnit || 0)}</span>
              </div>
            </div>
            <div class="plan-editor-offer-meta">${esc(optionDetail)}</div>
          </article>
        `;
      }).join('')}
    </section>

    <section class="plan-editor-actions plan-editor-actions-sticky">
      <button class="btn btn-primary" type="button" data-plan-drawer-save>Plani Guncelle</button>
      <button class="btn btn-outline" type="button" data-plan-drawer-open>Urunu Ac</button>
      ${selectedOption.depotUrl ? '<button class="btn btn-outline" type="button" data-plan-drawer-depot>Depoya Git</button>' : ''}
      <button class="plan-item-remove" type="button" data-plan-drawer-remove>Sil</button>
    </section>
  `;

  body.querySelector('[data-plan-drawer-minus]')?.addEventListener('click', () => {
    planEditorDrawerState.qty = Math.max((parseInt(planEditorDrawerState.qty, 10) || 1) - 1, 1);
    refreshPlanEditorQuotes();
  });
  body.querySelector('[data-plan-drawer-plus]')?.addEventListener('click', () => {
    planEditorDrawerState.qty = Math.max(parseInt(planEditorDrawerState.qty, 10) || 1, 1) + 1;
    refreshPlanEditorQuotes();
  });
  body.querySelector('[data-plan-drawer-qty]')?.addEventListener('change', (event) => {
    planEditorDrawerState.qty = Math.max(parseInt(event.target.value, 10) || 1, 1);
    refreshPlanEditorQuotes();
  });

  body.querySelectorAll('[data-plan-drawer-offer]').forEach((row) => {
    const select = () => {
      const option = planEditorDrawerState.options[parseInt(row.dataset.planDrawerOffer, 10)];
      if (!option) return;
      planEditorDrawerState.selectedKey = getOfferSelectionKey(option.sourceItem);
      planEditorDrawerState.userSelected = true;
      renderPlanEditorDrawer();
    };
    row.addEventListener('click', select);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });

  body.querySelector('[data-plan-drawer-open]')?.addEventListener('click', () => {
    openSavedProduct({
      barcode: planEditorDrawerState.barcode,
      query: planEditorDrawerState.barcode || planEditorDrawerState.name,
      name: planEditorDrawerState.name,
    });
  });

  body.querySelector('[data-plan-drawer-depot]')?.addEventListener('click', () => {
    if (selectedOption?.depotUrl) copyAndOpenDepot(selectedOption.depotUrl, selectedOption.depotId || '');
  });

  body.querySelector('[data-plan-drawer-remove]')?.addEventListener('click', () => {
    removeOrderPlanItem(planEditorDrawerState.key, planEditorDrawerState.depot);
    closePlanEditorDrawer();
  });

  body.querySelector('[data-plan-drawer-save]')?.addEventListener('click', () => {
    const currentEntry = getPlanDrawerEntry();
    const selected = getSelectedPlanDrawerOption();
    if (!currentEntry || !selected) return;
    addPlannerOptionToOrderPlan(selected, planEditorDrawerState.qty, {
      toastLabel: `${planEditorDrawerState.name || 'Plan kalemi'} guncellendi`,
    });
    if (currentEntry.depot !== selected.depot) {
      removeOrderPlanItem(currentEntry.key, currentEntry.depot);
    }
    closePlanEditorDrawer();
  });
}

async function openPlanEditorDrawer(key, depot = '') {
  const entry = getOrderPlan().find((item) => item.key === key && item.depot === depot);
  if (!entry) {
    showToast('Plan kalemi bulunamadi');
    return;
  }

  planEditorDrawerState.open = true;
  planEditorDrawerState.loading = true;
  planEditorDrawerState.error = '';
  planEditorDrawerState.key = entry.key;
  planEditorDrawerState.depot = entry.depot || '';
  planEditorDrawerState.qty = Math.max(parseInt(entry.desiredQty, 10) || 1, 1);
  planEditorDrawerState.name = entry.name || entry.query || entry.barcode || 'Plan Kalemi';
  planEditorDrawerState.barcode = entry.barcode || '';
  planEditorDrawerState.items = [];
  planEditorDrawerState.options = [];
  planEditorDrawerState.selectedKey = '';
  planEditorDrawerState.userSelected = false;
  planEditorDrawerState.quoteVersion += 1;
  renderPlanEditorDrawer();

  try {
    const items = await searchOneBulkQuery(entry.barcode || entry.query || entry.name || '');
    if (!planEditorDrawerState.open || planEditorDrawerState.key !== entry.key || planEditorDrawerState.depot !== entry.depot) return;
    planEditorDrawerState.items = items;
    planEditorDrawerState.loading = false;
    if (!items.length) {
      planEditorDrawerState.error = 'Bu plan kalemi icin aktif depolardan teklif toplanamadi.';
      renderPlanEditorDrawer();
      return;
    }
    await refreshPlanEditorQuotes();
  } catch (error) {
    console.error('openPlanEditorDrawer failed:', error);
    planEditorDrawerState.loading = false;
    planEditorDrawerState.error = 'Plan duzenleyici yuklenirken bir hata olustu.';
    renderPlanEditorDrawer();
  }
}

function renderOrderPlanDetail() {
  const container = document.getElementById('orderPlanDetailContainer');
  if (!container) return;

  try {
    const plan = getOrderPlan().map(normalizeOrderPlanItem).filter(Boolean);
    if (!plan.length) {
      container.innerHTML = `
        <section class="ops-card plan-detail-shell">
          <div class="ops-empty">
            <strong>Aktif siparis plani bos</strong>
            <span>Arama sonucundan urun eklediginizde bu ekranda depo ve kalem detaylarini goreceksiniz.</span>
          </div>
        </section>
      `;
      return;
    }

    const totalCost = plan.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
    const depots = Array.from(new Set(plan.map(item => item.depot).filter(Boolean)));

    container.innerHTML = `
      <section class="ops-card plan-detail-shell">
        <div class="plan-detail-summary">
          <div class="plan-detail-stat">
            <span>Kalem</span>
            <strong>${plan.length}</strong>
          </div>
          <div class="plan-detail-stat">
            <span>Toplam Depo</span>
            <strong>${depots.length}</strong>
          </div>
          <div class="plan-detail-stat plan-detail-stat-accent">
            <span>Plan Toplami</span>
            <strong>TL ${totalCost.toFixed(2).replace('.', ',')}</strong>
          </div>
          <button class="btn btn-outline plan-export-btn" type="button" id="exportPlanCsvBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV İndir
          </button>
        </div>
        <div class="plan-detail-list">
          ${plan.map(item => {
            const isDrawerOpen = planEditorDrawerState.open
              && planEditorDrawerState.key === item.key
              && planEditorDrawerState.depot === item.depot;
            return `
            <article class="plan-detail-item plan-detail-item-editable ${isDrawerOpen ? 'is-open' : ''}" tabindex="0" role="button" data-plan-editor-open="${esc(item.key)}" data-plan-editor-depot="${esc(item.depot)}">
              <div class="plan-detail-head">
                <div>
                  <h3>${esc(item.name || item.query || item.barcode || 'Urun')}</h3>
                  <div class="plan-detail-tags">
                    <span>${esc(item.depot || 'Depo yok')}</span>
                    <span>${esc(item.desiredQty || 1)} adet</span>
                    <span>${item.planningMode === 'mf' && item.mfStr ? esc(item.mfStr) : 'Normal alim'}</span>
                  </div>
                </div>
                <div class="plan-detail-price">TL ${(Number(item.totalCost) || 0).toFixed(2).replace('.', ',')}</div>
              </div>
              <div class="plan-detail-grid">
                <div class="plan-detail-cell">
                  <span>Birim Maliyet</span>
                  <strong>${Number(item.effectiveUnit) > 0 ? 'TL ' + Number(item.effectiveUnit).toFixed(2).replace('.', ',') : 'Bilinmiyor'}</strong>
                </div>
                <div class="plan-detail-cell">
                  <span>Barkod</span>
                  <strong>${item.barcode ? esc(item.barcode) : 'Yok'}</strong>
                </div>
                <div class="plan-detail-cell">
                  <span>Secilen Depo</span>
                  <strong>${esc(item.depot || 'Depo yok')}</strong>
                </div>
              </div>
              <div class="plan-detail-quick-actions">
                <div class="plan-detail-qty-controls">
                  <button class="action-qty-step" type="button" data-plan-card-minus="${esc(item.key)}" data-plan-card-minus-depot="${esc(item.depot)}" aria-label="Azalt">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <span class="plan-detail-qty-value">${Math.max(parseInt(item.desiredQty, 10) || 1, 1)} adet</span>
                  <button class="action-qty-step" type="button" data-plan-card-plus="${esc(item.key)}" data-plan-card-plus-depot="${esc(item.depot)}" aria-label="Artir">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <div class="plan-detail-action-buttons">
                  ${item.depotUrl ? `<button class="btn btn-outline" type="button" data-plan-card-depot="${esc(item.key)}" data-plan-card-depot-name="${esc(item.depot)}">Depoya Git</button>` : ''}
                  <button class="plan-item-remove" type="button" data-plan-card-remove="${esc(item.key)}" data-plan-card-remove-depot="${esc(item.depot)}">Sil</button>
                </div>
              </div>
              <div class="plan-detail-hint">Kartin ustune tiklayarak depot secimi, miktar ve MF detaylarini sag panelde duzenleyin.</div>
            </article>
          `;
          }).join('')}
        </div>
      </section>
    `;

    container.querySelectorAll('[data-plan-editor-open]').forEach((card) => {
      const openEditor = () => {
        openPlanEditorDrawer(card.dataset.planEditorOpen, card.dataset.planEditorDepot);
      };
      card.addEventListener('click', (event) => {
        if (event.target.closest('button, input, a')) return;
        openEditor();
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openEditor();
        }
      });
    });

    container.querySelectorAll('[data-plan-card-minus]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const item = plan.find((entry) => entry.key === btn.dataset.planCardMinus && entry.depot === btn.dataset.planCardMinusDepot);
        if (!item) return;
        updateOrderPlanItemQuantity(item.key, item.depot, Math.max((parseInt(item.desiredQty, 10) || 1) - 1, 1));
      });
    });

    container.querySelectorAll('[data-plan-card-plus]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const item = plan.find((entry) => entry.key === btn.dataset.planCardPlus && entry.depot === btn.dataset.planCardPlusDepot);
        if (!item) return;
        updateOrderPlanItemQuantity(item.key, item.depot, Math.max(parseInt(item.desiredQty, 10) || 1, 1) + 1);
      });
    });

    container.querySelectorAll('[data-plan-card-depot]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const item = plan.find((entry) => entry.key === btn.dataset.planCardDepot && entry.depot === btn.dataset.planCardDepotName);
        if (item?.depotUrl) copyAndOpenDepot(item.depotUrl, item.depotId || '');
      });
    });

    container.querySelectorAll('[data-plan-card-remove]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeOrderPlanItem(btn.dataset.planCardRemove, btn.dataset.planCardRemoveDepot);
      });
    });

    document.getElementById('exportPlanCsvBtn')?.addEventListener('click', () => exportOrderPlanCsv(plan));
  } catch (error) {
    console.error('renderOrderPlanDetail failed:', error);
    pushDiagnosticEvent('order-plan-error', 'Plan detay ekrani render edilemedi', {
      message: error?.message || String(error),
    });
    container.innerHTML = `
      <section class="ops-card plan-detail-shell">
        <div class="ops-empty">
          <strong>Plan detaylari yuklenemedi</strong>
          <span>Kayitlar yeniden okunurken bir hata olustu. Ana sayfaya donup tekrar deneyin.</span>
        </div>
      </section>
    `;
  }
}

// ── Bulk Search ──────────────────────────────────────────────────

let _bulkSearchActive = false;

function closeExpandedBulkCards(exceptCard = null) {
  document.querySelectorAll('.bulk-result-card.bulk-result-expanded').forEach((openCard) => {
    if (exceptCard && openCard === exceptCard) return;
    openCard.classList.remove('bulk-result-expanded');
    const panel = openCard.querySelector('.bulk-inline-panel');
    if (panel) panel.hidden = true;
  });
}

async function searchOneBulkQuery(query) {
  if (!cachedConfig) await loadDepotStatus();
  const activeDepots = DEPOT_LIST.filter(d => {
    const info = cachedConfig?.depots?.[d.id];
    return info && (info.hasCredentials || info.hasCookies || info.hasToken);
  });

  const results = await Promise.all(
    activeDepots.map(depot =>
      authFetch(`${API_BASE}/api/search-depot?q=${encodeURIComponent(query)}&depotId=${depot.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.error || !data.results?.length) return [];
          const depotUrl = data.depotUrl || '';
          return data.results.map(r => ({ ...r, depotUrl, depotId: depot.id }));
        })
        .catch(() => [])
    )
  );

  const allItems = results.flat().filter(r => r.fiyatNum > 0);
  allItems.sort((a, b) => a.fiyatNum - b.fiyatNum);
  return allItems;
}

// Returns { card, getResult } so runBulkSearch can read current selection for "add all"
function renderBulkResultCard(query, items, container) {
  const card = document.createElement('div');
  card.className = 'bulk-result-card';
  card.dataset.bulkQuery = query;

  if (!items.length) {
    card.classList.add('bulk-result-not-found');
    card.innerHTML = `
      <div class="bulk-result-header">
        <div class="bulk-result-query">"${esc(query)}"</div>
        <div class="bulk-result-name">Bulunamadı</div>
      </div>
    `;
    container.appendChild(card);
    return { card, getResult: () => null };
  }

  const name = items[0].ad || query;

  const state = {
    options: [],
    selectedKey: '',
    qty: 1,
    quoteVersion: 0,
    inlineOpen: false,
    userSelected: false,  // true only after explicit user click on a row
  };

  function getSelectedOption() {
    return state.options.find(o => getOfferSelectionKey(o.sourceItem) === state.selectedKey)
      || state.options[0]
      || null;
  }

  function applyOptions(opts, keepUserSelection = false) {
    state.options = opts;
    if (keepUserSelection && state.userSelected) {
      // User explicitly chose a depot — keep it if still in list, else fall back to cheapest
      const stillValid = opts.some(o => getOfferSelectionKey(o.sourceItem) === state.selectedKey);
      if (!stillValid) {
        state.selectedKey = opts[0] ? getOfferSelectionKey(opts[0].sourceItem) : '';
        state.userSelected = false;
      }
    } else {
      // No user selection yet — always default to cheapest (idx 0 after sort)
      state.selectedKey = opts[0] ? getOfferSelectionKey(opts[0].sourceItem) : '';
    }
  }

  function renderOfferRows(rowsEl) {
    rowsEl.innerHTML = state.options.map((opt, idx) => {
      const isBest = idx === 0;
      const isSelected = getOfferSelectionKey(opt.sourceItem) === state.selectedKey;
      const unitStr = opt.effectiveUnit.toFixed(2).replace('.', ',');
      const totalStr = opt.totalCost.toFixed(2).replace('.', ',');
      const detailText = getBulkOfferDetailText(opt, state.qty);
      const usesMfPricing = shouldUseMfForQty(state.qty);
      const primaryLabel = usesMfPricing ? 'Odenecek' : 'Birim';
      const primaryValue = usesMfPricing ? totalStr : unitStr;
      const secondaryLabel = usesMfPricing ? 'Efektif birim' : 'Toplam';
      const secondaryValue = usesMfPricing ? unitStr : totalStr;
      const liveBadge = opt.pricingMode === 'live'
        ? '<span class="bulk-offer-badge live">Canlı</span>'
        : '';

      return `
        <div class="bulk-offer-row ${isSelected ? 'bulk-offer-selected' : ''}" data-bulk-offer-idx="${idx}" role="button" tabindex="0">
          <div class="bulk-offer-depot">
            <span class="bulk-offer-depot-name">${esc(opt.depot)}</span>
            ${isBest ? '<span class="bulk-offer-badge best">En Ucuz</span>' : ''}
            ${isSelected ? '<span class="bulk-offer-badge selected">Secili</span>' : ''}
            ${liveBadge}
          </div>
          <div class="bulk-offer-detail">
            <span class="bulk-offer-mf">${esc(detailText)}</span>
          </div>
          <div class="bulk-offer-price">
            <span class="bulk-offer-unit">${primaryLabel}: TL ${primaryValue}</span>
            <span class="bulk-offer-total">${secondaryLabel}: TL ${secondaryValue}</span>
          </div>
        </div>
      `;
    }).join('');

    rowsEl.querySelectorAll('[data-bulk-offer-idx]').forEach(row => {
      const select = () => {
        const opt = state.options[parseInt(row.dataset.bulkOfferIdx, 10)];
        if (opt) {
          state.selectedKey = getOfferSelectionKey(opt.sourceItem);
          state.userSelected = true;
        }
        renderOfferRows(rowsEl);
        syncFooter();
        openInlinePanel();
      };
      row.addEventListener('click', select);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    });

    const selectedRow = rowsEl.querySelector('.bulk-offer-row.bulk-offer-selected');
    if (selectedRow && document.activeElement === document.body) {
      selectedRow.focus();
    }
  }

  function syncFooter() {
    const opt = getSelectedOption();
    const footerPrice = card.querySelector('.bulk-footer-price');
    if (footerPrice && opt) {
      const footerLabel = shouldUseMfForQty(state.qty) ? 'Odenecek: ' : '';
      footerPrice.textContent = `${footerLabel}TL ${opt.totalCost.toFixed(2).replace('.', ',')}`;
    }
    renderInlinePanel();
  }

  function openInlinePanel() {
    state.inlineOpen = true;
    renderInlinePanel();
    closeExpandedBulkCards(card);
    card.classList.add('bulk-result-expanded');
    const panel = card.querySelector('.bulk-inline-panel');
    if (panel) panel.hidden = false;
  }

  function closeInlinePanel() {
    state.inlineOpen = false;
    card.classList.remove('bulk-result-expanded');
    const panel = card.querySelector('.bulk-inline-panel');
    if (panel) panel.hidden = true;
  }

  function renderInlinePanel() {
    const panel = card.querySelector('.bulk-inline-panel');
    const opt = getSelectedOption();
    if (!panel || !opt) return;
    if (!state.inlineOpen) {
      panel.hidden = true;
      return;
    }

    const barcode = String(opt.sourceItem?.barcode || opt.sourceItem?.barkod || query || '').trim();
    const detailText = getBulkOfferDetailText(opt, state.qty);
    const totalStr = opt.totalCost.toFixed(2).replace('.', ',');
    const unitStr = opt.effectiveUnit.toFixed(2).replace('.', ',');
    const qtyLabel = `${state.qty} adet`;
    const planningLabel = opt.mfStr ? 'MF plani' : 'Normal alim';

    panel.innerHTML = `
      <div class="bulk-inline-head">
        <div class="bulk-inline-copy">
          <h4>${esc(name)}</h4>
          <div class="bulk-inline-tags">
            <span>${esc(opt.depot || '')}</span>
            <span>${esc(qtyLabel)}</span>
            <span>${esc(planningLabel)}</span>
          </div>
        </div>
        <div class="bulk-inline-price">TL ${totalStr}</div>
      </div>
      <div class="bulk-inline-grid">
        <div class="bulk-inline-cell">
          <span>Birim Maliyet</span>
          <strong>TL ${unitStr}</strong>
        </div>
        <div class="bulk-inline-cell">
          <span>Barkod</span>
          <strong>${barcode ? esc(barcode) : 'Yok'}</strong>
        </div>
        <div class="bulk-inline-cell">
          <span>Secilen Depo</span>
          <strong>${esc(opt.depot || '')}</strong>
        </div>
      </div>
      <div class="bulk-inline-meta">${esc(detailText)}</div>
      <div class="bulk-inline-actions">
        <button class="btn btn-outline" type="button" data-bulk-panel-open>Urunu Ac</button>
        ${opt.depotUrl ? '<button class="btn btn-primary" type="button" data-bulk-panel-depot>Depoya Git</button>' : ''}
        <button class="plan-item-remove" type="button" data-bulk-panel-close>Kapat</button>
      </div>
    `;

    panel.querySelector('[data-bulk-panel-open]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      openSavedProduct({
        barcode,
        query: barcode || query,
        name,
      });
    });

    panel.querySelector('[data-bulk-panel-depot]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      copyAndOpenDepot(opt.depotUrl, opt.depotId || '');
    });

    panel.querySelector('[data-bulk-panel-close]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      closeInlinePanel();
    });

    panel.hidden = false;
  }

  async function refreshQuotes(rowsEl) {
    const version = ++state.quoteVersion;
    const fallback = getFallbackPlannerOptions(items, state.qty);
    applyOptions(fallback);
    renderOfferRows(rowsEl);
    syncFooter();

    resolvePlannerOptions(items, state.qty).then(quoted => {
      if (version !== state.quoteVersion || !quoted.length) return;
      const changed = quoted.some((q, i) => {
        const f = fallback[i];
        return !f
          || Math.abs((q.effectiveUnit || 0) - (f.effectiveUnit || 0)) > 0.005
          || Math.abs((q.totalCost || 0) - (f.totalCost || 0)) > 0.005
          || (q.pricingMode || '') !== (f.pricingMode || '');
      });
      if (changed) {
        applyOptions(quoted, true); // keep explicit user selections
        renderOfferRows(rowsEl);
        syncFooter();
      }
    }).catch(() => {});
  }

  card.innerHTML = `
    <div class="bulk-result-header">
      <div class="bulk-result-query">"${esc(query)}"</div>
      <div class="bulk-result-name">${esc(name)}</div>
    </div>
    <div class="bulk-offer-rows"></div>
    <div class="bulk-inline-panel" hidden></div>
    <div class="bulk-result-footer">
      <div class="bulk-footer-qty">
        <button class="action-qty-step" data-bulk-minus type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <input type="number" class="action-qty-input bulk-qty-input" min="1" value="1" inputmode="numeric" />
        <button class="action-qty-step" data-bulk-plus type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span class="bulk-footer-price"></span>
      </div>
      <button class="btn btn-primary bulk-add-btn" type="button">Plana Ekle</button>
    </div>
  `;

  const rowsEl = card.querySelector('.bulk-offer-rows');
  refreshQuotes(rowsEl);

  // Qty controls
  const qtyInput = card.querySelector('.bulk-qty-input');
  const applyQty = (val) => {
    state.qty = Math.max(parseInt(val, 10) || 1, 1);
    qtyInput.value = state.qty;
    refreshQuotes(rowsEl);
  };
  card.querySelector('[data-bulk-minus]').addEventListener('click', () => applyQty(state.qty - 1));
  card.querySelector('[data-bulk-plus]').addEventListener('click', () => applyQty(state.qty + 1));
  qtyInput.addEventListener('change', () => applyQty(qtyInput.value));
  qtyInput.addEventListener('input', () => applyQty(qtyInput.value));

  // Add to plan
  const addBtn = card.querySelector('.bulk-add-btn');
  addBtn.addEventListener('click', () => {
    const opt = getSelectedOption();
    if (!opt) return;
    addPlannerOptionToOrderPlan(opt, state.qty, { toastLabel: `${name} siparis planina eklendi` });
    card.classList.add('bulk-result-added');
    addBtn.textContent = 'Eklendi ✓';
    addBtn.disabled = true;
  });

  card.addEventListener('click', (event) => {
    if (event.target.closest('button, input, .bulk-inline-panel')) return;
    openInlinePanel();
  });

  card.addEventListener('keydown', (event) => {
    if (event.target !== card) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openInlinePanel();
    }
  });

  card.tabIndex = 0;

  container.appendChild(card);

  // Expose current selection so runBulkSearch can use it for "add all"
  return {
    card,
    getResult: () => {
      const opt = getSelectedOption();
      return opt ? { opt, qty: state.qty, name } : null;
    },
  };
}

async function runBulkSearch() {
  if (_bulkSearchActive) return;

  const textarea = document.getElementById('bulkSearchInput');
  const status = document.getElementById('bulkSearchStatus');
  const resultsEl = document.getElementById('bulkSearchResults');
  const addAllBtn = document.getElementById('bulkSearchAddAllBtn');
  const runBtn = document.getElementById('bulkSearchRunBtn');

  const rawQueries = (textarea.value || '')
    .split('\n')
    .map(q => q.trim())
    .filter(Boolean);

  if (!rawQueries.length) {
    showToast('En az bir ürün girin');
    return;
  }

  _scQuoteCache.clear();

  // Deduplicate: barkodlar için normalize edilmiş değer, diğerleri için lowercase
  const seenKeys = new Set();
  const queries = [];
  let dupCount = 0;
  rawQueries.forEach(q => {
    const key = isBarcodeQuery(q) ? q.trim() : q.toLowerCase();
    if (seenKeys.has(key)) {
      dupCount++;
    } else {
      seenKeys.add(key);
      queries.push(q);
    }
  });

  if (dupCount > 0) {
    showToast(`${dupCount} tekrarlayan sorgu çıkarıldı`);
  }

  _bulkSearchActive = true;
  runBtn.disabled = true;
  addAllBtn.style.display = 'none';
  resultsEl.innerHTML = '';

  const cardRefs = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    status.textContent = `Aranıyor ${i + 1}/${queries.length}: ${q}`;
    const items = await searchOneBulkQuery(q);
    const ref = renderBulkResultCard(q, items, resultsEl);
    if (ref) cardRefs.push(ref);
  }

  status.textContent = `${queries.length} sorgu tamamlandı${dupCount > 0 ? ` (${dupCount} tekrar atlandı)` : ''}.`;
  _bulkSearchActive = false;
  runBtn.disabled = false;

  const hasAny = cardRefs.some(r => r.getResult() !== null);
  if (hasAny) {
    addAllBtn.style.display = 'inline-flex';
    addAllBtn.onclick = () => {
      // Use each card's current live-quoted, user-selected option and qty
      cardRefs.forEach(ref => {
        const result = ref.getResult();
        if (!result) return;
        addPlannerOptionToOrderPlan(result.opt, result.qty, { toastLabel: `${result.name} eklendi` });
      });
      showToast('Bulunan tüm ürünler plana eklendi');
      addAllBtn.style.display = 'none';
    };
  }
}

(function initBulkSearch() {
  const runBtn = document.getElementById('bulkSearchRunBtn');
  const textarea = document.getElementById('bulkSearchInput');
  if (!runBtn || !textarea) return;

  runBtn.addEventListener('click', runBulkSearch);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      runBulkSearch();
    }
  });
})();

function renderHomeOrderPlan() {
  const container = document.getElementById('orderPlanContainer');
  const clearBtn = document.getElementById('clearOrderPlanBtn');
  const inspectBtn = document.getElementById('openOrderPlanBtn');
  if (!container || !clearBtn || !inspectBtn) return;

  const plan = getOrderPlan();
  saveOrderPlan(plan);
  clearBtn.style.display = plan.length ? 'inline-flex' : 'none';
  inspectBtn.style.display = plan.length ? 'inline-flex' : 'none';

  if (!plan.length) {
    container.innerHTML = `
      <div class="ops-empty">
        <strong>Henuz aktif siparis plani yok</strong>
        <span>Arama sonucundan "Siparis Planina Ekle" dediginizde burada toplam maliyet ve depo onerisi gorunecek.</span>
      </div>
    `;
    return;
  }

  const totalCost = plan.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  container.innerHTML = `
    <div class="plan-summary">
      <div class="plan-summary-stat">
        <span>Kalem</span>
        <strong>${plan.length}</strong>
      </div>
      <div class="plan-summary-stat">
        <span>Plan Toplami</span>
        <strong>TL ${totalCost.toFixed(2).replace('.', ',')}</strong>
      </div>
    </div>
    <div class="plan-list">
      ${plan.map(item => `
        <div class="plan-item">
          <button class="plan-item-main" data-plan-open="${esc(item.key)}" data-plan-depot="${esc(item.depot)}">
            <div class="plan-item-top">
              <div class="plan-item-name">${esc(item.name)}</div>
              <div class="plan-item-price">TL ${(item.totalCost || 0).toFixed(2).replace('.', ',')}</div>
            </div>
            <div class="plan-item-meta">
              <span>${esc(item.depot)}</span>
              <span>${esc(item.desiredQty)} adet</span>
              <span>${item.planningMode === 'mf' && item.mfStr ? esc(item.mfStr) : 'Normal alim'}</span>
            </div>
            <div class="plan-item-detail">
              ${item.planningMode === 'mf' && item.mfStr ? `MF ${esc(item.mfStr)}` : 'Normal alim'}
            </div>
          </button>
          <button class="plan-item-remove" data-plan-remove="${esc(item.key)}" data-plan-remove-depot="${esc(item.depot)}" type="button">Sil</button>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('[data-plan-open]').forEach(btn => {
    btn.addEventListener('click', openOrderPlanDetail);
  });

  container.querySelectorAll('[data-plan-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeOrderPlanItem(btn.dataset.planRemove, btn.dataset.planRemoveDepot));
  });
}

function renderRoutineList() {
  const container = document.getElementById('routineListContainer');
  const routineCard = document.getElementById('routineCard');
  const orderPlanCard = document.getElementById('orderPlanCard');
  if (!container || !routineCard || !orderPlanCard) return;

  const routines = getRoutineList();
  if (!routines.length) {
    routineCard.classList.add('ops-card-hidden');
    orderPlanCard.classList.add('ops-card-wide');
    container.innerHTML = `
      <div class="ops-empty">
        <strong>Sabit ihtiyac listeniz bos</strong>
        <span>Duzenli aldiginiz urunleri sonuc ekranindan bu listeye ekleyebilirsiniz.</span>
      </div>
    `;
    return;
  }

  routineCard.classList.remove('ops-card-hidden');
  orderPlanCard.classList.remove('ops-card-wide');

  container.innerHTML = `
    <div class="routine-list">
      ${routines.map(item => `
        <div class="routine-item">
          <button class="routine-item-main" data-routine-open="${esc(item.key)}">
            <span class="routine-item-name">${esc(item.name)}</span>
            ${item.barcode ? `<span class="routine-item-code">${esc(item.barcode)}</span>` : ''}
          </button>
          <button class="plan-item-remove" data-routine-remove="${esc(item.key)}" type="button">Sil</button>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('[data-routine-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = routines.find(entry => entry.key === btn.dataset.routineOpen);
      if (item) openSavedProduct(item);
    });
  });

  container.querySelectorAll('[data-routine-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeRoutineItem(btn.dataset.routineRemove));
  });
}

function buildHistoryInsights(history) {
  const map = new Map();

  (history || []).forEach(entry => {
    const key = entry.barkod || slugifyName(entry.ilac || '');
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: entry.ilac,
        barcode: entry.barkod || '',
        count: 0,
        lastSeen: entry.tarih,
      });
    }
    const insight = map.get(key);
    insight.count++;
    if (new Date(entry.tarih) > new Date(insight.lastSeen)) {
      insight.lastSeen = entry.tarih;
      insight.name = entry.ilac;
      insight.barcode = entry.barkod || insight.barcode;
    }
  });

  return Array.from(map.values())
    .filter(item => item.count > 1)
    .sort((a, b) => b.count - a.count || new Date(b.lastSeen) - new Date(a.lastSeen))
    .slice(0, 6);
}

function renderHistoryInsights(history) {
  const container = document.getElementById('historyInsightsContainer');
  if (!container) return;

  const insights = buildHistoryInsights(history);
  if (!insights.length) {
    container.innerHTML = '';
    return;
  }

  const routines = getRoutineList();
  container.innerHTML = `
    <section class="ops-card history-insights-card">
      <div class="ops-card-head">
        <div>
          <div class="ops-card-eyebrow">Adaylar</div>
          <h3>Rutin Alim Adaylari</h3>
          <p>Gecmiste tekrar tekrar aradiginiz urunleri buradan hizlica sabitleyin.</p>
        </div>
      </div>
      <div class="history-insights-list">
        ${insights.map(item => {
          const exists = routines.some(routine => routine.key === item.key);
          return `
            <div class="history-insight-item">
              <button class="history-insight-main" data-insight-open="${esc(item.key)}">
                <strong>${esc(item.name)}</strong>
                <span>${esc(item.count)} kez arandi${item.barcode ? ` · ${esc(item.barcode)}` : ''}</span>
              </button>
              ${exists
                ? '<span class="history-insight-badge">Sabit listede</span>'
                : `<button class="btn btn-outline history-insight-add" data-insight-add="${esc(item.key)}" type="button">Sabit Listeye Ekle</button>`}
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;

  container.querySelectorAll('[data-insight-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = insights.find(entry => entry.key === btn.dataset.insightOpen);
      if (item) openSavedProduct(item);
    });
  });

  container.querySelectorAll('[data-insight-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = insights.find(entry => entry.key === btn.dataset.insightAdd);
      if (!item) return;
      const list = getRoutineList();
      list.unshift({
        key: item.key,
        name: item.name,
        barcode: item.barcode || '',
        query: item.barcode || item.name,
        addedAt: new Date().toISOString(),
      });
      saveRoutineList(list.slice(0, 24));
      renderRoutineList();
      renderHistoryInsights(history);
      showToast(`${item.name} sabit listeye eklendi`);
    });
  });
}

function renderHomeDashboard() {
  renderHomeOrderPlan();
  renderRoutineList();
  renderHomeHistory();
}

(function setupWorkflowActions() {
  const addPlanBtn = document.getElementById('addToPlanBtn');
  const addRoutineBtn = document.getElementById('addToRoutineBtn');
  const clearPlanBtn = document.getElementById('clearOrderPlanBtn');
  const openPlanBtn = document.getElementById('openOrderPlanBtn');

  addPlanBtn?.addEventListener('click', addCurrentToOrderPlan);
  addRoutineBtn?.addEventListener('click', addCurrentToRoutineList);
  clearPlanBtn?.addEventListener('click', clearOrderPlan);
  openPlanBtn?.addEventListener('click', openOrderPlanDetail);
})();

// ──── History ────
function saveHistory(items, query) {
  if (!items || items.length === 0) return;
  const normalizedItems = dedupeSearchItems(items, query);
  const identity = getSearchIdentity(normalizedItems, query);
  const bestItem = normalizedItems.find(i => i.fiyatNum > 0) || normalizedItems[0];
  authFetch(API_BASE + '/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ilac: identity.name || bestItem.ad || query,
      barkod: identity.barcode || null,
      sonuclar: normalizedItems.map(i => ({
        depot: i.depot,
        barkod: i.barkod || getItemBarcode(i, query) || null,
        ilac: i.ad,
        fiyat: i.fiyat,
        stok: i.stokVar,
        mf: i.malFazlasi || '',
      })),
      enUcuz: { depot: bestItem.depot, fiyat: bestItem.fiyat },
    }),
  }).then(() => {
    renderHomeDashboard();
    if (currentPage === 'history') renderHistory();
  }).catch(() => {});
}

async function fetchHistory(limit = 100) {
  const res = await authFetch(API_BASE + '/api/history?limit=' + limit);
  return res.json();
}

function formatHistoryDateParts(dateValue) {
  const date = new Date(dateValue);
  return {
    dateStr: date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    timeStr: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function openHistorySearch(query, barcode) {
  const searchValue = (barcode || query || '').trim();
  if (!searchValue) return;

  document.getElementById('homeSearchInput').value = query || searchValue;
  document.getElementById('searchInput').value = searchValue;

  const selectedDrug = document.getElementById('selectedDrug');
  if (barcode) {
    selectedBarcode = barcode;
    document.getElementById('selectedDrugName').textContent = query || 'Geçmiş Araması';
    document.getElementById('selectedDrugCode').textContent = 'Barkod: ' + barcode;
    selectedDrug.style.display = 'flex';
  } else {
    selectedBarcode = null;
    selectedDrug.style.display = 'none';
  }

  closeProfileMenu();
  showPage('search');
  doSearch();
}

async function renderHomeHistory() {
  const container = document.getElementById('homeHistoryContainer');
  if (!container) return;

  container.innerHTML = '<div class="home-history-empty">Geçmiş yükleniyor...</div>';

  try {
    const history = await fetchHistory(5);

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="home-history-empty">
          <div class="home-history-empty-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <strong>Henüz geçmiş yok</strong>
            <span>İlk aramanız burada kart olarak görünecek.</span>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map(entry => {
      const { dateStr, timeStr } = formatHistoryDateParts(entry.tarih);
      const offerCount = entry.sonuclar ? entry.sonuclar.length + ' depo' : 'Teklif yok';
      const bestDepot = entry.enUcuz ? entry.enUcuz.depot : 'Teklif yok';
      const bestPrice = entry.enUcuz ? 'TL ' + entry.enUcuz.fiyat : '-';

      return `
        <button class="home-history-item" data-history-query="${esc(entry.ilac)}" data-history-barcode="${esc(entry.barkod || '')}">
          <div class="home-history-item-top">
            <div class="home-history-drug">${esc(entry.ilac)}</div>
            <div class="home-history-price">${esc(bestPrice)}</div>
          </div>
          <div class="home-history-item-meta">
            <span>${esc(bestDepot)}</span>
            <span>${esc(offerCount)}</span>
            <span>${dateStr} • ${timeStr}</span>
          </div>
          ${entry.barkod ? '<div class="home-history-barcode">' + esc(entry.barkod) + '</div>' : ''}
        </button>
      `;
    }).join('');

    container.querySelectorAll('.home-history-item').forEach(item => {
      item.addEventListener('click', () => openHistorySearch(item.dataset.historyQuery, item.dataset.historyBarcode));
    });
  } catch (err) {
    container.innerHTML = '<div class="home-history-empty">Geçmiş yüklenemedi.</div>';
  }
}

async function renderHistory() {
  const container = document.getElementById('historyContainer');
  container.innerHTML = '<div class="loading" style="display:block"><div class="spinner"></div><div>Yükleniyor...</div></div>';

  try {
    const history = await fetchHistory(100);
    renderHistoryInsights(history);

    if (!history || history.length === 0) {
      container.innerHTML = '<div class="status-msg">Henüz arama geçmişi yok.</div>';
      return;
    }

    let html = `
      <div class="others-table-wrap">
        <table class="others-table">
          <thead>
            <tr>
              <th>TARIH</th>
              <th>ILAC</th>
              <th>EN UCUZ DEPO</th>
              <th style="text-align:right">FIYAT</th>
              <th>TEKLIF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const entry of history) {
      const { dateStr, timeStr } = formatHistoryDateParts(entry.tarih);

      html += `
        <tr>
          <td>
            <div style="font-size:13px;font-weight:500">${dateStr}</div>
            <div style="font-size:11px;color:var(--text-3)">${timeStr}</div>
          </td>
          <td>
            <span class="depot-name-text">${esc(entry.ilac)}</span>
            ${entry.barkod ? '<br><span style="font-size:11px;color:var(--text-3);font-family:JetBrains Mono,monospace">' + esc(entry.barkod) + '</span>' : ''}
          </td>
          <td>${entry.enUcuz ? esc(entry.enUcuz.depot) : '-'}</td>
          <td class="price-cell">${entry.enUcuz ? 'TL ' + esc(entry.enUcuz.fiyat) : '-'}</td>
          <td><span style="font-size:12px;color:var(--text-2)">${entry.sonuclar ? entry.sonuclar.length + ' depo' : '-'}</span></td>
          <td>
            <button class="btn-depot-link" data-history-id="${entry.id}" title="Sil">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </td>
        </tr>
      `;
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;

    container.querySelectorAll('[data-history-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteHistory(btn.dataset.historyId));
    });
  } catch (err) {
    const insights = document.getElementById('historyInsightsContainer');
    if (insights) insights.innerHTML = '';
    container.innerHTML = '<div class="status-msg error">Geçmiş yüklenemedi: ' + esc(err.message) + '</div>';
  }
}

async function deleteHistory(id) {
  await authFetch(API_BASE + '/api/history/' + id, { method: 'DELETE' });
  renderHomeDashboard();
  renderHistory();
}

function applyHumanUiCopy() {
  document.title = 'Eczane - İlaç Fiyat Karşılaştırma';

  const textMap = [
    ['#profileHistoryBtn', 'Geçmiş'],
    ['#profileSettingsBtn', 'Ayarlar'],
    ['#profileQuitBtn', 'Uygulamayı Kapat'],
    ['.profile-menu-item.logout-item', 'Çıkış Yap'],
    ['.hero-pill', 'Hızlı, net, güvenilir'],
    ['.hero h1', 'En uygun ilacı\nhızla bulun'],
    ['.hero p', 'Depo fiyatlarını tek ekranda karşılaştırın, doğru teklife daha kısa sürede ulaşın.'],
    ['#orderPlanCard .ops-card-eyebrow', 'Sipariş'],
    ['#orderPlanCard h3', 'Aktif Sipariş Planı'],
    ['#orderPlanCard p', 'Seçtiğiniz ürünleri hedef adetleriyle burada takip edin.'],
    ['#openOrderPlanBtn', 'Planı İncele'],
    ['#clearOrderPlanBtn', 'Planı Temizle'],
    ['#routineCard h3', 'Sabit İhtiyaç Listesi'],
    ['#routineCard p', 'Sık aldığınız ürünleri tek tıkla yeniden sorgulayın.'],
    ['.home-history-header h3', 'Arama Geçmişi'],
    ['.home-history-header p', 'Son sorgularınıza tek tıkla geri dönün.'],
    ['#loading div:last-child', 'Depolardan fiyat bilgileri alınıyor...'],
    ['#searchActionProduct', 'Seçili Ürün'],
    ['#page-settings .settings-header h2', 'Ayarlar'],
    ['#page-settings .settings-header p', 'Uygulama davranışlarını, depo bağlantılarını ve geliştirici yardımcılarını buradan yönetin.'],
    ['#page-history .settings-header h2', 'Arama Geçmişi'],
    ['#page-history .settings-header p', 'Geçmiş ilaç aramaları ve fiyat karşılaştırmaları.'],
    ['#page-order-plan .settings-header h2', 'Aktif Sipariş Planı'],
    ['#page-order-plan .settings-header p', 'Planınızdaki ürünleri, seçilen depoları ve maliyetleri detaylı inceleyin.'],
    ['#depotPanelTitle', 'Depo Adı'],
  ];

  textMap.forEach(([selector, value]) => {
    const el = document.querySelector(selector);
    if (!el) return;
    if (selector === '.hero h1') {
      el.innerHTML = 'En uygun ilacı<br><span class="hero-gradient">hızla bulun</span>';
      return;
    }
    el.textContent = value;
  });

  const homeInput = document.getElementById('homeSearchInput');
  if (homeInput) homeInput.placeholder = 'İlaç adı veya barkod girin...';

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = 'İlaç adı veya barkod...';

  const variantTitle = document.querySelector('.variant-layer-header h3');
  if (variantTitle) variantTitle.textContent = 'Farklı Ürün Formları';

  const historyLink = document.querySelector('.home-history-header .home-history-link');
  if (historyLink) historyLink.childNodes[0].textContent = 'Tümünü Gör ';

  const variantDesc = document.querySelector('.variant-layer-header p');
  if (variantDesc) {
    variantDesc.innerHTML = 'Aramanıza ait <span id="variantCount">...</span> farklı ürün formu bulundu. Hangi formu karşılaştırmak istiyorsunuz?';
  }

  const productLabel = document.querySelector('.product-label');
  if (productLabel) productLabel.textContent = 'Arama Sonuçları';

  const stockTrigger = document.getElementById('stockCalcTrigger');
  if (stockTrigger) stockTrigger.title = 'Stok Hesaplayıcı';

  const stockFlyout = document.querySelector('.sc-flyout-title');
  if (stockFlyout) stockFlyout.textContent = 'Stok ve MF Hesaplayıcı';

  const bestBadge = document.querySelector('.best-badge');
  if (bestBadge) bestBadge.textContent = 'En Ucuz Teklif';

  const bestLabels = document.querySelectorAll('.best-value-label');
  if (bestLabels[0]) bestLabels[0].textContent = 'Birim Fiyat';
  if (bestLabels[1]) bestLabels[1].textContent = 'Kampanya / MF';
  if (bestLabels[2]) bestLabels[2].textContent = 'Stok Durumu';

  const actionEyebrow = document.querySelector('.action-panel-eyebrow');
  if (actionEyebrow) actionEyebrow.textContent = 'Hızlı İşlem';

  const actionTitle = document.querySelector('.action-panel-title');
  if (actionTitle) actionTitle.textContent = 'Ürün İşlemleri';

  const actionSubtitle = document.querySelector('.action-panel-subtitle');
  if (actionSubtitle) actionSubtitle.textContent = 'Ürünü plana ekleyin veya sabit listenize kaydedin.';

  const actionLabel = document.querySelector('.action-summary-label');
  if (actionLabel) actionLabel.textContent = 'Seçili Ürün';

  const actionTitlePrimary = document.querySelector('#addToPlanBtn .action-btn-title');
  if (actionTitlePrimary) actionTitlePrimary.textContent = 'Sipariş Planına Ekle';

  const actionSubPrimary = document.querySelector('#addToPlanBtn .action-btn-sub');
  if (actionSubPrimary) actionSubPrimary.textContent = 'Aktif plana eklenir';

  const actionTitleSecondary = document.querySelector('#addToRoutineBtn .action-btn-title');
  if (actionTitleSecondary) actionTitleSecondary.textContent = 'Sabit Listeye Ekle';

  const actionSubSecondary = document.querySelector('#addToRoutineBtn .action-btn-sub');
  if (actionSubSecondary) actionSubSecondary.textContent = 'Sonra tek tıkla aç';

  const otherHeader = document.querySelector('.others-header');
  if (otherHeader) {
    const title = otherHeader.querySelector('#otherDepotsTitle');
    if (title) {
      title.textContent = 'Depo Teklifleri';
    }
  }
}

// Not: applyHumanUiCopy() ve renderHomeDashboard() artık initApp() içinde çağrılıyor.
