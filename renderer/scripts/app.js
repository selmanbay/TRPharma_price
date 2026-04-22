/**
 * app.js
 * V2.3.1 clean modular orchestrator.
 * Owner modules render, calculate and act; bu dosya state, bridge ve event wiring tutar.
 */

const API_BASE = (typeof window !== 'undefined' && window.location?.origin)
  ? window.location.origin
  : 'http://127.0.0.1:3000';

const TOKEN_KEY = 'eczane.auth.token';
const USER_KEY = 'eczane.auth.user';
const STORAGE_KEYS = {
  orderPlan: 'eczane.orderPlan.v1',
  approvalQueue: 'eczane.approval.queue.v1',
};

const DEPOT_META = {
  selcuk: { label: 'Selçuk Ecza', badgeClass: 'selcuk' },
  nevzat: { label: 'Nevzat Ecza', badgeClass: 'nevzat' },
  alliance: { label: 'Alliance Healthcare', badgeClass: 'alliance' },
  'anadolu-pharma': { label: 'Anadolu Pharma', badgeClass: 'pharma' },
  'anadolu-itriyat': { label: 'Anadolu İtriyat', badgeClass: 'itriyat' },
  sentez: { label: 'Sentez B2B', badgeClass: 'sentez' },
};

const DEPOT_FORMS = {
  selcuk: {
    title: 'Selcuk Ecza',
    fields: [
      { id: 'hesapKodu', label: 'Hesap Kodu' },
      { id: 'kullaniciAdi', label: 'Kullanici Adi' },
      { id: 'sifre', label: 'Sifre', type: 'password' },
    ],
  },
  nevzat: {
    title: 'Nevzat Ecza',
    fields: [
      { id: 'hesapKodu', label: 'Hesap Kodu' },
      { id: 'kullaniciAdi', label: 'Kullanici Adi' },
      { id: 'sifre', label: 'Sifre', type: 'password' },
    ],
  },
  'anadolu-pharma': {
    title: 'Anadolu Pharma',
    fields: [
      { id: 'kullaniciAdi', label: 'Kullanici Adi' },
      { id: 'sifre', label: 'Sifre', type: 'password' },
      { id: 'cariKod', label: 'Cari Kod' },
    ],
  },
  'anadolu-itriyat': {
    title: 'Anadolu Itriyat',
    fields: [
      { id: 'hesapKodu', label: 'Musteri Kodu' },
      { id: 'kullaniciAdi', label: 'Kullanici Adi' },
      { id: 'sifre', label: 'Sifre', type: 'password' },
    ],
  },
  alliance: {
    title: 'Alliance Healthcare',
    fields: [
      { id: 'hesapKodu', label: 'Link Kodu' },
      { id: 'kullaniciAdi', label: 'Kullanici Adi' },
      { id: 'sifre', label: 'Sifre', type: 'password' },
    ],
  },
  sentez: {
    title: 'Sentez B2B',
    fields: [
      { id: 'kullaniciAdi', label: 'Kullanici Adi' },
      { id: 'sifre', label: 'Sifre', type: 'password' },
    ],
  },
};

function resolveDepotIdentity(value = '') {
  const bridge = getOperationIdentityBridge();
  if (bridge?.resolveDepotIdentity) {
    return bridge.resolveDepotIdentity(value, {
      depotMeta: DEPOT_META,
    });
  }
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (DEPOT_META[normalized]) return normalized;
  const hit = Object.entries(DEPOT_META).find(([depotId, meta]) => {
    const label = String(meta?.label || '').trim().toLowerCase();
    return depotId === normalized || label === normalized;
  });
  return hit ? hit[0] : raw;
}

function matchesDepotIdentity(item, depotToken = '') {
  const bridge = getOperationIdentityBridge();
  if (bridge?.matchesDepotIdentity) {
    return bridge.matchesDepotIdentity(item, depotToken, {
      depotMeta: DEPOT_META,
      isBarcodeQuery,
    });
  }
  const target = resolveDepotIdentity(depotToken);
  if (!target) return true;
  const itemDepotId = resolveDepotIdentity(item?.depotId || '');
  const itemDepotName = resolveDepotIdentity(item?.depot || '');
  return itemDepotId === target || itemDepotName === target;
}

function matchesPlanIdentity(item, key, depotToken = '', extraDeps = {}) {
  const bridge = getOperationIdentityBridge();
  if (bridge?.matchesPlanIdentity) {
    return bridge.matchesPlanIdentity(item, key, depotToken, {
      depotMeta: DEPOT_META,
      isBarcodeQuery,
      normalizeProductBarcode,
      ...extraDeps,
    });
  }
  const searchBarcode = String(extraDeps?.barcode || extraDeps?.queryBarcode || '').trim();
  const keyCandidates = buildPlanKeyCandidates(key, searchBarcode);
  const itemKey = String(item?.key || '').trim();
  if (!itemKey || !keyCandidates.has(itemKey)) return false;
  return matchesDepotIdentity(item, depotToken);
}

function findPlanItemByIdentity(key, depotToken = '') {
  const bridge = getOperationIdentityBridge();
  if (bridge?.findPlanItemByIdentity) {
    return bridge.findPlanItemByIdentity(key, depotToken, {
      depotMeta: DEPOT_META,
      isBarcodeQuery,
      normalizeProductBarcode,
      getOrderPlan,
    });
  }
  return getOrderPlan().find((item) => matchesPlanIdentity(item, key, depotToken)) || null;
}

const SEARCH_RENDER_BATCH_MS = 120;
const MIN_GATHER_TIME_MS = 1500;

const state = {
  currentPage: 'login',
  authMode: 'login',
  user: null,
  config: null,
  history: [],
  searchQuery: '',
  searchGroups: [],
  currentVariantKey: '',
  currentDetailItems: [],
  currentDetailQuery: '',
  selectedOfferKey: '',
  desiredQty: 1,
  bulkInput: '',
  bulkRows: [],
  bulkSearchRunId: 0,
  bulkDetailContext: null,
  planViewMode: 'drug',
  planApprovalMode: false,
  planApprovalScope: null,
  approvalQueue: [],
  approvalSelection: [],
  planDrawerKey: '',
  bulkDrawerIndex: -1,
  searchAbortController: null,
  suggestionAbortController: null,
  searchRunId: 0,
  suggestionRunId: 0,
  searchLoading: false,
  searchDrafting: false,
  searchDraftQuery: '',
  searchError: '',
  mfCalculatorOpen: false,
  detailPlanSummaryExpanded: false,
  appVersion: '',
  updateStatus: '',
  depotEntities: [],
};

let pendingSearchRenderTimer = null;
const domainBridge = {
  ready: false,
  loading: false,
  DrugEntity: null,
  DrugOperationEntity: null,
  DepotEntity: null,
  OrderDataEngine: null,
  UserEntity: null,
};

async function bootstrapDomainBridge() {
  if (domainBridge.ready || domainBridge.loading) return;
  domainBridge.loading = true;
  try {
    const [drugMod, operationMod, depotMod, orderMod, userMod] = await Promise.all([
      import('../src/domain/DrugEntity.js'),
      import('../src/domain/DrugOperationEntity.js'),
      import('../src/domain/DepotEntity.js'),
      import('../src/domain/OrderDataEngine.js'),
      import('../src/domain/UserEntity.js'),
    ]);
    domainBridge.DrugEntity = drugMod?.DrugEntity || null;
    domainBridge.DrugOperationEntity = operationMod?.DrugOperationEntity || null;
    domainBridge.DepotEntity = depotMod?.DepotEntity || null;
    domainBridge.OrderDataEngine = orderMod?.OrderDataEngine || null;
    domainBridge.UserEntity = userMod?.UserEntity || null;
    domainBridge.ready = Boolean(
      domainBridge.DrugEntity
      && domainBridge.DrugOperationEntity
      && domainBridge.DepotEntity
      && domainBridge.OrderDataEngine
      && domainBridge.UserEntity
    );
    if (!domainBridge.ready) {
      console.warn('[v2.3-domain] Domain bridge loaded partially, fallback mode active.');
    }
  } catch (error) {
    console.warn('[v2.3-domain] Domain bridge unavailable, using legacy helpers:', error?.message || error);
  } finally {
    domainBridge.loading = false;
  }
}

function normalizeUserModel(rawUser) {
  const bridgeUser = domainBridge.UserEntity;
  if (bridgeUser) {
    try {
      return new bridgeUser(rawUser || {});
    } catch (error) {
      console.warn('[v2.3-domain] UserEntity normalization fallback:', error?.message || error);
    }
  }
  return {
    ...(rawUser || {}),
    id: rawUser?.id || 'local_user',
    name: rawUser?.displayName || rawUser?.name || 'Eczane',
    displayName: rawUser?.displayName || rawUser?.name || 'Eczane',
    role: rawUser?.role || 'pharmacist',
    permissions: rawUser?.permissions || [],
  };
}

function createDrugOperationEntity(rawData, options = {}) {
  const OperationEntity = domainBridge.DrugOperationEntity;
  if (OperationEntity) {
    try {
      return new OperationEntity(rawData || {}, options);
    } catch (error) {
      console.warn('[v2.3-domain] DrugOperationEntity fallback:', error?.message || error);
    }
  }
  return null;
}

function mapMfModel(mfStr) {
  const orderEngine = domainBridge.OrderDataEngine;
  if (orderEngine?.parseMf) {
    try {
      const parsed = orderEngine.parseMf(mfStr);
      if (!parsed) return null;
      return {
        buy: Number(parsed.buy) || 0,
        free: Number(parsed.free ?? parsed.get) || 0,
        total: Number(parsed.total) || 0,
      };
    } catch (error) {
      console.warn('[v2.3-domain] OrderDataEngine.parseMf fallback:', error?.message || error);
    }
  }
  return parseMf(mfStr);
}

function extractConfiguredDepotEntities(config) {
  const bridgeDepot = domainBridge.DepotEntity;
  if (!bridgeDepot) return [];
  const available = config?.availableDepots || {};
  const depots = config?.depots || {};
  return Object.entries(available).map(([depotId, availableInfo]) => {
    const merged = { ...availableInfo, ...(depots[depotId] || {}) };
    try {
      return new bridgeDepot(depotId, merged);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function esc(value) {
  if (value == null) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function getToken() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.getToken) return bridge.getToken(TOKEN_KEY);
  return sessionStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.getStoredUser) return bridge.getStoredUser(USER_KEY);
  return null;
}

function setSession(token, user) {
  const bridge = getAppRuntimeBridge();
  if (bridge?.setSession) return bridge.setSession(TOKEN_KEY, USER_KEY, token, user);
  return undefined;
}

function clearSession() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.clearSession) return bridge.clearSession(TOKEN_KEY, USER_KEY);
  return undefined;
}

function authFetch(url, options = {}) {
  const bridge = getAppRuntimeBridge();
  if (bridge?.authFetch) {
    return bridge.authFetch(url, options, {
      getToken,
    });
  }
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}

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

let persistClientStateTimer = null;

async function persistClientStateNow() {
  if (!state.user) return;
  try {
    const orderPlan = readStoredJson(STORAGE_KEYS.orderPlan, []);
    const approvalQueue = readStoredJson(STORAGE_KEYS.approvalQueue, []);
    await authFetch(`${API_BASE}/api/client-state`, {
      method: 'PUT',
      body: JSON.stringify({
        orderPlan,
        approvalQueue,
      }),
    });
  } catch (error) {
    console.warn('[v2.3.1] Client state persistence failed:', error?.message || error);
  }
}

function schedulePersistClientState() {
  if (persistClientStateTimer) clearTimeout(persistClientStateTimer);
  persistClientStateTimer = setTimeout(() => {
    persistClientStateTimer = null;
    persistClientStateNow();
  }, 120);
}

async function hydratePersistentClientState() {
  if (!state.user) return;
  try {
    const res = await authFetch(`${API_BASE}/api/client-state`);
    if (!res.ok) return;
    const data = await res.json();
    writeStoredJson(STORAGE_KEYS.orderPlan, Array.isArray(data?.orderPlan) ? data.orderPlan : []);
    writeStoredJson(STORAGE_KEYS.approvalQueue, Array.isArray(data?.approvalQueue) ? data.approvalQueue : []);
    state.approvalQueue = getApprovalQueue();
    synchronizeRuntimeOperationState();
    updateNavSummary();
    if (state.currentPage !== 'login') renderCurrentPage();
  } catch (error) {
    console.warn('[v2.3.1] Client state hydrate failed:', error?.message || error);
  }
}

function normalizeAlternativeItems(items, fallback = {}) {
  return (items || []).map((item) => ({
    ...item,
    key: fallback.key || item?.key || item?.barcode || item?.barkod || item?.ad || '',
    barcode: item?.barcode || item?.barkod || fallback.barcode || '',
    name: item?.name || item?.ad || fallback.name || '',
    depot: item?.depot || fallback.depot || '',
    depotId: item?.depotId || fallback.depotId || '',
    fiyatNum: Number(item?.fiyatNum) || Number(item?.unitPrice) || 0,
    unitPrice: Number(item?.unitPrice) || Number(item?.fiyatNum) || 0,
    mfStr: String(item?.mfStr || item?.malFazlasi || item?.MalFazlasi || '').trim(),
    depotUrl: item?.depotUrl || '',
  })).filter((item) => item.depotId || item.depot);
}

function normalizePlanItem(item) {
  let barcode = String(item?.barcode || item?.barkod || '').trim();
  if (!barcode && typeof extractBarcode === 'function') {
    const fromKodu = extractBarcode(item?.kodu);
    if (fromKodu) barcode = String(fromKodu).trim();
  }
  if (barcode && typeof normalizeProductBarcode === 'function') {
    const nb = String(normalizeProductBarcode(barcode) || '').trim();
    if (nb) barcode = nb;
  }
  const key = barcode && isBarcodeQuery(barcode) ? barcode : String(item?.key || item?.name || item?.ad || '').trim();
  if (!key) return null;

  const alternatives = normalizeAlternativeItems(item?.alternatives, {
    key,
    barcode,
    name: item?.name || item?.ad || key,
  });
  const operationEntity = createDrugOperationEntity({
    ...item,
    key,
    barcode,
    alternatives,
    mfStr: String(item?.mfStr || item?.malFazlasi || item?.MalFazlasi || item?.overage || item?.Overage || '').trim(),
    operationSource: item?.operationSource || 'plan',
  }, {
    source: 'plan',
    key,
    sourceQuery: item?.sourceQuery || '',
  });

  if (operationEntity?.toPlanItem) {
    return operationEntity.toPlanItem();
  }

  const desiredQty = Math.max(parseInt(item?.desiredQty, 10) || 1, 1);
  const effectiveUnit = Number(item?.effectiveUnit) || Number(item?.unitPrice) || Number(item?.fiyatNum) || 0;
  const totalCost = Number(item?.totalCost) || (effectiveUnit > 0 ? effectiveUnit * desiredQty : 0);

  return {
    ...item,
    key,
    barcode,
    alternatives,
    desiredQty,
    orderQty: Math.max(parseInt(item?.orderQty, 10) || desiredQty, 1),
    receiveQty: Math.max(parseInt(item?.receiveQty, 10) || desiredQty, 1),
    effectiveUnit,
    totalCost,
    psf: Number(item?.psf) || Number(item?.psfFiyatNum) || 0,
    psfFiyatNum: Number(item?.psfFiyatNum) || Number(item?.psf) || 0,
    psfFiyat: String(item?.psfFiyat || '').trim(),
  };
}

function getOrderPlan() {
  const items = readStoredJson(STORAGE_KEYS.orderPlan, [])
    .map(normalizePlanItem)
    .filter(Boolean);
  const map = new Map();
  for (const item of items) {
    const depotPart = resolveDepotIdentity(item.depotId || item.depot || '');
    map.set(`${item.key}::${depotPart}`, item);
  }
  return Array.from(map.values());
}

function saveOrderPlan(items) {
  writeStoredJson(STORAGE_KEYS.orderPlan, (items || []).map(normalizePlanItem).filter(Boolean));
  synchronizeRuntimeOperationState();
  schedulePersistClientState();
}

function buildPlanKeyCandidates(key = '', barcode = '') {
  const bridge = getOperationIdentityBridge();
  if (bridge?.buildPlanKeyCandidates) {
    return bridge.buildPlanKeyCandidates(key, barcode, {
      isBarcodeQuery,
    });
  }
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
    } else if (isBarcodeQuery(rawKey)) {
      candidates.add(`BARCODE_${rawKey}`);
    }
  }

  if (rawBarcode) {
    candidates.add(rawBarcode);
    candidates.add(`BARCODE_${rawBarcode}`);
  }

  return candidates;
}

function isPlanEntryPresent(key, depotId = '', depot = '', planItems = null, barcode = '') {
  const bridge = getOperationIdentityBridge();
  if (bridge?.isPlanEntryPresent) {
    return bridge.isPlanEntryPresent({
      key,
      depotId,
      depot,
      planItems,
      barcode,
    }, {
      getOrderPlan,
      isBarcodeQuery,
      normalizeProductBarcode,
      depotMeta: DEPOT_META,
    });
  }
  const keyCandidates = buildPlanKeyCandidates(key, barcode);
  if (!keyCandidates.size) return false;
  const targetDepotId = String(depotId || '').trim();
  const targetDepotName = String(depot || '').trim();
  const plan = planItems || getOrderPlan();

  const wantedNorm = String(barcode || '').trim()
    ? String(normalizeProductBarcode(barcode) || '').trim()
    : '';

  return plan.some((item) => {
    const itemBcRaw = String(item.barcode || item.barkod || '').trim();
    const itemNorm = itemBcRaw ? String(normalizeProductBarcode(itemBcRaw) || '').trim() : '';
    if (wantedNorm && itemNorm && wantedNorm === itemNorm) {
      if (!targetDepotId && !targetDepotName) return true;
      return matchesDepotIdentity(item, targetDepotId || targetDepotName);
    }

    const itemKey = String(item.key || '').trim();
    const keyHit = Boolean(itemKey && keyCandidates.has(itemKey));
    if (!keyHit) return false;
    const itemDepotId = String(item.depotId || '').trim();
    const itemDepotName = String(item.depot || '').trim();

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

function getPlanSnapshotForIdentity(key, depotId = '', depot = '', barcode = '', planItems = null) {
  const bridge = getOperationStateBridge();
  if (bridge?.getPlanSnapshotForIdentity) {
    return bridge.getPlanSnapshotForIdentity(
      { key, depotId, depot, barcode, planItems },
      { buildPlanKeyCandidates, matchesDepotIdentity, getOrderPlan, normalizeProductBarcode, isBarcodeQuery }
    );
  }
  return null;
}

function resolveOperationStateForItem(item, fallbackKey = '', options = {}) {
  const bridge = getOperationStateBridge();
  if (bridge?.resolveOperationStateForItem) {
    return bridge.resolveOperationStateForItem(item, {
      fallbackKey,
      planItems: options?.planItems || null,
      resolvedBarcode: options?.resolvedBarcode || '',
    }, {
      getPlanSnapshotForIdentity: (payload) => getPlanSnapshotForIdentity(
        payload?.key,
        payload?.depotId,
        payload?.depot,
        payload?.barcode,
        payload?.planItems
      ),
    });
  }
  return {
    inPlan: Boolean(item?.inPlan),
    desiredQty: Math.max(parseInt(item?.planQty ?? item?.desiredQty, 10) || 0, 0),
    approvalStatus: String(item?.approvalStatus || '').trim(),
    approvedAt: String(item?.approvedAt || '').trim(),
    isApproved: String(item?.approvalStatus || '').trim() === 'approved',
  };
}

function resolveGroupOperationState(group) {
  const bridge = getOperationStateBridge();
  if (bridge?.resolveGroupOperationState) {
    return bridge.resolveGroupOperationState(group, {
      resolveOperationStateForItem: (item, options) => resolveOperationStateForItem(item, options?.fallbackKey || '', options || {}),
    });
  }
  return { inPlan: false, isApproved: false, desiredQty: 0, inPlanCount: 0 };
}

function renderOperationStateBadges(operationState = {}, options = {}) {
  const bridge = getOperationStateBridge();
  if (bridge?.renderOperationStateBadges) {
    return bridge.renderOperationStateBadges(operationState, options);
  }
  return '';
}

function synchronizeSearchItemOperationState(item, fallbackKey = '', options = {}) {
  const bridge = getOperationStateBridge();
  if (bridge?.synchronizeSearchItemOperationState) {
    return bridge.synchronizeSearchItemOperationState(item, fallbackKey, options, {
      resolveOperationStateForItem: (entry, stateOptions) => resolveOperationStateForItem(
        entry,
        stateOptions?.fallbackKey || fallbackKey || '',
        stateOptions || {}
      ),
      createDrugOperationEntity,
      state,
    });
  }
  return item;
}

function synchronizeRuntimeOperationState() {
  const bridge = getOperationStateBridge();
  if (!bridge?.synchronizeRuntimeOperationState) return;
  const synced = bridge.synchronizeRuntimeOperationState({
    searchGroups: state.searchGroups,
    currentDetailItems: state.currentDetailItems,
    bulkRows: state.bulkRows,
  }, {
    getOrderPlan,
    sortDepotItems,
    getOfferKey,
    currentVariantKey: state.currentVariantKey || '',
    synchronizeSearchItemOperationState,
  });
  if (!synced) return;
  state.searchGroups = Array.isArray(synced.searchGroups) ? synced.searchGroups : state.searchGroups;
  state.currentDetailItems = Array.isArray(synced.currentDetailItems) ? synced.currentDetailItems : state.currentDetailItems;
  state.bulkRows = Array.isArray(synced.bulkRows) ? synced.bulkRows : state.bulkRows;
}

function normalizeApprovalItem(item) {
  if (!item) return null;
  let barcode = String(item.barcode || item.barkod || '').trim();
  if (!barcode && typeof extractBarcode === 'function') {
    const fromKodu = extractBarcode(item?.kodu);
    if (fromKodu) barcode = String(fromKodu).trim();
  }
  if (barcode && typeof normalizeProductBarcode === 'function') {
    const nb = String(normalizeProductBarcode(barcode) || '').trim();
    if (nb) barcode = nb;
  }
  const key = barcode && isBarcodeQuery(barcode)
    ? barcode
    : String(item.key || item.barcode || item.name || '').trim();
  const depotId = resolveDepotIdentity(item.depotId || item.depot || '');
  if (!key || !depotId) return null;

  const operationEntity = createDrugOperationEntity({
    ...item,
    key,
    barcode,
    depotId,
    approvalStatus: item.approvalStatus || 'approved',
    approvedAt: item.approvedAt || new Date().toISOString(),
    operationSource: item?.operationSource || 'approval',
  }, {
    source: 'approval',
    key,
  });

  if (operationEntity?.toApprovalItem) {
    return {
      ...operationEntity.toApprovalItem(),
      addedAt: item.addedAt || new Date().toISOString(),
    };
  }

  return {
    key,
    barcode: barcode || String(item.barcode || item.barkod || '').trim(),
    name: String(item.name || item.ad || item.key || '').trim(),
    depot: String(item.depot || DEPOT_META[depotId]?.label || depotId).trim(),
    depotId,
    desiredQty: Math.max(parseInt(item.desiredQty, 10) || 1, 1),
    totalCost: Number(item.totalCost) || 0,
    unitCost: Number(item.effectiveUnit) || Number(item.unitCost) || 0,
    psf: Number(item?.psf) || Number(item?.psfFiyatNum) || 0,
    psfFiyatNum: Number(item?.psfFiyatNum) || Number(item?.psf) || 0,
    depotUrl: String(item.depotUrl || '').trim(),
    addedAt: item.addedAt || new Date().toISOString(),
  };
}

function getApprovalQueue() {
  return readStoredJson(STORAGE_KEYS.approvalQueue, [])
    .map(normalizeApprovalItem)
    .filter(Boolean);
}

function saveApprovalQueue(items) {
  writeStoredJson(STORAGE_KEYS.approvalQueue, (items || []).map(normalizeApprovalItem).filter(Boolean));
  state.approvalQueue = getApprovalQueue();
  synchronizeRuntimeOperationState();
  schedulePersistClientState();
}

function upsertApprovalFromPlanItem(planItem) {
  const normalized = normalizeApprovalItem(planItem);
  if (!normalized) return;
  const queue = getApprovalQueue();
  const next = queue.filter((item) => !(
    samePlanLineKey(item.key, normalized.key)
    && resolveDepotIdentity(item.depotId || item.depot || '') === resolveDepotIdentity(normalized.depotId || '')
  ));
  next.push({
    ...normalized,
    addedAt: normalized.addedAt || new Date().toISOString(),
  });
  saveApprovalQueue(next);
}

function removeApprovalQueueEntry(key, depotId = '') {
  const queue = getApprovalQueue();
  saveApprovalQueue(queue.filter((item) => !(matchesPlanIdentity(item, key, depotId))));
  const normalizedDepotId = resolveDepotIdentity(depotId);
  state.approvalSelection = (state.approvalSelection || []).filter((entry) => entry !== `${key}::${normalizedDepotId}`);
}

function renderPlanSurfaces(options = {}) {
  const { includeDrawer = true, forcePage = false } = options;
  if (forcePage || state.currentPage === 'plan') {
    renderPlanPageV2();
  }
  if (includeDrawer && state.planDrawerKey) {
    renderPlanDrawer(state.planDrawerKey);
  }
}

function renderCurrentOperationSurface() {
  const bridge = getPlanMutationBridge();
  if (bridge?.renderCurrentOperationSurface) {
    bridge.renderCurrentOperationSurface({ state }, {
      renderVariantsPage,
      renderDetailPage,
      renderBulkPage,
    });
    return;
  }
}

function finalizePlanMutation(options = {}) {
  const bridge = getPlanMutationBridge();
  if (bridge?.finalizePlanMutation) {
    bridge.finalizePlanMutation({ state }, {
      updateNavSummary,
      renderPlanSurfaces,
      renderBulkDrawer,
      renderVariantsPage,
      renderDetailPage,
      renderBulkPage,
    }, options || {});
    return;
  }
}

function upsertPlanOperationItem(item) {
  const bridge = getPlanMutationBridge();
  if (bridge?.upsertPlanOperationItem) {
    return bridge.upsertPlanOperationItem(item, {
      normalizePlanItem,
      getOrderPlan,
      saveOrderPlan,
    });
  }
  return null;
}

function isSamePlanRecordForMutation(item, key, depotToken = '') {
  return samePlanLineKey(item?.key, key)
    && resolveDepotIdentity(item?.depotId || item?.depot || '') === resolveDepotIdentity(depotToken || '');
}

function patchPlanOperationItem(key, depotId, patch) {
  const bridge = getPlanMutationBridge();
  if (bridge?.patchPlanOperationItem) {
    return bridge.patchPlanOperationItem(key, depotId, patch, {
      normalizePlanItem,
      getOrderPlan,
      saveOrderPlan,
      isSamePlanRecord: isSamePlanRecordForMutation,
    });
  }
  return null;
}

function deletePlanOperationItem(key, depotId) {
  const bridge = getPlanMutationBridge();
  if (bridge?.deletePlanOperationItem) {
    return bridge.deletePlanOperationItem(key, depotId, {
      getOrderPlan,
      saveOrderPlan,
      isSamePlanRecord: isSamePlanRecordForMutation,
    });
  }
  return null;
}

function queuePlanItemForApproval(key, depotId = '') {
  const planItem = findPlanItemByIdentity(key, depotId);
  if (!planItem) return;
  const resolvedDepot = planItem.depotId || planItem.depot || depotId || '';
  const updatedPlanItem = patchPlanOperationItem(planItem.key, resolvedDepot, {
    approvalStatus: 'approved',
    approvedAt: new Date().toISOString(),
  });
  if (updatedPlanItem) {
    upsertApprovalFromPlanItem(updatedPlanItem);
  } else {
    upsertApprovalFromPlanItem({
      ...planItem,
      approvalStatus: 'approved',
      approvedAt: new Date().toISOString(),
    });
  }
  finalizePlanMutation();
}

function removePlanApproval(key, depotId = '') {
  patchPlanOperationItem(key, depotId, {
    approvalStatus: '',
    approvedAt: '',
  });
  removeApprovalQueueEntry(key, depotId);
  finalizePlanMutation();
}

function removeApprovalItem(key, depotId = '') {
  removeApprovalQueueEntry(key, depotId);
  patchPlanOperationItem(key, depotId, {
    approvalStatus: '',
    approvedAt: '',
  });
  finalizePlanMutation();
}

function getApprovalSelectionKey(item) {
  const key = String(item?.key || '').trim();
  const depotId = resolveDepotIdentity(item?.depotId || item?.depot || '');
  return `${key}::${depotId}`;
}

/** Plan / onay satirlari: barkod PK — ham key, BARCODE_ prefix veya normalize GTIN eslesir. */
function samePlanLineKey(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.startsWith('BARCODE_') && right === left.slice('BARCODE_'.length).trim()) return true;
  if (right.startsWith('BARCODE_') && left === right.slice('BARCODE_'.length).trim()) return true;
  if (typeof normalizeProductBarcode === 'function') {
    const na = String(normalizeProductBarcode(left) || '').trim();
    const nb = String(normalizeProductBarcode(right) || '').trim();
    if (na && nb && na === nb) return true;
  }
  return false;
}

function getApprovalItemsForCurrentView() {
  const queue = getApprovalQueue();
  if (!state.planApprovalScope) return queue;
  const scope = state.planApprovalScope;
  const scopeDepot = scope.depotId ? resolveDepotIdentity(scope.depotId) : '';
  return queue.filter((item) => {
    if (!samePlanLineKey(item.key, scope.key)) return false;
    if (!scopeDepot) return true;
    return resolveDepotIdentity(item.depotId || item.depot || '') === scopeDepot;
  });
}

function toggleApprovalSelection(key, depotId = '') {
  const k = String(key || '').trim();
  const depot = resolveDepotIdentity(depotId || '');
  const target = `${k}::${depot}`;
  const next = new Set(state.approvalSelection || []);
  if (next.has(target)) next.delete(target);
  else next.add(target);
  state.approvalSelection = Array.from(next);
  renderPlanSurfaces();
}

function setApprovalSelectionAll(value) {
  if (!value) {
    state.approvalSelection = [];
    renderPlanSurfaces();
    return;
  }
  state.approvalSelection = getApprovalItemsForCurrentView().map(getApprovalSelectionKey);
  renderPlanSurfaces();
}

function completeApprovalSelection() {
  const selectedKeys = new Set(state.approvalSelection || []);
  if (!selectedKeys.size) return;

  const queue = getApprovalQueue();
  const selectedItems = queue.filter((item) => selectedKeys.has(getApprovalSelectionKey(item)));
  if (!selectedItems.length) return;

  selectedItems.forEach((item, index) => {
    setTimeout(() => openPlanInDepot(item.key, item.depotId), index * 120);
  });

  const nextQueue = queue.filter((item) => !selectedKeys.has(getApprovalSelectionKey(item)));
  saveApprovalQueue(nextQueue);
  state.approvalSelection = [];
  state.planApprovalMode = false;
  state.planApprovalScope = null;
  finalizePlanMutation({
    forcePlan: true,
  });
}

function addPlanItem(item) {
  return upsertPlanOperationItem(item);
}

function updatePlanItem(key, depotId, patch) {
  return patchPlanOperationItem(key, depotId, patch);
}

function removePlanItem(key, depotId) {
  return deletePlanOperationItem(key, depotId);
}

function getDepotMeta(depotId) {
  return DEPOT_META[depotId] || { label: depotId || 'Depo', badgeClass: '' };
}

function depotBadgeHtml(depotId, labelOverride) {
  const meta = getDepotMeta(depotId);
  return `<span class="depot-label ${esc(meta.badgeClass)}"><span class="depot-dot"></span>${esc(labelOverride || meta.label)}</span>`;
}

function sortDepotItems(items) {
  const bridge = getSearchDomainBridge();
  if (bridge?.sortDepotItems) return bridge.sortDepotItems(items);
  return (items || []).slice().sort((a, b) => {
    const aPrice = Number(a?.fiyatNum) || Number.MAX_SAFE_INTEGER;
    const bPrice = Number(b?.fiyatNum) || Number.MAX_SAFE_INTEGER;
    if (aPrice !== bPrice) return aPrice - bPrice;
    const aStock = Number(a?.stok) || 0;
    const bStock = Number(b?.stok) || 0;
    return bStock - aStock;
  });
}

function getItemBarcode(item, fallbackQuery = '') {
  const bridge = getSearchDomainBridge();
  if (bridge?.getItemBarcode) {
    return bridge.getItemBarcode(item, fallbackQuery, {
      extractBarcode,
      parseQRCode,
      isBarcodeQuery,
    });
  }
  return String(item?.barkod || '').trim();
}

function getBarcodeHints(items, fallbackQuery = '') {
  const bridge = getSearchDomainBridge();
  if (bridge?.getBarcodeHints) {
    return bridge.getBarcodeHints(items, fallbackQuery, {
      extractBarcode,
      parseQRCode,
      isBarcodeQuery,
      normalizeDrugName,
      fixMojibakeText,
    });
  }
  return new Map();
}

function resolveItemBarcode(item, barcodeHints, fallbackQuery = '') {
  const bridge = getSearchDomainBridge();
  if (bridge?.resolveItemBarcode) {
    return bridge.resolveItemBarcode(item, barcodeHints, fallbackQuery, {
      extractBarcode,
      parseQRCode,
      isBarcodeQuery,
      normalizeDrugName,
      fixMojibakeText,
    });
  }
  return getItemBarcode(item, fallbackQuery);
}

function getItemIdentityKey(item, barcodeHints, fallbackQuery = '') {
  const bridge = getSearchDomainBridge();
  if (bridge?.getItemIdentityKey) {
    return bridge.getItemIdentityKey(item, barcodeHints, fallbackQuery, {
      extractBarcode,
      parseQRCode,
      isBarcodeQuery,
      normalizeDrugName,
      fixMojibakeText,
    });
  }
  return String(item?.entityId || '');
}

function chooseCanonicalProductName(items, fallbackName = '') {
  const bridge = getSearchDomainBridge();
  if (bridge?.chooseCanonicalProductName) return bridge.chooseCanonicalProductName(items, fallbackName);
  return fallbackName || 'Bilinmeyen Ilac';
}

function buildVariantGroups(items, query) {
  const bridge = getSearchDomainBridge();
  if (bridge?.buildVariantGroups) {
    return bridge.buildVariantGroups(items, query, {
      extractBarcode,
      parseQRCode,
      isBarcodeQuery,
      normalizeDrugName,
      fixMojibakeText,
    });
  }
  const sorted = sortDepotItems(items || []);
  return [{
    key: query || 'single',
    barcode: sorted.find((item) => item?.barkod)?.barkod || '',
    name: chooseCanonicalProductName(sorted, query),
    items: sorted,
    bestItem: sorted[0] || null,
  }];
}

function normalizeDepotItem(item, depotId, depotUrl) {
  const bridge = getSearchDomainBridge();
  if (bridge?.normalizeDepotItem) {
    return bridge.normalizeDepotItem({
      item,
      depotId,
      depotUrl,
      searchQuery: state.searchQuery || '',
    }, {
      DrugEntity: domainBridge.DrugEntity,
      createDrugOperationEntity,
      getPlanSnapshotForIdentity,
      getItemBarcode,
      formatCurrency,
      normalizeDrugName,
      fixMojibakeText,
      normalizeImageUrl,
      isUsableImageUrl,
      DEPOT_META,
    });
  }
  return { ...(item || {}), depotId, depotUrl };
}

async function fetchSetupStatus() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.fetchSetupStatus) return bridge.fetchSetupStatus();
  const res = await fetch('/api/auth/setup-status');
  return res.json();
}

async function login(password) {
  const bridge = getAppRuntimeBridge();
  if (bridge?.login) {
    const user = await bridge.login(password, {
      normalizeUserModel,
      setSession,
    });
    state.user = user;
    return user;
  }
  throw new Error('Login runtime bridge yok');
}

async function setup(displayName, password) {
  const bridge = getAppRuntimeBridge();
  if (bridge?.setup) {
    const user = await bridge.setup(displayName, password, {
      normalizeUserModel,
      setSession,
    });
    state.user = user;
    return user;
  }
  throw new Error('Setup runtime bridge yok');
}

async function ensureAuth() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.ensureAuth) {
    return bridge.ensureAuth({ state }, {
      fetchSetupStatus,
      getToken,
      authFetch,
      clearSession,
      normalizeUserModel,
      getStoredUser,
      renderLoginPage,
      switchMock,
    });
  }
  return false;
}

async function loadAppMeta() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.loadAppMeta) {
    return bridge.loadAppMeta({ state }, {
      electronAPI: window.electronAPI,
      renderSettingsPage,
    });
  }
  return undefined;
}

async function loadConfig() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.loadConfig) {
    return bridge.loadConfig({ state }, {
      API_BASE,
      authFetch,
      extractConfiguredDepotEntities,
      updateNavSummary,
    });
  }
  throw new Error('Config runtime bridge yok');
}

async function loadHistory(limit = 20) {
  const bridge = getAppRuntimeBridge();
  if (bridge?.loadHistory) {
    return bridge.loadHistory({ state }, {
      API_BASE,
      authFetch,
    }, limit);
  }
  throw new Error('History runtime bridge yok');
}

function configuredDepotIds() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.configuredDepotIds) {
    return bridge.configuredDepotIds({ state }, { depotMeta: DEPOT_META });
  }
  return [];
}

function normalizeDepotResults(data, depotId) {
  const bridge = getSearchDomainBridge();
  if (bridge?.normalizeDepotResults) {
    return bridge.normalizeDepotResults(data, depotId, {
      searchQuery: state.searchQuery || '',
      DrugEntity: domainBridge.DrugEntity,
      createDrugOperationEntity,
      getPlanSnapshotForIdentity,
      formatCurrency,
      normalizeDrugName,
      fixMojibakeText,
      normalizeImageUrl,
      isUsableImageUrl,
      DEPOT_META,
    });
  }
  const depotUrl = data?.depotUrl || '';
  return (data?.results || []).map((item) => normalizeDepotItem(item, depotId, depotUrl));
}

async function searchDepot(depotId, query, options = {}) {
  const bridge = getSearchDomainBridge();
  if (bridge?.searchDepot) {
    return bridge.searchDepot({
      depotId,
      query,
      signal: options.signal,
    }, {
      API_BASE,
      authFetch,
      searchQuery: state.searchQuery || '',
      DrugEntity: domainBridge.DrugEntity,
      createDrugOperationEntity,
      getPlanSnapshotForIdentity,
      formatCurrency,
      normalizeDrugName,
      fixMojibakeText,
      normalizeImageUrl,
      isUsableImageUrl,
      DEPOT_META,
    });
  }
  return { depotId, results: [], error: 'Search domain bridge yok' };
}

async function searchAcrossDepotsProgressive(query, options = {}) {
  const bridge = getSearchDomainBridge();
  if (bridge?.searchAcrossDepotsProgressive) {
    return bridge.searchAcrossDepotsProgressive({
      query,
      signal: options.signal,
      onDepotResult: options.onDepotResult,
    }, {
      configuredDepotIds,
      runConcurrent,
      API_BASE,
      authFetch,
      searchQuery: state.searchQuery || '',
      DrugEntity: domainBridge.DrugEntity,
      createDrugOperationEntity,
      getPlanSnapshotForIdentity,
      formatCurrency,
      normalizeDrugName,
      fixMojibakeText,
      normalizeImageUrl,
      isUsableImageUrl,
      DEPOT_META,
    });
  }
  return [];
}

async function searchAcrossDepots(query, options = {}) {
  const bridge = getSearchDomainBridge();
  if (bridge?.searchAcrossDepots) {
    return bridge.searchAcrossDepots({
      query,
      signal: options.signal,
      onDepotResult: options.onDepotResult,
    }, {
      configuredDepotIds,
      runConcurrent,
      API_BASE,
      authFetch,
      searchQuery: state.searchQuery || '',
      DrugEntity: domainBridge.DrugEntity,
      createDrugOperationEntity,
      getPlanSnapshotForIdentity,
      formatCurrency,
      normalizeDrugName,
      fixMojibakeText,
      normalizeImageUrl,
      isUsableImageUrl,
      DEPOT_META,
    });
  }
  return [];
}

async function fetchSuggestions(query) {
  if (state.suggestionAbortController) state.suggestionAbortController.abort();
  const requestId = ++state.suggestionRunId;
  state.suggestionAbortController = new AbortController();
  const res = await authFetch(`${API_BASE}/api/autocomplete?q=${encodeURIComponent(query)}`, {
    signal: state.suggestionAbortController.signal,
  });
  if (requestId !== state.suggestionRunId) return [];
  if (!res.ok) return [];
  const data = await res.json();
  if (requestId !== state.suggestionRunId) return [];
  return data.suggestions || [];
}

function updateNavSummary() {
  const bridge = getNavigationRuntimeBridge();
  if (bridge?.updateNavSummary) {
    return bridge.updateNavSummary({ state }, {
      getOrderPlan,
      configuredDepotIds,
      depotMeta: DEPOT_META,
      getStoredUser,
    });
  }
  return undefined;
}

function switchPage(pageId) {
  // Push current page to nav history for back button
  const prevId = state.currentPage;
  if (prevId && prevId !== pageId && prevId !== 'login') {
    window.__pageHistory = window.__pageHistory || [];
    window.__pageHistory.push(prevId);
  }

  // Save scroll position of outgoing page
  window.__scrollPositions = window.__scrollPositions || {};
  if (prevId) {
    const outgoing = document.getElementById(`page-${prevId}`);
    if (outgoing) window.__scrollPositions[prevId] = outgoing.scrollTop || 0;
  }

  const bridge = getNavigationRuntimeBridge();
  if (bridge?.switchPage) {
    bridge.switchPage(pageId, { state });
  } else {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const next = document.getElementById(`page-${pageId}`);
    if (next) {
      next.classList.add('active');
      next.scrollTop = window.__scrollPositions[pageId] || 0;
    }
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = pageId === 'login' ? 'none' : 'flex';
  }
  state.currentPage = pageId;

  // Show/hide global back button
  const backBtn = document.getElementById('globalBackButton');
  if (backBtn) {
    const hasHistory = (window.__pageHistory || []).length > 0;
    backBtn.style.display = hasHistory && pageId !== 'login' && pageId !== 'home' ? 'flex' : 'none';
  }
}

function formatStock(item) {
  if (!item) return '-';
  if (!item.stokVar) return 'Yok';
  return item.stok > 0 ? `${item.stok} adet` : 'Var';
}

function computePlanMetrics(plan) {
  const totalCost = plan.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  const depotCount = new Set(plan.map((item) => item.depotId || item.depot).filter(Boolean)).size;
  return { totalCost, depotCount };
}

function getPlanDomainBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23PlanDomain || null;
}

function getPlanUiBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23PlanUI || null;
}

function getOperationIdentityBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23OperationIdentity || null;
}

function getAppRuntimeBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23AppRuntime || null;
}

function getSearchDomainBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23SearchDomain || null;
}

function getOfferDomainBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23OfferDomain || null;
}

function getAppActionsBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23AppActions || null;
}

function getDetailActionsBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23DetailActions || null;
}

function getSearchUiBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23SearchUI || null;
}

function getBulkUiBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23BulkUI || null;
}

function getShellUiBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23ShellUI || null;
}

function getDetailUiBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23DetailUI || null;
}

function getOperationStateBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23OperationState || null;
}

function getPlanMutationBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23PlanMutations || null;
}

function getSecurityGuardsBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23SecurityGuards || null;
}

function getNavigationRuntimeBridge() {
  if (typeof window === 'undefined') return null;
  return window.V23NavigationRuntime || null;
}

function formatSearchHeading(query) {
  const clean = String(query || '').trim();
  if (!clean) return 'Arama Sonuçları';
  if (/^\d+$/.test(clean)) return clean;
  return clean.replace(/\b([A-Za-z])/g, (match) => match.toUpperCase());
}

function actionLink(label, action) {
  return `<button class="btn btn-ghost panel-link-btn" onclick="${action}"><span>${esc(label)}</span><span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></button>`;
}

function renderEmptyState({ variant = 'generic', title, body, ctaLabel = '', ctaAction = '' }) {
  const illustrations = {
    plan: `
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <rect x="16" y="14" width="48" height="52" rx="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M26 29H54" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M26 39H46" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M26 49H50" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="56" cy="48" r="5" stroke="var(--brand-500)" stroke-width="1.5"/>
      </svg>
    `,
    variants: `
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <circle cx="33" cy="33" r="14" stroke="currentColor" stroke-width="1.5"/>
        <path d="M43 43L56 56" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="58" cy="24" r="4" stroke="currentColor" stroke-width="1.5"/>
        <path d="M18 55L24 49L30 55" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    history: `
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <rect x="18" y="20" width="44" height="40" rx="8" stroke="currentColor" stroke-width="1.5"/>
        <path d="M28 16V26" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M52 16V26" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M18 32H62" stroke="currentColor" stroke-width="1.5"/>
        <path d="M28 42H34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M28 50H46" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `,
    generic: `
      <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <rect x="18" y="18" width="44" height="44" rx="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M28 40H52" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `,
  };

  return `
    <div class="empty-state ${variant === 'variants' ? 'variant-empty' : ''}">
      <div class="empty-state-illustration">${illustrations[variant] || illustrations.generic}</div>
      <div class="empty-state-title">${esc(title || 'Icerik bulunamadi')}</div>
      <div class="empty-state-body">${esc(body || '')}</div>
      ${ctaLabel && ctaAction ? `<button class="btn btn-outline mt-4" onclick="${ctaAction}">${esc(ctaLabel)}</button>` : ''}
    </div>
  `;
}

function renderVariantSkeletons() {
  return Array.from({ length: 3 }).map(() => `
    <div class="variant-item skeleton-row skeleton"></div>
  `).join('');
}

function formatPlanAltDepots(item) {
  const selectedDepotId = item?.depotId || item?.depot || '';
  const names = Array.from(new Set(
    (item?.alternatives || [])
      .filter((entry) => (entry.depotId || entry.depot) && (entry.depotId || entry.depot) !== selectedDepotId)
      .map((entry) => entry.depot || DEPOT_META[entry.depotId]?.label || entry.depotId)
      .filter(Boolean),
  ));
  if (!names.length) return '';
  return names.join(', ');
}

function renderSearchLoadingState(query) {
  const bridge = getSearchUiBridge();
  if (bridge?.renderSearchLoadingState) {
    return bridge.renderSearchLoadingState(query, {
      esc,
      formatSearchHeading,
    });
  }
  return '';
}

function renderSearchDraftState(query) {
  const bridge = getSearchUiBridge();
  if (bridge?.renderSearchDraftState) {
    return bridge.renderSearchDraftState(query, {
      esc,
      formatSearchHeading,
    });
  }
  return '';
}

function renderBulkDropzoneArt() {
  const bridge = getSearchUiBridge();
  if (bridge?.renderBulkDropzoneArt) {
    return bridge.renderBulkDropzoneArt();
  }
  return '';
}

function renderLoginPage() {
  const page = document.getElementById('page-login');
  if (!page) return;
  const shellUiBridge = getShellUiBridge();
  if (shellUiBridge?.renderLoginPage) {
    page.innerHTML = shellUiBridge.renderLoginPage({
      authMode: state.authMode,
      user: state.user,
    }, {
      esc,
    });
  } else {
    page.innerHTML = `<div class="home-wrapper">${renderEmptyState({ title: 'Shell UI modülü yüklenemedi', body: 'Lutfen login bridge durumunu kontrol et.' })}</div>`;
  }

  const submit = document.getElementById('loginSubmitButton');
  submit?.addEventListener('click', async () => {
    const errorEl = document.getElementById('loginErrorMessage');
    const password = document.getElementById('loginPasswordInput')?.value || '';
    errorEl.style.display = 'none';
    submit.disabled = true;
    try {
      if (state.authMode === 'setup') {
        const displayName = document.getElementById('setupDisplayNameInput')?.value?.trim() || 'Eczane';
        const password2 = document.getElementById('setupPasswordRepeatInput')?.value || '';
        if (!displayName) throw new Error('Eczane adi gerekli');
        if (password !== password2) throw new Error('Sifre tekrari uyusmuyor');
        await setup(displayName, password);
      } else {
        await login(password);
      }
      await bootstrapApp();
    } catch (error) {
      errorEl.textContent = error?.message || 'Islem basarisiz';
      errorEl.style.display = 'block';
    } finally {
      submit.disabled = false;
    }
  });
}

function renderHomePage() {
  const page = document.getElementById('page-home');
  if (!page) return;
  const plan = getOrderPlan();
  const metrics = computePlanMetrics(plan);
  const connected = configuredDepotIds().length;
  const healthPct = state.config ? Math.round((connected / Math.max(Object.keys(state.config.availableDepots || {}).length, 1)) * 100) : 0;
  const historyItems = state.history.slice(0, 6);
  const shellUiBridge = getShellUiBridge();
  if (shellUiBridge?.renderHomePage) {
    page.innerHTML = shellUiBridge.renderHomePage({
      user: state.user,
      history: state.history,
      plan,
      metrics,
      healthPct,
      historyItems,
    }, {
      esc,
      escJs,
      formatCurrency,
      actionLink,
      depotBadgeHtml,
      formatPlanAltDepots,
      renderEmptyState,
      formatHistory,
    });
    return;
  }
  page.innerHTML = `<div class="home-wrapper">${renderEmptyState({ title: 'Shell UI modülü yüklenemedi', body: 'Lutfen home bridge durumunu kontrol et.' })}</div>`;
}

function renderVariantsPage() {
  const page = document.getElementById('page-search-variants');
  if (!page) return;
  const bridge = getSearchUiBridge();
  if (bridge?.renderVariantsPage) {
    page.innerHTML = bridge.renderVariantsPage({
      searchLoading: state.searchLoading,
      searchDrafting: state.searchDrafting,
      searchQuery: state.searchQuery,
      searchDraftQuery: state.searchDraftQuery,
      searchError: state.searchError,
      searchGroups: state.searchGroups,
    }, {
      esc,
      escJs,
      formatSearchHeading,
      actionLink,
      resolveGroupOperationState,
      renderOperationStateBadges,
      formatCurrency,
      depotBadgeHtml,
      renderEmptyState,
      renderSearchLoadingState,
      renderSearchDraftState,
    });
    return;
  }
  page.innerHTML = `<div class="variant-list">${renderEmptyState({ variant: 'variants', title: 'UI modülü yüklenemedi', body: 'Search UI bridge bulunamadı.' })}</div>`;
}

function getSelectedDetailItem() {
  const bridge = getAppActionsBridge();
  if (bridge?.getSelectedDetailItem) {
    return bridge.getSelectedDetailItem({ state }, { sortDepotItems });
  }
  const sorted = sortDepotItems(state.currentDetailItems);
  return sorted.find((item) => getOfferKey(item) === state.selectedOfferKey) || sorted[0] || null;
}

function getOfferKey(item) {
  const bridge = getAppActionsBridge();
  if (bridge?.getOfferKey) return bridge.getOfferKey(item);
  return `${item?.depotId || item?.depot || ''}::${item?.kodu || item?.ad || ''}`;
}

function calculatePlanning(item, desiredQty) {
  const bridge = getOfferDomainBridge();
  if (bridge?.calculatePlanning) {
    return bridge.calculatePlanning(item, desiredQty, {
      orderEngine: domainBridge.OrderDataEngine,
      depotMeta: DEPOT_META,
      mapMfModel,
    });
  }
  const qty = Math.max(parseInt(desiredQty, 10) || 1, 1);
  const unitPrice = Number(item?.fiyatNum) || Number(item?.unitPrice) || 0;
  return {
    desiredQty: qty,
    orderQty: qty,
    receiveQty: qty,
    totalCost: unitPrice * qty,
    effectiveUnit: unitPrice,
    planningMode: 'unit',
  };
}

function getOfferDisplayName(item, fallbackName = '') {
  const bridge = getOfferDomainBridge();
  if (bridge?.getOfferDisplayName) {
    return bridge.getOfferDisplayName(item, fallbackName);
  }
  return item?.ad || item?.name || fallbackName || item?.key || '';
}

function getOfferDepotLabel(item) {
  const bridge = getOfferDomainBridge();
  if (bridge?.getOfferDepotLabel) {
    return bridge.getOfferDepotLabel(item, {
      depotMeta: DEPOT_META,
    });
  }
  return item?.depot || DEPOT_META[item?.depotId]?.label || item?.depotId || '';
}

function buildPlanPayloadFromOffer({
  item,
  key = '',
  desiredQty = 1,
  fallbackQuery = '',
  alternatives = [],
  fallbackName = '',
  approvalStatus = '',
  approvedAt = '',
}) {
  const bridge = getOfferDomainBridge();
  const sourceQuery = fallbackQuery || state.currentDetailQuery || state.searchQuery || '';
  if (bridge?.buildPlanPayloadFromOffer) {
    return bridge.buildPlanPayloadFromOffer({
      item,
      key,
      desiredQty,
      fallbackQuery,
      alternatives,
      fallbackName,
      approvalStatus,
      approvedAt,
      sourceQuery,
    }, {
      depotMeta: DEPOT_META,
      calculatePlanning,
      getItemBarcode,
      resolveDepotIdentity,
      createDrugOperationEntity,
    });
  }
  console.warn('[v2.3-modular] OfferDomain bridge yok, plan payload uretilmedi.');
  return null;
}

function getPlanBarcodeAggregate(planItems, resolvedBarcode) {
  const raw = String(resolvedBarcode || '').trim();
  if (!raw) return { depotCount: 0, totalQty: 0, singleQty: 0, lines: [] };
  const normW = typeof normalizeProductBarcode === 'function'
    ? String(normalizeProductBarcode(raw) || '').trim()
    : '';
  const wanted = normW || raw.replace(/\D/g, '').slice(-13) || raw;
  if (!wanted) return { depotCount: 0, totalQty: 0, singleQty: 0, lines: [] };

  const lines = [];
  for (const item of planItems || []) {
    const ir = String(item?.barcode || item?.barkod || '').trim();
    if (!ir) continue;
    const normI = typeof normalizeProductBarcode === 'function'
      ? String(normalizeProductBarcode(ir) || '').trim()
      : ir.replace(/\D/g, '').slice(-13);
    if (normI && normI === wanted) lines.push(item);
  }
  if (!lines.length) return { depotCount: 0, totalQty: 0, singleQty: 0, lines: [] };

  const depots = new Set();
  for (const it of lines) {
    const a = resolveDepotIdentity(String(it?.depotId || '').trim());
    const b = resolveDepotIdentity(String(it?.depot || '').trim());
    const tag = a || b || String(it?.depotId || it?.depot || '').trim();
    if (tag) depots.add(tag);
  }
  const depotCount = Math.max(depots.size, 1);
  const totalQty = lines.reduce((s, it) => s + Math.max(parseInt(it?.desiredQty, 10) || 1, 1), 0);
  const singleQty = lines.length === 1 ? Math.max(parseInt(lines[0]?.desiredQty, 10) || 1, 1) : 0;
  return { depotCount, totalQty, singleQty, lines };
}

function computeDetailPlanKeys(selected) {
  if (!selected) {
    return {
      resolvedBarcode: '',
      detailPlanKey: '',
      detailPlanAdded: false,
      planLineQty: null,
    };
  }
  const plan = getOrderPlan();
  const barcode = String(getItemBarcode(selected, state.currentDetailQuery) || selected.barkod || '').trim();
  const resolvedBarcode = barcode;
  const detailPlanKey = resolvedBarcode
    ? `BARCODE_${resolvedBarcode}`
    : (state.currentVariantKey || String(selected?.key || '') || selected?.ad || '');
  const detailPlanAdded = isPlanEntryPresent(detailPlanKey, selected.depotId, selected.depot, plan, resolvedBarcode);
  let planLineQty = null;
  if (detailPlanAdded) {
    const st = resolveOperationStateForItem(selected, detailPlanKey, { resolvedBarcode, planItems: plan });
    planLineQty = Math.max(parseInt(st?.desiredQty, 10) || 1, 1);
  }
  return { resolvedBarcode, detailPlanKey, detailPlanAdded, planLineQty };
}

function applyPlanQtyFromDetailSelection(selected, nextQty) {
  if (!selected) return;
  const { detailPlanKey, detailPlanAdded } = computeDetailPlanKeys(selected);
  if (!detailPlanAdded) return;
  const planItem = findPlanItemByIdentity(detailPlanKey, selected.depotId || selected.depot || '');
  if (!planItem) {
    renderDetailPage();
    return;
  }
  const q = Math.max(parseInt(nextQty, 10) || 1, 1);
  const eff = Number(planItem.effectiveUnit) || Number(planItem.unitPrice) || Number(selected.fiyatNum) || 0;
  const totalCost = eff > 0 ? eff * q : Number(planItem.totalCost) || 0;
  patchPlanOperationItem(planItem.key, planItem.depotId || planItem.depot || '', {
    desiredQty: q,
    orderQty: q,
    receiveQty: q,
    totalCost,
  });
  finalizePlanMutation({ forcePlan: true });
}

function renderDetailPage() {
  const page = document.getElementById('page-search-detail');
  if (!page) return;
  const items = sortDepotItems(state.currentDetailItems);
  const selected = getSelectedDetailItem();
  const plan = getOrderPlan();
  const {
    resolvedBarcode,
    detailPlanKey,
    detailPlanAdded,
    planLineQty,
  } = computeDetailPlanKeys(selected);
  const planBarcodeAgg = getPlanBarcodeAggregate(plan, resolvedBarcode);
  // Sadece kullanici aktif olarak qty degistirmiyorsa plan qtysini senkronize et
  if (selected && detailPlanAdded && planLineQty != null && state.desiredQty !== planLineQty && !state._userQtyChange) {
    state.desiredQty = planLineQty;
  }
  const planning = selected ? calculatePlanning(selected, state.desiredQty) : null;
  const barcode = resolvedBarcode;
  const planMetrics = computePlanMetrics(plan);
  const hasMfOptions = items.some((item) => parseMf(item.mfStr || item.malFazlasi || item.MalFazlasi || ''));
  const selectedMf = selected
    ? mapMfModel(String(selected.mfStr || selected.malFazlasi || selected.MalFazlasi || '').trim())
    : null;
  const stDetail = selected
    ? resolveOperationStateForItem(selected, detailPlanKey, { resolvedBarcode, planItems: plan })
    : { inPlan: false, isApproved: false, desiredQty: 0 };
  const useBarcodeAgg = Boolean(String(resolvedBarcode || '').trim()) && planBarcodeAgg.depotCount > 0;
  const detailOperationState = selected
    ? {
      ...stDetail,
      ...(useBarcodeAgg
        ? {
          inPlan: true,
          inPlanCount: planBarcodeAgg.depotCount,
          desiredQty: planBarcodeAgg.depotCount > 1 ? 0 : planBarcodeAgg.singleQty,
        }
        : {
          inPlan: detailPlanAdded,
          inPlanCount: detailPlanAdded ? 1 : 0,
          desiredQty: detailPlanAdded && planLineQty != null ? planLineQty : 0,
        }),
    }
    : { inPlan: false, isApproved: false };
  let detailPlanCrossDepotHint = '';
  if (selected && resolvedBarcode && planBarcodeAgg.depotCount > 1) {
    detailPlanCrossDepotHint = `${planBarcodeAgg.depotCount} depoda ayrı plan satırı. Adet değişimi yalnızca seçili depo satırını günceller.`;
  } else if (selected && resolvedBarcode && planBarcodeAgg.depotCount === 1 && !detailPlanAdded) {
    detailPlanCrossDepotHint = 'Başka bir depoda planda; bu depodan da «Plana ekle» ile ekleyebilirsiniz.';
  }
  const itemPlanAddedByOfferKey = {};
  for (const it of items) {
    const k = getOfferKey(it);
    itemPlanAddedByOfferKey[k] = isPlanEntryPresent(
      detailPlanKey,
      it.depotId,
      it.depot,
      plan,
      resolvedBarcode,
    );
  }
  const detailUiBridge = getDetailUiBridge();
  if (detailUiBridge?.renderDetailPage) {
    const tbody = page.querySelector('.decision-table tbody');
    const oldRects = new Map();
    if (tbody) {
      Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
        const k = tr.getAttribute('data-offer-key');
        if (k) oldRects.set(k, tr.getBoundingClientRect());
      });
    }

    page.innerHTML = detailUiBridge.renderDetailPage({
      items,
      selected,
      planning,
      barcode,
      plan,
      planMetrics,
      hasMfOptions,
      selectedMf,
      detailPlanAdded,
      detailOperationState,
      detailPlanCrossDepotHint,
      itemPlanAddedByOfferKey,
      detailPlanSummaryExpanded: Boolean(state.detailPlanSummaryExpanded),
      desiredQty: state.desiredQty,
      mfCalculatorOpen: state.mfCalculatorOpen,
      bulkDetailContext: state.bulkDetailContext,
      selectedOfferKey: state.selectedOfferKey || getOfferKey(selected),
      selectedGroupName: state.currentDetailQuery,
    }, {
      esc,
      escJs,
      formatCurrency,
      depotBadgeHtml,
      formatStock,
      renderOperationStateBadges,
      calculatePlanning,
      getOfferKey,
      normalizeImageUrl,
      isUsableImageUrl,
      parseMf,
    });

    requestAnimationFrame(() => {
      // 1) En ucuz olan (seçili) autofocus
      const bestBtn = page.querySelector('.row-best button.btn-brand');
      if (bestBtn) {
        bestBtn.focus({ preventScroll: true });
      }

      // 2) FLIP Animation for row reordering
      if (oldRects.size > 0) {
        const newTbody = page.querySelector('.decision-table tbody');
        if (newTbody) {
          Array.from(newTbody.querySelectorAll('tr')).forEach((tr) => {
            const k = tr.getAttribute('data-offer-key');
            const oldRect = oldRects.get(k);
            if (oldRect) {
              const newRect = tr.getBoundingClientRect();
              const dy = oldRect.top - newRect.top;
              if (Math.abs(dy) > 1) {
                // FLIP Invert
                tr.style.transform = `translateY(${dy}px)`;
                tr.style.transition = 'none';
                tr.style.animation = 'none'; // CSS'ten gelen slideToTop'u iptal et
                
                // FLIP Play
                requestAnimationFrame(() => {
                  tr.style.transform = '';
                  tr.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)';
                });
              } else {
                // Pozisyon değişmediyse animasyona gerek yok, varolan slideToTop vs iptal edebiliriz 
                // ya da yeni girenleri bırakırız. (Şu an varolanlar slideToTop oynamasın)
                tr.style.animation = 'none';
              }
            }
          });
        }
      }
    });

  } else {
    page.innerHTML = '<div class="v23-detail-wrapper"><div class="card" style="padding:32px; color:var(--ink-500);">Detay UI modülü yüklenemedi.</div></div>';
  }

  const backButton = page.querySelector('.search-sidebar .btn.btn-ghost');
  if (backButton && state.bulkDetailContext) {
    backButton.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span> Toplu Aramaya Don';
    backButton.onclick = () => returnToBulkDetail(state.bulkDetailContext.rowIndex);
  }

  const qtyInput = document.getElementById('desiredQtyInput');
  if (qtyInput) {
    qtyInput.onchange = (event) => {
      setDesiredQty(event.target?.value);
    };
  }
}

function renderBulkPage() {
  const page = document.getElementById('page-bulk');
  if (!page) return;
  const bulkUiBridge = getBulkUiBridge();
  if (bulkUiBridge?.renderBulkPage) {
    const bulkRowsWithMeta = (state.bulkRows || []).map((row) => buildBulkRowRenderModel(row));
    page.innerHTML = bulkUiBridge.renderBulkPage({
      bulkInput: state.bulkInput,
      bulkRows: bulkRowsWithMeta,
    }, {
      esc,
      renderBulkDropzoneArt,
      getBulkRowQty,
      calculatePlanning,
      formatCurrency,
      depotBadgeHtml,
      renderOperationStateBadges,
    });
    return;
  }
  page.innerHTML = `<div class="home-wrapper">${renderEmptyState({ title: 'Bulk UI modülü yüklenemedi', body: 'Lutfen bulk-ui bridge durumunu kontrol et.' })}</div>`;
}

function buildBulkRowRenderModel(row) {
  const rowGroups = row?.groups || [];
  const bestGroup = rowGroups.find((group) => group.key === row.selectedGroupKey) || rowGroups[0] || null;
  const rowBc = row?.bestItem
    ? String(getItemBarcode(row.bestItem, row.query) || row.bestItem.barkod || '').trim()
    : '';
  let normBc = rowBc;
  if (normBc && typeof normalizeProductBarcode === 'function') {
    const nb = String(normalizeProductBarcode(normBc) || '').trim();
    if (nb) normBc = nb;
  }
  const planKey = (normBc && isBarcodeQuery(normBc))
    ? `BARCODE_${normBc}`
    : (bestGroup?.key || normBc || row?.query);
  const planList = getOrderPlan();
  const rowPlanAdded = row?.bestItem
    ? isPlanEntryPresent(planKey, row.bestItem.depotId, row.bestItem.depot, null, normBc || rowBc)
    : false;
  const rowOperationState = row?.bestItem
    ? {
      ...resolveOperationStateForItem(row.bestItem, planKey, { resolvedBarcode: normBc || rowBc, planItems: planList }),
      inPlan: rowPlanAdded,
    }
    : { inPlan: false, isApproved: false };
  return {
    ...row,
    _meta: {
      rowPlanAdded,
      rowOperationState,
    },
  };
}

function patchBulkRow(index) {
  const page = document.getElementById('page-bulk');
  if (!page || state.currentPage !== 'bulk') return false;
  const bulkUiBridge = getBulkUiBridge();
  if (!bulkUiBridge?.patchBulkRow || !bulkUiBridge?.patchBulkStats) return false;
  const row = buildBulkRowRenderModel(state.bulkRows?.[index] || {});
  const ok = bulkUiBridge.patchBulkRow(index, row, {
    esc,
    getBulkRowQty,
    calculatePlanning,
    formatCurrency,
    depotBadgeHtml,
    renderOperationStateBadges,
  });
  const bulkRowsWithMeta = (state.bulkRows || []).map((entry) => buildBulkRowRenderModel(entry));
  bulkUiBridge.patchBulkStats(bulkRowsWithMeta);
  return ok;
}

function planItemGroupKey(item) {
  const bc = String(item?.barcode || item?.barkod || '').trim();
  if (bc && typeof normalizeProductBarcode === 'function') {
    const n = String(normalizeProductBarcode(bc) || '').trim();
    if (n && isBarcodeQuery(n)) return n;
  }
  return String(item?.key || '').trim();
}

function groupPlanItems(plan) {
  const bridge = getPlanDomainBridge();
  if (bridge?.groupPlanItems) {
    return bridge.groupPlanItems(plan);
  }
  const groups = new Map();
  for (const item of plan || []) {
    const key = planItemGroupKey(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, name: item.name || item.ad || key, items: [] });
    groups.get(key).items.push(item);
  }
  return Array.from(groups.values());
}

function groupPlanItemsByDepot(plan) {
  const bridge = getPlanDomainBridge();
  if (bridge?.groupPlanItemsByDepot) {
    return bridge.groupPlanItemsByDepot(plan, DEPOT_META);
  }
  const groups = new Map();
  for (const item of plan) {
    const key = item.depotId || item.depot || 'unknown';
    if (!groups.has(key)) groups.set(key, {
      key,
      depotId: item.depotId || '',
      depot: item.depot || DEPOT_META[item.depotId]?.label || key,
      items: [],
    });
    groups.get(key).items.push(item);
  }
  return Array.from(groups.values());
}

function setPlanViewMode(mode) {
  state.planViewMode = mode === 'depot' ? 'depot' : 'drug';
  state.planApprovalMode = false;
  state.planApprovalScope = null;
  renderPlanSurfaces({ forcePage: true });
}

function openPlanApproval(scope = null) {
  state.planApprovalMode = true;
  state.planApprovalScope = scope;
  state.approvalSelection = [];
  renderPlanSurfaces({ forcePage: true });
}

function closePlanApproval() {
  state.planApprovalMode = false;
  state.planApprovalScope = null;
  state.approvalSelection = [];
  renderPlanSurfaces({ forcePage: true });
}

function openPlanApprovalForItem(key, depotId = '') {
  openPlanApproval({ key, depotId: depotId || '' });
}

function buildChromeDepotTarget(depotId, rawQuery, fallbackUrl) {
  const bridge = getAppActionsBridge();
  if (bridge?.buildChromeDepotTarget) {
    return bridge.buildChromeDepotTarget(depotId, rawQuery, fallbackUrl, { parseQRCode });
  }
  return { url: fallbackUrl || '', copyText: String(rawQuery || '').trim() };
}

function copyAndOpenDepot(url, depotId, rawQuery = '') {
  const bridge = getAppActionsBridge();
  if (bridge?.copyAndOpenDepot) {
    return bridge.copyAndOpenDepot(url, depotId, rawQuery, { state }, {
      buildChromeDepotTarget,
      openUrl,
    });
  }
  return undefined;
}

function openPlanInDepot(key = '', depotId = '') {
  const bridge = getAppActionsBridge();
  if (bridge?.openPlanInDepot) {
    return bridge.openPlanInDepot(key, depotId, { state }, {
      getOrderPlan,
      copyAndOpenDepot,
    });
  }
  return undefined;
}

function decodePlanDataAttr(raw) {
  try {
    return decodeURIComponent(String(raw ?? ''));
  } catch {
    return String(raw ?? '');
  }
}

function detachPlanApprovalDelegatedHandlers(page) {
  if (!page || !page.__planApprovalDelegated) return;
  const { click, keydown } = page.__planApprovalDelegated;
  if (typeof click === 'function') page.removeEventListener('click', click);
  if (typeof keydown === 'function') page.removeEventListener('keydown', keydown);
  page.__planApprovalDelegated = null;
}

function attachPlanApprovalDelegatedHandlers(page) {
  if (!page) return;
  detachPlanApprovalDelegatedHandlers(page);

  const onClick = (ev) => {
    const removeBtn = ev.target.closest('.plan-approval-remove');
    if (removeBtn && page.contains(removeBtn)) {
      const k = decodePlanDataAttr(removeBtn.getAttribute('data-plan-approval-k'));
      const d = decodePlanDataAttr(removeBtn.getAttribute('data-plan-approval-d'));
      removeApprovalItem(k, d);
      return;
    }

    const cmdEl = ev.target.closest('[data-plan-approval-cmd]');
    if (cmdEl && page.contains(cmdEl)) {
      const cmd = cmdEl.getAttribute('data-plan-approval-cmd');
      if (cmd === 'select-all') {
        setApprovalSelectionAll(true);
        return;
      }
      if (cmd === 'select-none') {
        setApprovalSelectionAll(false);
        return;
      }
      if (cmd === 'complete' && !cmdEl.disabled) {
        completeApprovalSelection();
        return;
      }
    }

    const row = ev.target.closest('[data-plan-approval-row]');
    if (row && page.contains(row)) {
      const k = decodePlanDataAttr(row.getAttribute('data-plan-approval-k'));
      const d = decodePlanDataAttr(row.getAttribute('data-plan-approval-d'));
      toggleApprovalSelection(k, d);
    }
  };

  const onKeydown = (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = ev.target.closest('[data-plan-approval-row]');
    if (!row || !page.contains(row)) return;
    ev.preventDefault();
    const k = decodePlanDataAttr(row.getAttribute('data-plan-approval-k'));
    const d = decodePlanDataAttr(row.getAttribute('data-plan-approval-d'));
    toggleApprovalSelection(k, d);
  };

  page.__planApprovalDelegated = { click: onClick, keydown: onKeydown };
  page.addEventListener('click', onClick);
  page.addEventListener('keydown', onKeydown);
}

function renderPlanPageV2() {
  const page = document.getElementById('page-plan');
  if (!page) return;
  const plan = getOrderPlan();
  const approvalQueue = getApprovalQueue();
  const groups = state.planViewMode === 'depot' ? groupPlanItemsByDepot(plan) : groupPlanItems(plan);
  const metrics = computePlanMetrics(plan);
  const approvalItems = state.planApprovalScope
    ? approvalQueue.filter((item) => {
      const scope = state.planApprovalScope;
      if (!samePlanLineKey(item.key, scope.key)) return false;
      if (!scope.depotId) return true;
      return resolveDepotIdentity(item.depotId || item.depot || '') === resolveDepotIdentity(scope.depotId);
    })
    : approvalQueue;
  const approvalTotal = approvalItems.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  const selectedApprovalCount = approvalItems.filter((item) => state.approvalSelection.includes(getApprovalSelectionKey(item))).length;

  const planUiBridge = getPlanUiBridge();
  if (planUiBridge?.renderPlanPage) {
    page.innerHTML = planUiBridge.renderPlanPage({
      plan,
      groups,
      metrics,
      approvalQueue,
      approvalItems,
      approvalTotal,
      selectedApprovalCount,
      viewMode: state.planViewMode,
      approvalMode: state.planApprovalMode,
      approvalScope: state.planApprovalScope,
      approvalSelection: state.approvalSelection || [],
      deps: {
        formatCurrency,
        depotBadgeHtml,
        esc,
        escJs,
        renderEmptyState,
        getApprovalSelectionKey,
      },
    });
    attachPlanApprovalDelegatedHandlers(page);
    return;
  }
  page.innerHTML = `<div class="home-wrapper">${renderEmptyState({ title: 'Plan UI modülü yüklenemedi', body: 'Lutfen plan-ui bridge durumunu kontrol et.' })}</div>`;
  detachPlanApprovalDelegatedHandlers(page);
}

function normalizeBulkQueries(raw) {
  const bridge = getAppActionsBridge();
  if (bridge?.normalizeBulkQueries) {
    return bridge.normalizeBulkQueries(raw, { parseQRCode });
  }
  return [];
}

function selectBulkGroup(rowIndex, groupIndex) {
  const bridge = getAppActionsBridge();
  if (bridge?.selectBulkGroup) {
    return bridge.selectBulkGroup(rowIndex, groupIndex, { state }, {
      renderBulkPage,
      openBulkVariant,
    });
  }
  return undefined;
}

function getBulkRowQty(row) {
  const bridge = getAppActionsBridge();
  if (bridge?.getBulkRowQty) return bridge.getBulkRowQty(row);
  return Math.max(Number(row?.desiredQty) || 1, 1);
}

function getBulkSelectedGroup(row) {
  const bridge = getAppActionsBridge();
  if (bridge?.getBulkSelectedGroup) return bridge.getBulkSelectedGroup(row);
  if (!row) return null;
  return row.groups?.find((group) => group.key === row.selectedGroupKey) || row.groups?.[0] || null;
}

function changeBulkRowQty(rowIndex, delta) {
  const bridge = getAppActionsBridge();
  if (bridge?.changeBulkRowQty) {
    return bridge.changeBulkRowQty(rowIndex, delta, { state }, {
      getBulkRowQty,
      renderBulkPage,
      renderBulkDrawer,
    });
  }
  return undefined;
}

function setBulkRowQty(rowIndex, value) {
  const bridge = getAppActionsBridge();
  if (bridge?.setBulkRowQty) {
    return bridge.setBulkRowQty(rowIndex, value, { state }, {
      renderBulkPage,
      renderBulkDrawer,
    });
  }
  return undefined;
}

function buildPlanDrawerOptions(group) {
  const bridge = getPlanDomainBridge();
  if (bridge?.buildPlanDrawerOptions) {
    return bridge.buildPlanDrawerOptions({
      group,
      normalizeAlternativeItems,
      normalizePlanItem,
      calculatePlanning,
    });
  }
  return [];
}

function renderPlanPage() {
  // Legacy wrapper is intentionally kept for backwards compatibility.
  return renderPlanPageV2();
}

function renderSettingsPage() {
  const page = document.getElementById('page-settings');
  if (!page) return;
  const depots = state.config?.availableDepots || {};
  const current = state.config?.depots || {};
  const connectedCount = Object.values(current).filter((entry) => entry?.hasCredentials || entry?.hasCookies || entry?.hasToken).length;
  const shellUiBridge = getShellUiBridge();
  if (shellUiBridge?.renderSettingsPage) {
    page.innerHTML = shellUiBridge.renderSettingsPage({
      depots,
      current,
      connectedCount,
      appVersion: state.appVersion,
      updateStatus: state.updateStatus,
    }, {
      depotForms: DEPOT_FORMS,
      depotBadgeHtml,
      esc,
      escJs,
    });
    return;
  }
  page.innerHTML = `<div class="home-wrapper">${renderEmptyState({ title: 'Shell UI modülü yüklenemedi', body: 'Lutfen settings bridge durumunu kontrol et.' })}</div>`;
}

function renderCurrentPage() {
  updateNavSummary();
  if (state.currentPage === 'home') return renderHomePage();
  if (state.currentPage === 'search-variants') return renderVariantsPage();
  if (state.currentPage === 'search-detail') return renderDetailPage();
  if (state.currentPage === 'bulk') return renderBulkPage();
  if (state.currentPage === 'plan') return renderPlanPageV2();
  if (state.currentPage === 'settings') return renderSettingsPage();
  if (state.currentPage === 'login') return renderLoginPage();
}

document.addEventListener('click', (event) => {
  const shell = document.getElementById('profileMenuShell');
  if (!shell) return;
  if (!shell.contains(event.target)) {
    closeProfileMenu();
  }
});

function renderBulkDrawer(row) {
  const body = document.querySelector('#bulk-drawer .drawer-body');
  if (!body) return;
  const bulkUiBridge = getBulkUiBridge();
  if (!bulkUiBridge?.renderBulkDrawer) {
    body.innerHTML = '<div class="text-muted">Bulk UI modülü yüklenemedi.</div>';
    return;
  }
  const rowWithMeta = row
    ? {
      ...row,
      groups: (row.groups || []).map((group) => ({
        ...group,
        items: (group.items || []).map((item) => {
          let drawerBc = String(getItemBarcode(item, row.query) || item.barkod || '').trim();
          if (drawerBc && typeof normalizeProductBarcode === 'function') {
            const nb = String(normalizeProductBarcode(drawerBc) || '').trim();
            if (nb) drawerBc = nb;
          }
          const drawerPlanKey = (drawerBc && isBarcodeQuery(drawerBc))
            ? `BARCODE_${drawerBc}`
            : (group.key || drawerBc || row.query);
          const planList = getOrderPlan();
          const drawerPlanAdded = isPlanEntryPresent(drawerPlanKey, item.depotId, item.depot, null, drawerBc);
          const drawerOperationState = {
            ...resolveOperationStateForItem(item, drawerPlanKey, { resolvedBarcode: drawerBc, planItems: planList }),
            inPlan: drawerPlanAdded,
          };
          return {
            ...item,
            _meta: {
              drawerPlanAdded,
              drawerOperationState,
            },
          };
        }),
      })),
    }
    : null;
  const selectedGroup = getBulkSelectedGroup(rowWithMeta);
  const selectedGroupIndex = Math.max((rowWithMeta?.groups || []).findIndex((entry) => entry.key === selectedGroup?.key), 0);
  const selectedItem = rowWithMeta?.bestItem || selectedGroup?.bestItem || null;
  const bulkQty = getBulkRowQty(rowWithMeta);
  const selectedPlanning = selectedItem ? calculatePlanning(selectedItem, bulkQty) : null;
  body.innerHTML = bulkUiBridge.renderBulkDrawer({
    row: rowWithMeta,
    bulkDrawerIndex: state.bulkDrawerIndex,
    selectedGroup,
    selectedGroupIndex,
    selectedItem,
    bulkQty,
    selectedPlanning,
  }, {
    esc,
    escJs,
    calculatePlanning,
    formatCurrency,
    getOfferKey,
    depotBadgeHtml,
    renderOperationStateBadges,
  });
}

function renderPlanDrawer(groupKey) {
  const plan = getOrderPlan();
  const group = groupPlanItems(plan).find((entry) => entry.key === groupKey);
  const body = document.querySelector('#edit-drawer .drawer-body');
  const header = document.querySelector('#edit-drawer .drawer-header');
  if (!body || !header) return;
  if (!group) {
    body.innerHTML = '<div class="text-muted">Plan kalemi bulunamadi.</div>';
    return;
  }

  const drawerOptions = buildPlanDrawerOptions(group);

  const planUiBridge = getPlanUiBridge();
  if (planUiBridge?.renderPlanDrawer) {
    const drawerUi = planUiBridge.renderPlanDrawer({
      group,
      drawerOptions,
      deps: {
        formatCurrency,
        depotBadgeHtml,
        esc,
        escJs,
      },
    });
    header.innerHTML = drawerUi?.headerHtml || '';
    body.innerHTML = drawerUi?.bodyHtml || '';
    return;
  }
  header.innerHTML = '';
  body.innerHTML = '<div class="text-muted">Plan UI modulu yuklenemedi.</div>';
}

async function runSearch(query) {
  const bridge = getAppActionsBridge();
  if (bridge?.runSearch) {
    return bridge.runSearch(query, { state }, {
      getSecurityGuardsBridge,
      parseQRCode,
      isBarcodeQuery,
      normalizeProductBarcode,
      searchAcrossDepotsProgressive,
      searchAcrossDepots,
      buildVariantGroups,
      getOfferKey,
      getItemBarcode,
      switchMock,
      renderHistoryEntry,
      SEARCH_RENDER_BATCH_MS,
      MIN_GATHER_TIME_MS,
      getPendingSearchRenderTimer: () => pendingSearchRenderTimer,
      setPendingSearchRenderTimer: (value) => {
        pendingSearchRenderTimer = value;
      },
    });
  }
  return undefined;
}

function renderHistoryEntry(group) {
  const bridge = getAppActionsBridge();
  if (bridge?.renderHistoryEntry) {
    return bridge.renderHistoryEntry(group, {
      authFetch,
      API_BASE,
    });
  }
  return undefined;
}

function formatHistory(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function escJs(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function _patchDetailQtyDisplay(next, selected) {
  const detailUiBridge = getDetailUiBridge();
  if (!detailUiBridge?.patchDetailQty) return;
  const page = document.getElementById('page-search-detail');
  if (!page) return;
  const items = sortDepotItems(state.currentDetailItems);
  const sel = selected || getSelectedDetailItem();
  const planning = sel ? calculatePlanning(sel, next) : null;
  const selectedMfStr = String(sel?.mfStr || sel?.malFazlasi || sel?.MalFazlasi || '').trim();
  const selectedMf = selectedMfStr ? mapMfModel(selectedMfStr) : null;
  const selDepotLower = String(sel?.depot || '').toLocaleLowerCase('tr-TR');
  const depotCampaignLabel = selDepotLower.includes('selçuk') ? 'Selçuk kampanya' : 'Depo kampanya';
  detailUiBridge.patchDetailQty(page, {
    desiredQty: next,
    selected: sel,
    planning,
    selectedMf,
    selectedMfStr,
    depotCampaignLabel,
    items,
  }, { formatCurrency, calculatePlanning, getOfferKey });

  // Statik fiyattan sonra live quote isle (Selcuk/Nevzat/Alliance gercek barem fiyatlari)
  if (next > 1) {
    _fetchAndPatchLiveQuotes(page, items, sel, next, depotCampaignLabel, selectedMf, selectedMfStr);
  }
}

// ── Detail Page Live Quote (V2.2 ile birebir) ─────────────────────────────────
const _detailQuoteCache = new Map();
let _detailQuoteVersion = 0;
const _DETAIL_QUOTE_CONCURRENCY = 2;

function _dqComparePlannerOptions(a, b) {
  const aUnit = Number(a?.effectiveUnit) || Number.MAX_SAFE_INTEGER;
  const bUnit = Number(b?.effectiveUnit) || Number.MAX_SAFE_INTEGER;
  if (Math.abs(aUnit - bUnit) > 0.0001) return aUnit - bUnit;
  return (Number(a?.totalCost) || 0) - (Number(b?.totalCost) || 0);
}

function _dqBuildUnitOptions(items, qty) {
  return (items || [])
    .filter((i) => Number(i.fiyatNum) > 0)
    .map((item) => ({
      depot: item.depot,
      depotId: item.depotId,
      depotUrl: item.depotUrl,
      mf: null,
      mfStr: '',
      orderQty: qty,
      receiveQty: qty,
      totalCost: qty * item.fiyatNum,
      effectiveUnit: item.fiyatNum,
      unitPrice: item.fiyatNum,
      availableMfStr: item.malFazlasi || item.mfStr || '',
      ad: item.ad,
      sourceItem: item,
      pricingMode: 'unit',
    }))
    .sort(_dqComparePlannerOptions);
}

function _dqCalcMfOptions(items, qty) {
  return (items || [])
    .filter((i) => Number(i.fiyatNum) > 0)
    .map((item) => {
      const mfRaw = item.malFazlasi || item.mfStr || '';
      const mf = parseMf(mfRaw);
      const unitPrice = Number(item.fiyatNum);

      if (!mf || qty < mf.total) {
        return {
          depot: item.depot,
          depotId: item.depotId,
          depotUrl: item.depotUrl,
          mf: null,
          mfStr: '',
          orderQty: qty,
          receiveQty: qty,
          totalCost: qty * unitPrice,
          effectiveUnit: unitPrice,
          unitPrice,
          availableMfStr: mfRaw,
          ad: item.ad,
          sourceItem: item,
          pricingMode: 'unit',
        };
      }

      const batches = Math.ceil(qty / mf.total);
      const orderQty = batches * mf.buy;
      const receiveQty = batches * mf.total;
      return {
        depot: item.depot,
        depotId: item.depotId,
        depotUrl: item.depotUrl,
        mf,
        mfStr: mfRaw,
        orderQty,
        receiveQty,
        totalCost: orderQty * unitPrice,
        effectiveUnit: (orderQty * unitPrice) / receiveQty,
        unitPrice,
        availableMfStr: mfRaw,
        ad: item.ad,
        sourceItem: item,
        pricingMode: 'fallback',
      };
    })
    .sort(_dqComparePlannerOptions);
}

function _dqBuildQuoteCacheKey(item, option, qty) {
  return [
    item?.depotId || '',
    item?.kodu || item?.barcode || item?.barkod || item?.ad || '',
    option?.mfStr || '',
    option?.orderQty || '',
    option?.receiveQty || '',
    qty || '',
  ].join('::');
}

async function _dqFetchQuotedOption(item, option, qty) {
  if (!item?.depotId) return option;

  const cacheKey = _dqBuildQuoteCacheKey(item, option, qty);
  if (_detailQuoteCache.has(cacheKey)) return _detailQuoteCache.get(cacheKey);

  try {
    const res = await authFetch(`${API_BASE}/api/quote-option`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depotId: item.depotId, item, option, targetQty: qty }),
    });
    const data = await res.json();
    if (data?.success && data.quote) {
      const quoted = { ...option, ...data.quote, sourceItem: item };
      _detailQuoteCache.set(cacheKey, quoted);
      return quoted;
    }
  } catch {
    // backend'e ulasilamazsa static option kullan
  }
  return option;
}

async function _dqResolveQuotedOptions(items, qty) {
  const baseOptions = _dqCalcMfOptions(items, qty);
  if (!baseOptions.length) return _dqBuildUnitOptions(items, qty);
  const tasks = baseOptions.map((opt) => () => _dqFetchQuotedOption(opt.sourceItem, opt, qty));
  const quoted = await runConcurrent(tasks, _DETAIL_QUOTE_CONCURRENCY);
  return quoted.sort(_dqComparePlannerOptions);
}

async function _fetchAndPatchLiveQuotes(page, items, selected, qty, depotCampaignLabel, selectedMf, selectedMfStr) {
  const myVersion = ++_detailQuoteVersion;

  try {
    const quotedOptions = await _dqResolveQuotedOptions(items, qty);

    if (myVersion !== _detailQuoteVersion) return; // eski cagri, iptal
    if (!page.isConnected) return;

    const detailUiBridge = getDetailUiBridge();
    if (!detailUiBridge?.patchDetailQtyLive) return;

    const selDepotId = String(selected?.depotId || '').trim();
    const selectedQuoted = (selDepotId
      ? quotedOptions.find((o) => String(o.depotId || '').trim() === selDepotId)
      : null) || quotedOptions[0];

    detailUiBridge.patchDetailQtyLive(page, {
      desiredQty: qty,
      selected,
      quotedOptions,
      selectedQuoted,
      depotCampaignLabel,
      selectedMf,
      selectedMfStr,
      items,
    }, { formatCurrency, getOfferKey });
  } catch {
    // live quote basarisiz, statik fiyat gosterilmeye devam eder
  }
}

function setDesiredQty(value) {
  const next = Math.max(parseInt(value, 10) || 1, 1);
  if (state.currentPage === 'search-detail') {
    const sel = getSelectedDetailItem();
    if (sel) {
      const { detailPlanAdded } = computeDetailPlanKeys(sel);
      if (detailPlanAdded) {
        state.desiredQty = next;
        state._userQtyChange = true; // renderDetailPage override'ini engelle
        _patchDetailQtyDisplay(next, sel);
        applyPlanQtyFromDetailSelection(sel, next);
        state._userQtyChange = false;
        return;
      }
    }
    // Sadece qty degisti: tam re-render yerine hedefli DOM guncelle
    state.desiredQty = next;
    const page = document.getElementById('page-search-detail');
    if (page && getDetailUiBridge()?.patchDetailQty) {
      _patchDetailQtyDisplay(next, null);
      return;
    }
    renderDetailPage();
    return undefined;
  }
  const bridge = getAppActionsBridge();
  if (bridge?.setDesiredQty) {
    return bridge.setDesiredQty(next, { state }, { renderDetailPage });
  }
  state.desiredQty = next;
  renderDetailPage();
  return undefined;
}

function changeDesiredQty(delta) {
  const next = Math.max((parseInt(state.desiredQty, 10) || 1) + delta, 1);
  setDesiredQty(next);
}

function selectOffer(key) {
  const bridge = getAppActionsBridge();
  if (bridge?.selectOffer) {
    return bridge.selectOffer(key, { state }, { renderDetailPage });
  }
  return undefined;
}

function toggleMfCalculator() {
  const bridge = getAppActionsBridge();
  if (bridge?.toggleMfCalculator) {
    return bridge.toggleMfCalculator({ state }, { renderDetailPage });
  }
  return undefined;
}

function addSelectedOfferToPlan() {
  const bridge = getDetailActionsBridge();
  if (bridge?.addSelectedOfferToPlan) {
    return bridge.addSelectedOfferToPlan({ state }, {
      getSelectedDetailItem,
      buildPlanPayloadFromOffer,
      addPlanItem,
      finalizePlanMutation,
    });
  }
  return undefined;
}

function addOfferToPlan(key) {
  const bridge = getDetailActionsBridge();
  if (bridge?.addOfferToPlan) {
    return bridge.addOfferToPlan(key, { state }, {
      getOfferKey,
      buildPlanPayloadFromOffer,
      addPlanItem,
      finalizePlanMutation,
    });
  }
  return undefined;
}

function removeSelectedOfferFromPlan() {
  const selected = getSelectedDetailItem();
  if (!selected) return;
  const { detailPlanKey, detailPlanAdded } = computeDetailPlanKeys(selected);
  if (!detailPlanAdded) return;
  const planItem = findPlanItemByIdentity(detailPlanKey, selected.depotId || selected.depot || '');
  if (!planItem) return;
  removePlanItemAndRender(planItem.key, planItem.depotId || planItem.depot || '');
}

function approveSelectedOfferFromDetail() {
  const selected = getSelectedDetailItem();
  if (!selected) return;
  const { detailPlanKey, detailPlanAdded } = computeDetailPlanKeys(selected);
  if (!detailPlanAdded) return;
  queuePlanItemForApproval(detailPlanKey, selected.depotId || selected.depot || '');
}

function removeSelectedOfferApproval() {
  const selected = getSelectedDetailItem();
  if (!selected) return;
  const { detailPlanKey, detailPlanAdded } = computeDetailPlanKeys(selected);
  if (!detailPlanAdded) return;
  removePlanApproval(detailPlanKey, selected.depotId || selected.depot || '');
}

function toggleDetailPlanSummarySize() {
  if (typeof window.openOrderPlanModal === 'function') {
    window.openOrderPlanModal();
  } else {
    state.detailPlanSummaryExpanded = !state.detailPlanSummaryExpanded;
    renderDetailPage();
  }
}

function scrollDetailPlanSummary(direction = 1) {
  const track = document.getElementById('detail-plan-summary-track');
  if (!track) return;
  const delta = Number(direction) >= 0 ? 1 : -1;
  const amount = Math.max(220, Math.floor(track.clientWidth * 0.75));
  track.scrollBy({ left: delta * amount, behavior: 'smooth' });
}

function openUrl(url) {
  const bridge = getAppActionsBridge();
  if (bridge?.openUrl) {
    return bridge.openUrl(url, { getSecurityGuardsBridge });
  }
  return undefined;
}

function openSelectedOfferInDepot() {
  const bridge = getDetailActionsBridge();
  if (bridge?.openSelectedOfferInDepot) {
    return bridge.openSelectedOfferInDepot({ state }, {
      getSelectedDetailItem,
      copyAndOpenDepot,
    });
  }
  return undefined;
}

function openOfferInDepot(key) {
  const bridge = getDetailActionsBridge();
  if (bridge?.openOfferInDepot) {
    return bridge.openOfferInDepot(key, { state }, {
      getOfferKey,
      copyAndOpenDepot,
    });
  }
  return undefined;
}

function openVariantDetail(key) {
  const bridge = getAppActionsBridge();
  if (bridge?.openVariantDetail) {
    return bridge.openVariantDetail(key, { state }, {
      getOfferKey,
      switchMock,
      getPendingSearchRenderTimer: () => pendingSearchRenderTimer,
      setPendingSearchRenderTimer: (value) => {
        pendingSearchRenderTimer = value;
      },
      searchAcrossDepots,
      isBarcodeQuery,
      normalizeProductBarcode,
      buildVariantGroups,
      renderDetailPage,
      renderVariantsPage,
      sortDepotItems,
    });
  }
  return undefined;
}

async function bulkSearch() {
  const bridge = getAppActionsBridge();
  if (bridge?.bulkSearch) {
    return bridge.bulkSearch({ state }, {
      normalizeBulkQueries,
      renderBulkPage,
      patchBulkRow,
      searchAcrossDepots,
      buildVariantGroups,
      runConcurrent,
    });
  }
  return undefined;
}

function addBulkRowToPlan(index) {
  const bridge = getDetailActionsBridge();
  if (bridge?.addBulkRowToPlan) {
    return bridge.addBulkRowToPlan(index, { state }, {
      openBulkDrawer,
      getBulkRowQty,
      buildPlanPayloadFromOffer,
      addPlanItem,
      finalizePlanMutation,
    });
  }
  return undefined;
}

function selectBulkOffer(rowIndex, groupIndex, offerKey) {
  const bridge = getDetailActionsBridge();
  if (bridge?.selectBulkOffer) {
    return bridge.selectBulkOffer(rowIndex, groupIndex, offerKey, { state }, {
      getOfferKey,
      renderBulkPage,
      renderBulkDrawer,
    });
  }
  return undefined;
}

function addBulkOfferToPlan(rowIndex, groupIndex, offerKey) {
  const bridge = getDetailActionsBridge();
  if (bridge?.addBulkOfferToPlan) {
    return bridge.addBulkOfferToPlan(rowIndex, groupIndex, offerKey, { state }, {
      getOfferKey,
      getBulkRowQty,
      buildPlanPayloadFromOffer,
      addPlanItem,
      closeBulkDrawer,
      finalizePlanMutation,
    });
  }
  return undefined;
}

function openBulkVariant(rowIndex, groupIndex) {
  const bridge = getDetailActionsBridge();
  if (bridge?.openBulkVariant) {
    return bridge.openBulkVariant(rowIndex, groupIndex, { state }, {
      getOfferKey,
      getBulkRowQty,
      closeBulkDrawer,
      switchMock,
    });
  }
  return undefined;
}

function returnToBulkDetail(rowIndex) {
  const bridge = getDetailActionsBridge();
  if (bridge?.returnToBulkDetail) {
    return bridge.returnToBulkDetail(rowIndex, {
      switchMock,
      openBulkDrawer,
    });
  }
  return undefined;
}

function openHistorySearch(query, barcode) {
  const bridge = getDetailActionsBridge();
  if (bridge?.openHistorySearch) {
    return bridge.openHistorySearch(query, barcode, { runSearch });
  }
  return undefined;
}

function openPlanPreview(groupKey = '') {
  const bridge = getAppActionsBridge();
  if (bridge?.openPlanPreview) {
    return bridge.openPlanPreview(groupKey, {
      switchMock,
      openPlanDrawer,
    });
  }
  return undefined;
}

async function saveDepotSettings(depotId) {
  const bridge = getAppActionsBridge();
  if (bridge?.saveDepotSettings) {
    return bridge.saveDepotSettings(depotId, {
      authFetch,
      API_BASE,
      loadConfig,
      renderSettingsPage,
    });
  }
  return undefined;
}

async function testDepotLogin(depotId) {
  const bridge = getAppActionsBridge();
  if (bridge?.testDepotLogin) {
    return bridge.testDepotLogin(depotId, {
      authFetch,
      API_BASE,
      loadConfig,
      renderSettingsPage,
    });
  }
  return undefined;
}

function scrollToTop() {
  const bridge = getAppActionsBridge();
  if (bridge?.scrollToTop) return bridge.scrollToTop();
  return undefined;
}

function toggleCompatPanel() {
  const bridge = getAppActionsBridge();
  if (bridge?.toggleCompatPanel) return bridge.toggleCompatPanel();
  return undefined;
}

function isProfileMenuOpen() {
  const panel = document.getElementById('profileMenuPanel');
  return panel?.style.display === 'block';
}

function closeProfileMenu() {
  const panel = document.getElementById('profileMenuPanel');
  const button = document.getElementById('profileMenuButton');
  if (panel) panel.style.display = 'none';
  if (button) button.setAttribute('aria-expanded', 'false');
}

function toggleProfileMenu() {
  const panel = document.getElementById('profileMenuPanel');
  const button = document.getElementById('profileMenuButton');
  if (!panel) return;
  const nextOpen = !isProfileMenuOpen();
  panel.style.display = nextOpen ? 'block' : 'none';
  if (button) button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
}

function openProfileSettings() {
  closeProfileMenu();
  switchMock('settings');
}

async function refreshDepotStatuses() {
  closeProfileMenu();
  try {
    await Promise.all([
      loadConfig(),
      loadHistory(20),
    ]);
    renderCurrentPage();
    updateNavSummary();
  } catch (error) {
    console.warn('[v2.3.1] Depot refresh failed:', error?.message || error);
  }
}

function logoutCurrentUser() {
  closeProfileMenu();
  const bridge = getAppRuntimeBridge();
  if (bridge?.clearSession) {
    bridge.clearSession(TOKEN_KEY, USER_KEY);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
  state.user = null;
  state.authMode = 'login';
  renderLoginPage();
  switchMock('login');
}

async function runCompatHealth() {
  const bridge = getAppActionsBridge();
  if (bridge?.runCompatHealth) {
    return bridge.runCompatHealth({
      authFetch,
      API_BASE,
    });
  }
  return undefined;
}

async function runCompatDemo() {
  const bridge = getAppActionsBridge();
  if (bridge?.runCompatDemo) {
    return bridge.runCompatDemo({
      authFetch,
      API_BASE,
    });
  }
  return undefined;
}

async function runCompatUpdate() {
  const bridge = getAppActionsBridge();
  if (bridge?.runCompatUpdate) {
    return bridge.runCompatUpdate({ state });
  }
  return undefined;
}

function changePlanQty(key, depotId, delta) {
  const bridge = getAppActionsBridge();
  if (bridge?.changePlanQty) {
    return bridge.changePlanQty(key, depotId, delta, { state }, {
      getOrderPlan,
      calculatePlanning,
      patchPlanOperationItem,
      upsertApprovalFromPlanItem,
      finalizePlanMutation,
    });
  }
  return undefined;
}

function removePlanItemAndRender(key, depotId) {
  const bridge = getAppActionsBridge();
  if (bridge?.removePlanItemAndRender) {
    return bridge.removePlanItemAndRender(key, depotId, {
      removePlanItem,
      removeApprovalQueueEntry,
      finalizePlanMutation,
    });
  }
  return undefined;
}

function selectPlanAlternative(groupKey, depotId) {
  const bridge = getAppActionsBridge();
  if (bridge?.selectPlanAlternative) {
    return bridge.selectPlanAlternative(groupKey, depotId, {
      getOrderPlan,
      groupPlanItems,
      buildPlanPayloadFromOffer,
      removePlanItem,
      addPlanItem,
      removeApprovalQueueEntry,
      upsertApprovalFromPlanItem,
      finalizePlanMutation,
    });
  }
  return undefined;
}

async function bootstrapApp() {
  const bridge = getAppRuntimeBridge();
  if (bridge?.bootstrapApp) {
    return bridge.bootstrapApp({ state }, {
      loadAppMeta,
      ensureAuth,
      loadConfig,
      loadHistory,
      updateNavSummary,
      switchMock,
      API_BASE,
      authFetch,
      extractConfiguredDepotEntities,
      depotMeta: DEPOT_META,
      electronAPI: window.electronAPI,
      renderSettingsPage,
    });
  }
  return undefined;
}

function bindTopNav() {
  return bindTopNavV2();
}

function bindTopNavV2() {
  const bridge = getNavigationRuntimeBridge();
  if (bridge?.bindTopNav) {
    return bridge.bindTopNav({ state }, {
      parseQRCode,
      isBarcodeQuery,
      fetchSuggestions,
      runSearch,
      esc,
      renderVariantsPage,
      switchMock,
    });
  }
  return undefined;
}

function bindTitlebar() {
  const bridge = getAppActionsBridge();
  if (bridge?.bindTitlebar) return bridge.bindTitlebar();
  return undefined;
}

window.switchMock = function(pageId) {
  switchPage(pageId);
  renderCurrentPage();
};

window.goBackToPrevious = function() {
  window.__pageHistory = window.__pageHistory || [];
  if (!window.__pageHistory.length) return;
  const prevId = window.__pageHistory.pop();
  // Navigate without pushing to history
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const next = document.getElementById('page-' + prevId);
  if (next) {
    next.classList.add('active');
    if (window.__scrollPositions?.[prevId]) {
      next.scrollTop = window.__scrollPositions[prevId];
    }
  }
  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = prevId === 'login' ? 'none' : 'flex';
  state.currentPage = prevId;
  // Update back button
  const backBtn = document.getElementById('globalBackButton');
  if (backBtn) {
    const hasHistory = window.__pageHistory.length > 0;
    backBtn.style.display = hasHistory && prevId !== 'login' && prevId !== 'home' ? 'flex' : 'none';
  }
  renderCurrentPage();
};

window.openDrawer = function() {
  const bridge = getAppActionsBridge();
  if (bridge?.openDrawer) return bridge.openDrawer();
  return undefined;
};

window.closeDrawer = function() {
  const bridge = getAppActionsBridge();
  if (bridge?.closeDrawer) return bridge.closeDrawer({ state });
  return undefined;
};

window.openBulkDrawer = function(index = 0) {
  const bridge = getAppActionsBridge();
  if (bridge?.openBulkDrawer) {
    return bridge.openBulkDrawer(index, { state }, { renderBulkDrawer });
  }
  return undefined;
};

window.closeBulkDrawer = function() {
  const bridge = getAppActionsBridge();
  if (bridge?.closeBulkDrawer) return bridge.closeBulkDrawer({ state });
  return undefined;
};

window.openPlanDrawer = function(groupKey) {
  const bridge = getAppActionsBridge();
  if (bridge?.openPlanDrawer) {
    return bridge.openPlanDrawer(groupKey, { state }, {
      openDrawer,
      renderPlanDrawer,
    });
  }
  return undefined;
};

window.changeDesiredQty = changeDesiredQty;
window.setDesiredQty = setDesiredQty;
window.selectOffer = selectOffer;
window.toggleMfCalculator = toggleMfCalculator;
window.addSelectedOfferToPlan = addSelectedOfferToPlan;
window.addOfferToPlan = addOfferToPlan;
window.removeSelectedOfferFromPlan = removeSelectedOfferFromPlan;
window.approveSelectedOfferFromDetail = approveSelectedOfferFromDetail;
window.removeSelectedOfferApproval = removeSelectedOfferApproval;
window.toggleDetailPlanSummarySize = toggleDetailPlanSummarySize;
window.scrollDetailPlanSummary = scrollDetailPlanSummary;
window.openSelectedOfferInDepot = openSelectedOfferInDepot;
window.openOfferInDepot = openOfferInDepot;
window.openVariantDetail = openVariantDetail;
window.bulkSearch = bulkSearch;
window.selectBulkGroup = selectBulkGroup;
window.changeBulkRowQty = changeBulkRowQty;
window.setBulkRowQty = setBulkRowQty;
window.setPlanViewMode = setPlanViewMode;
window.openPlanApproval = openPlanApproval;
window.openPlanApprovalForItem = openPlanApprovalForItem;
window.closePlanApproval = closePlanApproval;
window.toggleApprovalSelection = toggleApprovalSelection;
window.setApprovalSelectionAll = setApprovalSelectionAll;
window.completeApprovalSelection = completeApprovalSelection;
window.openPlanInDepot = openPlanInDepot;
window.queuePlanItemForApproval = queuePlanItemForApproval;
window.removePlanApproval = removePlanApproval;
window.removeApprovalItem = removeApprovalItem;
window.addBulkRowToPlan = addBulkRowToPlan;
window.selectBulkOffer = selectBulkOffer;
window.addBulkOfferToPlan = addBulkOfferToPlan;
window.openBulkVariant = openBulkVariant;
window.returnToBulkDetail = returnToBulkDetail;
window.openHistorySearch = openHistorySearch;
window.openPlanPreview = openPlanPreview;
window.saveDepotSettings = saveDepotSettings;
window.testDepotLogin = testDepotLogin;
window.scrollToTop = scrollToTop;
window.toggleProfileMenu = toggleProfileMenu;
window.openProfileSettings = openProfileSettings;
window.refreshDepotStatuses = refreshDepotStatuses;
window.logoutCurrentUser = logoutCurrentUser;
window.toggleCompatPanel = toggleCompatPanel;
window.runCompatHealth = runCompatHealth;
window.runCompatDemo = runCompatDemo;
window.runCompatUpdate = runCompatUpdate;
window.changePlanQty = changePlanQty;
window.removePlanItemAndRender = removePlanItemAndRender;
window.selectPlanAlternative = selectPlanAlternative;

/* ═══════════════════════════════════════════════════
   V23 — SİPARİŞ PLANI GLASS MODAL
   Overlay dinamik DOM, ESC + dış tık + focus management.
   ═══════════════════════════════════════════════════ */
const V23_PLAN_MODAL = {
  overlayId: 'v23PlanOverlay',
  panelId: 'v23PlanOverlayPanel',
  previouslyFocused: null,
  keydownHandler: null,
  isOpen: false,
};

function v23PlanModalResolveDeps() {
  return {
    esc: typeof esc === 'function' ? esc : (v) => String(v == null ? '' : v),
    formatCurrency: typeof formatCurrency === 'function' ? formatCurrency : (v) => `${Number(v || 0).toFixed(2)} \u20BA`,
    depotBadgeHtml: typeof depotBadgeHtml === 'function' ? depotBadgeHtml : (_id, label) => `<span class="badge">${String(label || '')}</span>`,
    getPlan: typeof getOrderPlan === 'function' ? getOrderPlan : () => [],
  };
}

function v23PlanModalBuildSummary(plan, fmt) {
  const totalCost = plan.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  const totalQty = plan.reduce((sum, item) => sum + (Number(item.desiredQty) || 0), 0);
  const depots = new Set();
  plan.forEach((item) => {
    const label = String(item.depot || item.depotId || '').trim();
    if (label) depots.add(label);
  });
  return {
    itemCount: plan.length,
    totalQty,
    totalCost,
    depotCount: depots.size,
    fmt,
  };
}

function v23PlanModalRenderCard(item, deps) {
  const { esc: e, formatCurrency: fc, depotBadgeHtml: dbh } = deps;
  const name = e(item.name || item.ad || item.key || '');
  const qty = Number(item.desiredQty || 0);
  const badge = dbh(item.depotId, item.depot);
  const price = fc(item.totalCost || 0);
  const unit = fc(item.effectiveUnit || item.unitCost || 0);
  return `
    <div class="v23-plan-card">
      <div class="v23-plan-card__thumb" aria-hidden="true">
        <span class="material-symbols-outlined">medication</span>
      </div>
      <div class="v23-plan-card__main">
        <div class="v23-plan-card__name" title="${name}">${name}</div>
        <div class="v23-plan-card__meta">
          ${badge}
          <span class="v23-plan-card__qty">${qty} adet</span>
          <span>\u00B7 ${unit} / birim</span>
        </div>
      </div>
      <div class="v23-plan-card__price">${price}</div>
    </div>
  `;
}

function v23PlanModalRenderBody() {
  const deps = v23PlanModalResolveDeps();
  const plan = Array.isArray(deps.getPlan()) ? deps.getPlan() : [];
  const summary = v23PlanModalBuildSummary(plan, deps.formatCurrency);
  const cardsHtml = plan.length
    ? plan.map((item) => v23PlanModalRenderCard(item, deps)).join('')
    : '<div class="v23-plan-overlay__empty">Plan şu an boş. Detay ekranından ürün ekleyin.</div>';
  return { plan, summary, cardsHtml };
}

function v23PlanModalGetOrCreate() {
  let overlay = document.getElementById(V23_PLAN_MODAL.overlayId);
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = V23_PLAN_MODAL.overlayId;
  overlay.className = 'v23-plan-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `
    <div
      id="${V23_PLAN_MODAL.panelId}"
      class="v23-plan-overlay__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v23PlanOverlayTitle"
      tabindex="-1"
    ></div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) window.closeOrderPlanModal();
  });
  return overlay;
}

function v23PlanModalPaint() {
  const overlay = v23PlanModalGetOrCreate();
  const panel = overlay.querySelector(`#${V23_PLAN_MODAL.panelId}`);
  if (!panel) return overlay;
  const { plan, summary, cardsHtml } = v23PlanModalRenderBody();
  const fc = summary.fmt;
  panel.innerHTML = `
    <header class="v23-plan-overlay__header">
      <div class="v23-plan-overlay__title-wrap">
        <span class="v23-plan-overlay__eyebrow">Aktif Plan</span>
        <h2 class="v23-plan-overlay__title" id="v23PlanOverlayTitle">Sipariş Planı Özeti</h2>
        <div class="v23-plan-overlay__subtitle">${summary.itemCount} kalem \u00B7 ${summary.depotCount} depo \u00B7 ${summary.totalQty} adet toplam</div>
      </div>
      <button
        type="button"
        class="v23-plan-overlay__close"
        id="v23PlanOverlayCloseBtn"
        aria-label="Kapat"
        title="Kapat (Esc)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </header>
    <section class="v23-plan-overlay__summary" aria-label="Plan özeti">
      <div class="v23-plan-overlay__stat">
        <span class="v23-plan-overlay__stat-label">Kalem</span>
        <span class="v23-plan-overlay__stat-value">${summary.itemCount}</span>
      </div>
      <div class="v23-plan-overlay__stat">
        <span class="v23-plan-overlay__stat-label">Depo</span>
        <span class="v23-plan-overlay__stat-value">${summary.depotCount}</span>
      </div>
      <div class="v23-plan-overlay__stat">
        <span class="v23-plan-overlay__stat-label">Toplam Tutar</span>
        <span class="v23-plan-overlay__stat-value">${fc(summary.totalCost)}</span>
      </div>
    </section>
    <div class="v23-plan-overlay__body" role="list">
      ${cardsHtml}
    </div>
    <footer class="v23-plan-overlay__footer">
      <div class="v23-plan-overlay__footer-info">${plan.length ? `${plan.length} kalem listelendi` : 'Eklenmiş ürün yok'}</div>
      <div class="v23-plan-overlay__footer-actions">
        <button type="button" class="v23-plan-overlay__ghost-btn" id="v23PlanOverlayCloseBtn2">Kapat</button>
        <button type="button" class="v23-plan-overlay__primary-btn" id="v23PlanOverlayEditBtn">
          <span class="material-symbols-outlined" style="font-size:18px;">tune</span>
          <span>Planı düzenle ve gönder</span>
        </button>
      </div>
    </footer>
  `;

  overlay.querySelector('#v23PlanOverlayCloseBtn')?.addEventListener('click', () => window.closeOrderPlanModal());
  overlay.querySelector('#v23PlanOverlayCloseBtn2')?.addEventListener('click', () => window.closeOrderPlanModal());
  overlay.querySelector('#v23PlanOverlayEditBtn')?.addEventListener('click', () => {
    window.closeOrderPlanModal();
    if (typeof window.switchMock === 'function') window.switchMock('plan');
  });
  return overlay;
}

window.openOrderPlanModal = function openOrderPlanModal() {
  if (V23_PLAN_MODAL.isOpen) {
    v23PlanModalPaint();
    return;
  }
  V23_PLAN_MODAL.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = v23PlanModalPaint();
  document.body.classList.add('v23-plan-modal-open');
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    const panel = overlay.querySelector(`#${V23_PLAN_MODAL.panelId}`);
    if (panel && typeof panel.focus === 'function') panel.focus();
  });
  V23_PLAN_MODAL.keydownHandler = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      window.closeOrderPlanModal();
    }
  };
  document.addEventListener('keydown', V23_PLAN_MODAL.keydownHandler, true);
  V23_PLAN_MODAL.isOpen = true;
};

window.closeOrderPlanModal = function closeOrderPlanModal() {
  const overlay = document.getElementById(V23_PLAN_MODAL.overlayId);
  if (!overlay) {
    V23_PLAN_MODAL.isOpen = false;
    document.body.classList.remove('v23-plan-modal-open');
    return;
  }
  overlay.classList.remove('is-open');
  document.body.classList.remove('v23-plan-modal-open');
  if (V23_PLAN_MODAL.keydownHandler) {
    document.removeEventListener('keydown', V23_PLAN_MODAL.keydownHandler, true);
    V23_PLAN_MODAL.keydownHandler = null;
  }
  V23_PLAN_MODAL.isOpen = false;
  const restoreTarget = V23_PLAN_MODAL.previouslyFocused;
  V23_PLAN_MODAL.previouslyFocused = null;
  setTimeout(() => {
    if (restoreTarget && document.contains(restoreTarget) && typeof restoreTarget.focus === 'function') {
      try { restoreTarget.focus(); } catch (_err) { /* noop */ }
    }
  }, 260);
};

/* Event delegation: herhangi bir .nav-plan-btn veya [data-role="open-plan-modal"] tıklandığında modal açılır. */
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  let trigger = target.closest('.nav-plan-btn, [data-role="open-plan-modal"], #openOrderPlanBtn');
  if (!trigger) {
    const maybePlanBtn = target.closest('button.btn.btn-brand');
    if (maybePlanBtn && /sipariş\s*planı/i.test(String(maybePlanBtn.textContent || ''))) {
      trigger = maybePlanBtn;
    }
  }
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  window.openOrderPlanModal();
}, true);

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await bootstrapDomainBridge();
  } catch (e) {
    console.warn('[v2.3.1] Domain bridge bootstrap failed:', e?.message || e);
  }
  state.approvalQueue = getApprovalQueue();
  bindTitlebar();
  bindTopNav();
  document.getElementById('edit-drawer-overlay')?.addEventListener('click', closeDrawer);
  document.getElementById('bulk-drawer-overlay')?.addEventListener('click', closeBulkDrawer);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (state.mfCalculatorOpen && state.currentPage === 'search-detail') {
      state.mfCalculatorOpen = false;
      renderDetailPage();
      return;
    }
    closeDrawer();
    closeBulkDrawer();
  });
  try {
    await bootstrapApp();
    if (state.user) {
      await hydratePersistentClientState();
    }
  } catch (e) {
    console.warn('[v2.3.1] App bootstrap failed:', e?.message || e);
    // Show home anyway if we're past login
    if (state.currentPage === 'login' && state.user) {
      switchMock('home');
      renderCurrentPage();
    }
  }
});
