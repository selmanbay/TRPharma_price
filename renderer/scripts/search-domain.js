/**
 * search-domain.js
 * Search data/domain owner for V2.3 runtime.
 */
(function initV23SearchDomain(globalScope) {
  if (!globalScope) return;

  function normalizeSearchText(value) {
    return String(value || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9ığüşöç\s]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshteinDistance(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (!left) return right.length;
    if (!right) return left.length;
    const cols = right.length + 1;
    const prev = new Array(cols);
    const curr = new Array(cols);
    for (let j = 0; j < cols; j += 1) prev[j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + cost
        );
      }
      for (let j = 0; j < cols; j += 1) prev[j] = curr[j];
    }
    return prev[right.length];
  }

  function scoreSearchSimilarity(query, candidate) {
    const q = normalizeSearchText(query);
    const c = normalizeSearchText(candidate);
    if (!q || !c) return 0;
    if (q === c) return 1000;

    let score = 0;
    if (c.startsWith(q)) score += 700;
    else if (c.includes(q)) score += 500;

    const qTokens = q.split(' ').filter(Boolean);
    const cTokens = c.split(' ').filter(Boolean);
    const tokenHits = qTokens.reduce((count, token) => {
      if (cTokens.some((item) => item.startsWith(token) || item.includes(token))) return count + 1;
      return count;
    }, 0);
    score += Math.round((tokenHits / Math.max(qTokens.length, 1)) * 200);

    const distance = levenshteinDistance(q, c);
    score += Math.max(0, 200 - (distance * 10));
    return score;
  }

  function sortDepotItems(items) {
    return (items || []).slice().sort((a, b) => {
      const aPrice = Number(a?.fiyatNum) || Number.MAX_SAFE_INTEGER;
      const bPrice = Number(b?.fiyatNum) || Number.MAX_SAFE_INTEGER;
      if (aPrice !== bPrice) return aPrice - bPrice;
      const aStock = Number(a?.stok) || 0;
      const bStock = Number(b?.stok) || 0;
      return bStock - aStock;
    });
  }

  function getItemBarcode(item, fallbackQuery = '', deps = {}) {
    const { extractBarcode, parseQRCode, isBarcodeQuery } = deps;
    const direct = String(item?.barkod || '').trim();
    if (direct) return direct;
    if (typeof extractBarcode === 'function') {
      const extracted = extractBarcode(item?.kodu);
      if (extracted) return extracted;
    }
    if (typeof parseQRCode === 'function' && typeof isBarcodeQuery === 'function') {
      const parsed = parseQRCode(fallbackQuery);
      return isBarcodeQuery(parsed) ? parsed : '';
    }
    return '';
  }

  function getBarcodeHints(items, fallbackQuery = '', deps = {}) {
    const { normalizeDrugName } = deps;
    const hints = new Map();
    for (const item of items || []) {
      const barcode = getItemBarcode(item, fallbackQuery, deps);
      const nameKey = typeof normalizeDrugName === 'function' ? normalizeDrugName(item?.ad) : '';
      if (barcode && nameKey && !hints.has(nameKey)) {
        hints.set(nameKey, barcode);
      }
    }
    return hints;
  }

  function resolveItemBarcode(item, barcodeHints, fallbackQuery = '', deps = {}) {
    const { normalizeDrugName } = deps;
    const nameKey = typeof normalizeDrugName === 'function' ? normalizeDrugName(item?.ad) : '';
    return getItemBarcode(item, fallbackQuery, deps) || barcodeHints.get(nameKey) || '';
  }

  function getItemIdentityKey(item, barcodeHints, fallbackQuery = '', deps = {}) {
    const { normalizeDrugName } = deps;
    if (item?.entityId) return String(item.entityId);
    const barcode = resolveItemBarcode(item, barcodeHints, fallbackQuery, deps);
    if (barcode) return `BARCODE_${barcode}`;
    const normalized = item?.normalizedName || (typeof normalizeDrugName === 'function' ? normalizeDrugName(item?.ad || item?.name) : '');
    return `NAME_${normalized}`;
  }

  function chooseCanonicalProductName(items, fallbackName = '') {
    const names = (items || []).map((item) => String(item?.ad || item?.name || '').trim()).filter(Boolean);
    if (!names.length) return fallbackName || 'Bilinmeyen Ilac';
    names.sort((a, b) => a.length - b.length || a.localeCompare(b, 'tr'));
    return names[0];
  }

  function resolveProductImage(item, depotUrl = '', deps = {}) {
    const { normalizeImageUrl, isUsableImageUrl } = deps;
    const raw = item?.imageUrl || item?.imgUrl || '';
    if (!raw) return '';
    const normalized = typeof normalizeImageUrl === 'function'
      ? normalizeImageUrl(raw, item?.depotUrl || depotUrl || '')
      : String(raw).trim();
    if (!normalized) return '';
    if (typeof isUsableImageUrl === 'function' && !isUsableImageUrl(normalized)) return '';
    return normalized;
  }

  function buildVariantGroups(items, query, deps = {}) {
    const hints = getBarcodeHints(items, query, deps);
    const groups = new Map();
    for (const item of items || []) {
      const identityKey = getItemIdentityKey(item, hints, query, deps);
      if (!groups.has(identityKey)) groups.set(identityKey, []);
      groups.get(identityKey).push({
        ...item,
        barkod: resolveItemBarcode(item, hints, query, deps),
      });
    }

    return Array.from(groups.entries()).map(([key, groupItems]) => {
      const psfCandidate = groupItems.find((item) => Number(item?.psfFiyatNum) > 0);
      const psfFiyatNum = Number(psfCandidate?.psfFiyatNum) || 0;
      const sorted = sortDepotItems(groupItems).map((item) => ({
        ...item,
        psfFiyatNum: Number(item?.psfFiyatNum) > 0 ? Number(item.psfFiyatNum) : psfFiyatNum,
      }));
      const canonicalName = chooseCanonicalProductName(sorted, query);
      const bestItem = sorted[0] || null;
      const textScore = scoreSearchSimilarity(query, canonicalName);
      const barcodeScore = bestItem?.barkod && String(query || '').trim() === String(bestItem.barkod || '').trim() ? 400 : 0;
      return {
        key,
        barcode: sorted.find((item) => item.barkod)?.barkod || '',
        name: canonicalName,
        psfFiyatNum,
        items: sorted,
        bestItem,
        relevanceScore: textScore + barcodeScore,
      };
    }).sort((a, b) => {
      const aScore = Number(a.relevanceScore) || 0;
      const bScore = Number(b.relevanceScore) || 0;
      if (aScore !== bScore) return bScore - aScore;
      const aPrice = Number(a.bestItem?.fiyatNum) || Number.MAX_SAFE_INTEGER;
      const bPrice = Number(b.bestItem?.fiyatNum) || Number.MAX_SAFE_INTEGER;
      return aPrice - bPrice;
    });
  }

  function normalizeDepotItem(input, deps = {}) {
    const {
      item,
      depotId,
      depotUrl,
      searchQuery = '',
    } = input || {};
    const {
      DrugEntity,
      createDrugOperationEntity,
      getPlanSnapshotForIdentity,
      getItemBarcode,
      formatCurrency,
      normalizeDrugName,
      fixMojibakeText,
      normalizeImageUrl,
      isUsableImageUrl,
      DEPOT_META,
    } = deps || {};

    let entity = null;
    if (DrugEntity) {
      try {
        entity = new DrugEntity({ ...(item || {}), depotUrl }, depotId);
      } catch {
        entity = null;
      }
    }

    const price = Number(item?.fiyatNum) || Number(String(item?.fiyat || '').replace(',', '.')) || 0;
    const psf = Number(entity?.psf)
      || Number(item?.psfFiyatNum)
      || Number(String(item?.psf || item?.psfFiyat || item?.perakende || '').replace(',', '.'))
      || 0;
    const mfStr = String(entity?.mfString || item?.mfStr || item?.malFazlasi || item?.MalFazlasi || item?.overage || item?.Overage || '').trim();
    const normalizedPrice = Number(entity?.price) || price;
    const normalizedStock = Number(entity?.stockCount) || Number(item?.stok) || 0;
    const rawName = entity?.name || item?.ad || item?.name || '';
    const resolvedName = typeof fixMojibakeText === 'function' ? fixMojibakeText(rawName) : rawName;
    const resolvedBarcode = (typeof getItemBarcode === 'function'
      ? String(getItemBarcode(item, searchQuery) || '').trim()
      : '')
      || String(entity?.barcode || item?.barkod || item?.barcode || '').trim();
    const rawDepot = item?.depot || entity?.depotName || DEPOT_META?.[depotId]?.label || depotId;
    const normalizedDepot = typeof fixMojibakeText === 'function' ? fixMojibakeText(rawDepot) : rawDepot;
    const globalRef = typeof globalScope !== 'undefined' ? globalScope : null;
    const canonBc = resolvedBarcode && globalRef?.normalizeProductBarcode
      ? String(globalRef.normalizeProductBarcode(resolvedBarcode) || '').trim()
      : resolvedBarcode;
    const planSnapKey = (canonBc && globalRef?.isBarcodeQuery && globalRef.isBarcodeQuery(canonBc))
      ? `BARCODE_${canonBc}`
      : (item?.key || canonBc || resolvedName);
    const planSnapshot = typeof getPlanSnapshotForIdentity === 'function'
      ? getPlanSnapshotForIdentity(
        planSnapKey,
        depotId,
        normalizedDepot,
        canonBc || resolvedBarcode
      )
      : null;

    const resolvedImageUrl = resolveProductImage(
      {
        ...item,
        imageUrl: entity?.imageUrl || item?.imageUrl || item?.imgUrl || '',
        depotUrl: item?.depotUrl || depotUrl || '',
      },
      depotUrl,
      { normalizeImageUrl, isUsableImageUrl }
    );

    const normalizedBase = {
      ...item,
      ad: resolvedName,
      name: resolvedName,
      barkod: resolvedBarcode,
      barcode: resolvedBarcode,
      depotId,
      depot: normalizedDepot,
      depotUrl: item?.depotUrl || depotUrl || '',
      fiyat: item?.fiyat || entity?.priceString || (typeof formatCurrency === 'function' ? formatCurrency(normalizedPrice) : String(normalizedPrice)),
      fiyatNum: normalizedPrice,
      psf: psf,
      psfFiyatNum: psf,
      psfFiyat: entity?.psfString || item?.psfFiyat || item?.perakende || '',
      mfStr,
      malFazlasi: mfStr,
      stok: normalizedStock,
      stokVar: item?.stokVar !== false && normalizedStock > 0,
      imageUrl: resolvedImageUrl,
      normalizedName: entity?.normalizedName || (typeof normalizeDrugName === 'function' ? normalizeDrugName(resolvedName) : resolvedName),
      entityId: entity?.id || '',
      inPlan: Boolean(planSnapshot?.inPlan),
      planQty: Number(planSnapshot?.desiredQty) || 0,
      approvalStatus: planSnapshot?.approvalStatus || '',
      approvedAt: planSnapshot?.approvedAt || '',
    };

    if (typeof createDrugOperationEntity === 'function') {
      const operationEntity = createDrugOperationEntity({
        ...normalizedBase,
        key: normalizedBase.entityId || normalizedBase.barcode || normalizedBase.name,
        desiredQty: normalizedBase.planQty || 1,
        operationSource: 'search',
        inPlan: normalizedBase.inPlan,
      }, {
        source: 'search',
        key: normalizedBase.entityId || normalizedBase.barcode || normalizedBase.name,
        inPlan: normalizedBase.inPlan,
        sourceQuery: searchQuery || '',
      });
      if (operationEntity?.toSearchItem) {
        const searchItem = operationEntity.toSearchItem();
        // toSearchItem() DrugEntity.imageUrl doner; normalize edilmeden goreli kalabiliyor.
        // normalizedBase.imageUrl genelde resolveProductImage ciktisi; yine de tek satirda depotUrl ile netlestir.
        const rawPick = (normalizedBase.imageUrl && String(normalizedBase.imageUrl).trim())
          || (searchItem.imageUrl && String(searchItem.imageUrl).trim())
          || '';
        const mergedImage = rawPick && typeof normalizeImageUrl === 'function'
          ? (normalizeImageUrl(rawPick, normalizedBase.depotUrl || '') || '')
          : rawPick;
        return {
          ...normalizedBase,
          ...searchItem,
          normalizedName: entity?.normalizedName || (typeof normalizeDrugName === 'function' ? normalizeDrugName(resolvedName) : resolvedName),
          imageUrl: mergedImage,
          imgUrl: mergedImage || searchItem.imgUrl || normalizedBase.imgUrl || '',
        };
      }
    }

    return normalizedBase;
  }

  function normalizeDepotResults(data, depotId, deps = {}) {
    const depotUrl = data?.depotUrl || '';
    return (data?.results || []).map((item) => normalizeDepotItem({
      item,
      depotId,
      depotUrl,
      searchQuery: deps?.searchQuery || '',
    }, deps));
  }

  async function searchDepot(input, deps = {}) {
    const { depotId, query, signal } = input || {};
    const { API_BASE, authFetch } = deps || {};
    const url = `${API_BASE}/api/search-depot?q=${encodeURIComponent(query)}&depotId=${encodeURIComponent(depotId)}`;
    const res = await authFetch(url, { signal });
    if (!res.ok) {
      return { depotId, results: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      ...data,
      depotId,
      results: normalizeDepotResults(data, depotId, deps),
    };
  }

  async function searchAcrossDepotsProgressive(input, deps = {}) {
    const {
      query,
      signal,
      onDepotResult = null,
    } = input || {};
    const {
      configuredDepotIds,
      runConcurrent,
    } = deps || {};

    const depotIds = configuredDepotIds();
    if (!depotIds.length) throw new Error('Bagli depo yok');
    const tasks = depotIds.map((depotId) => async () => {
      const response = await searchDepot({ depotId, query, signal }, deps).catch((error) => {
        if (error?.name === 'AbortError') throw error;
        return {
          depotId,
          results: [],
          error: error?.message || 'Arama hatasi',
        };
      });
      if (typeof onDepotResult === 'function') onDepotResult(response, depotId);
      return response;
    });
    return runConcurrent(tasks, Math.min(4, tasks.length));
  }

  async function searchAcrossDepots(input, deps = {}) {
    const responses = await searchAcrossDepotsProgressive(input, deps);
    return responses.flatMap((response) => response.results || []);
  }

  globalScope.V23SearchDomain = {
    sortDepotItems,
    getItemBarcode,
    getBarcodeHints,
    resolveItemBarcode,
    getItemIdentityKey,
    chooseCanonicalProductName,
    buildVariantGroups,
    normalizeDepotItem,
    normalizeDepotResults,
    searchDepot,
    searchAcrossDepotsProgressive,
    searchAcrossDepots,
  };
})(typeof window !== 'undefined' ? window : null);
