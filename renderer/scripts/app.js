const API_BASE = 'http://localhost:3000';

// ── Title bar controls ──
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

// ── Navigation with transitions ──
let currentPage = 'home';

function showPage(name) {
  if (name === currentPage) return;

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
      renderHomeHistory();
    }
    if (name === 'search') document.getElementById('searchInput').focus();
    if (name === 'settings') renderSettings();
    if (name === 'history') renderHistory();
  }, isBack ? 180 : 200);
}

// ── Profile menu ──
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

// ── Keyboard shortcuts ──
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
    if (document.getElementById('depotPanel').classList.contains('open')) {
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

// ── Barcode extraction & QR Parsing ──
function extractBarcode(kodu) {
  if (!kodu) return null;
  const str = String(kodu).trim();
  // Barkodlar genelde 86 ile başlar ve 13 hanelidir.
  if (str.length >= 13 && str.startsWith('8')) return str;
  return null;
}

/**
 * Karekod (GS1 DataMatrix) içinden 13 haneli barkodu ayıklar.
 * Örn: 010869953609011521... -> 8699536090115
 */
function parseQRCode(input) {
  if (!input) return null;
  const raw = String(input).trim();
  
  // 1. Zaten temiz barkodsa direkt döndür (0 dolgusuz 13 hane)
  if (/^869\d{10}$/.test(raw)) return raw;
  
  // 2. 0 ile başlayan 14 haneli (0+869...) ise 0'ı at
  if (/^0869\d{10}$/.test(raw)) return raw.substring(1);

  // 3. GS1 DataMatrix: 01 ile başlar, 14 haneli GTIN içerir
  if (raw.startsWith('01') && raw.length >= 16) {
    // 01(2 hane) + 0(dolgu 1 hane) + 13(barkod)
    const gtinCandidate = raw.substring(3, 16);
    if (gtinCandidate.startsWith('869')) return gtinCandidate;
    
    // Bazı dolgu senaryoları için (Padding check)
    const gtinCandidate2 = raw.substring(2, 15);
    if (gtinCandidate2.startsWith('869')) return gtinCandidate2;
  }

  // 4. Fallback search: Herhangi bir 869... 13 haneli dizisi bul
  const match = raw.match(/869\d{10}/);
  return match ? match[0] : raw;
}

// ── Search ──
let selectedBarcode = null;
let selectedVariant = null;

function normalizeDrugName(name) {
  if (!name) return 'Bilinmeyen İlaç Formu';
  let n = name.toUpperCase().replace(/İ/g, 'I');
  // Kısaltmaları normalize et
  n = n.replace(/\b(TABLET|TAB\.|TB\.|TAB|TB)\b/g, 'TAB');
  n = n.replace(/\b(KAPSUL|KAPSÜL|KAP\.|KPS\.)\b/g, 'KAP');
  n = n.replace(/\b(FILM TAB|FLM TAB|FLM\.TAB|F\.TAB|F\. TABLET|FILM TABLET)\b/g, 'FILM TAB');
  n = n.replace(/\b(SURUP|ŞURUP|SRP|SYR)\b/g, 'ŞURUP');
  n = n.replace(/\b(SUSPANSIYON|SÜSPANSİYON|SÜSP\.)\b/g, 'SÜSP');
  n = n.replace(/\b(PED\.|PEDIATRIK|PEDİATRİK)\b/g, 'PED');
  n = n.replace(/\s+/g, ' ').trim();
  return n;
}

let searchStartTime = 0;
const MIN_GATHER_TIME = 1500; // 1.5 saniye bekle ki kartlar zıplamasın

let lastSearchQuery = null;
let lastSearchTime = 0;

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

  // 300ms içinde aynı arama geldiyse (karekod hızı) blokla
  if (query === lastSearchQuery && (nowTime - lastSearchTime < 300)) return;
  
  lastSearchQuery = query;
  lastSearchTime = nowTime;
  selectedVariant = null;
  searchStartTime = nowTime;
  selectedBarcode = null; 
  if (!query) return;

  const loading = document.getElementById('loading');
  const status = document.getElementById('statusMsg');

  loading.style.display = 'block';
  status.textContent = 'Sonuçlar aranıyor...';
  status.className = 'status-msg';

  if (!cachedConfig) {
    await loadDepotStatus();
  }

  const activeDepots = DEPOT_LIST.filter(d => {
    const info = (cachedConfig.depots && cachedConfig.depots[d.id]) ? cachedConfig.depots[d.id] : null;
    return info && (info.hasCredentials || info.hasCookies || info.hasToken);
  });

  if (activeDepots.length === 0) {
    loading.style.display = 'none';
    status.textContent = 'Ayarlanmış depo bulunamadı.';
    return;
  }

  let allItems = [];
  let pendingReqs = activeDepots.length;

  // Ekran titremesini önle: UI'ı sadece ilk 100ms'den sonra temizle (eğer sonuç yoksa)
  setTimeout(() => {
    if (Date.now() - searchStartTime >= 100) {
      const resultsBody = document.getElementById('resultsBody');
      if (resultsBody) resultsBody.innerHTML = '';
    }
  }, 100);

  document.getElementById('variantSelectionLayer').style.display = 'none';
  document.getElementById('productCard').style.display = 'none';
  document.getElementById('bestPriceCard').style.display = 'none';
  document.getElementById('otherDepots').style.display = 'none';
  document.getElementById('stockCalcPanel').classList.remove('open');
  document.getElementById('stockCalcTrigger').style.display = 'none';
  document.getElementById('stockCalcTrigger').classList.remove('open');

  activeDepots.forEach(depot => {
    fetch(`${API_BASE}/api/search-depot?q=${encodeURIComponent(query)}&depotId=${depot.id}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.results && data.results.length > 0) {
          const depotUrl = data.depotUrl || '';
          data.results.forEach(r => { r.depotUrl = depotUrl; r.depotId = depot.id; });
          allItems = allItems.concat(data.results);
          allItems.sort((a, b) => {
            if (a.fiyatNum === 0 && b.fiyatNum !== 0) return 1;
            if (b.fiyatNum === 0 && a.fiyatNum !== 0) return -1;
            return a.fiyatNum - b.fiyatNum;
          });
          renderResults(allItems, query);
        }
      })
      .catch(err => {
        console.error(`${depot.name} error:`, err);
      })
      .finally(() => {
        pendingReqs--;
        if (pendingReqs === 0) {
          loading.style.display = 'none';
          if (allItems.length === 0) {
            status.textContent = 'İlaç bulunamadı (veya stokta yok).';
          } else {
            status.textContent = '';
            saveHistory(allItems, query);
          }
        }
      });
  });
}

function renderResults(items, query) {
  if (!items || items.length === 0) return;

  const isBarcode = /^\d{8,}$/.test(query);
  const now = Date.now();
  const elapsed = now - searchStartTime;

  // 1.5 saniye dolmadan sonuç gösterme (Görsel stabilite için)
  if (!isBarcode && selectedVariant === null && elapsed < MIN_GATHER_TIME) {
    return;
  }

  if (isBarcode || selectedVariant !== null) {
    // If scanning a barcode or if user already picked a variant, show final details.
    const filteredItems = isBarcode ? items : items.filter(i => normalizeDrugName(i.ad) === selectedVariant);
    
    // Switch UI
    document.getElementById('variantSelectionLayer').style.display = 'none';
    
    if (filteredItems.length > 0) {
      renderDetailResults(filteredItems, query);
    }
    return;
  }

  // Not a barcode and no variant selected yet: GROUP MODE
  
  // 1. AŞAMA: İsim -> Barkod haritası çıkar (Bir depoda barkod varsa diğerindeki barkodsuz aynı ismi besleyelim)
  const nameToBarcode = new Map();
  items.forEach(i => {
    const barcode = i.barkod || extractBarcode(i.kodu);
    const norm = normalizeDrugName(i.ad);
    if (barcode && !nameToBarcode.has(norm)) {
      nameToBarcode.set(norm, barcode);
    }
  });

  // 2. AŞAMA: Gruplama yap
  const groups = new Map();
  items.forEach(i => {
    let barcode = i.barkod || extractBarcode(i.kodu);
    const normName = normalizeDrugName(i.ad);
    
    // Cross-ref: Eğer bu isme ait bir barkod başka bir depoda varsa onu kullan
    if (!barcode && nameToBarcode.has(normName)) {
      barcode = nameToBarcode.get(normName);
    }

    const groupKey = barcode || ("NAME_" + normName);
    const hasValidImg = i.imgUrl && !['yok', 'no-image', 'c=.png'].some(k => i.imgUrl.includes(k));

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: groupKey,
        barcode: barcode,
        normalizedName: normName,
        originalName: i.ad,
        count: 0,
        bestPrice: Infinity,
        imgUrl: hasValidImg ? i.imgUrl : null
      });
    }
    const g = groups.get(groupKey);
    g.count++;
    
    if (i.fiyatNum > 0 && i.fiyatNum < g.bestPrice) {
      g.bestPrice = i.fiyatNum;
    }
    
    if (!g.imgUrl && hasValidImg) g.imgUrl = i.imgUrl;
    
    // İsim temizleme: En kısa olanı (en jenerik olanı) seç
    if (i.ad.length < g.originalName.length) {
      g.originalName = i.ad;
    }
  });

  const uniqueGroups = Array.from(groups.values());

  if (uniqueGroups.length === 1) {
    // Auto-select if only 1 variant exists (or if normalization merged everything into 1)
    selectedVariant = uniqueGroups[0].normalizedName;
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
    const priceText = hasPrice ? `₺${g.bestPrice.toFixed(2)}'den başlayan` : 'Stokta yok';
    
    card.innerHTML = `
      <div class="v-list-img">
        ${g.imgUrl ? `<img src="${g.imgUrl}" alt="">` : `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
        `}
      </div>
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
        selectedVariant = g.normalizedName;
        renderResults(allItems, query);
      }
    };

    container.appendChild(card);
  });
}

function renderDetailResults(items, query) {
  if (!items || items.length === 0) return;

  const productCard = document.getElementById('productCard');
  const bestPriceCard = document.getElementById('bestPriceCard');
  const otherDepots = document.getElementById('otherDepots');
  const tbody = document.getElementById('resultsBody');

  const firstName = items[0].ad || query;
  document.getElementById('productName').textContent = firstName;
  const barcodeTag = document.getElementById('productBarcode');
  const barcodeText = document.getElementById('productBarcodeText');

  const isBarcode = /^\d{8,}$/.test(query);
  if (isBarcode) {
    barcodeText.textContent = query;
    barcodeTag.style.display = 'inline-flex';
  } else {
    barcodeTag.style.display = 'none';
  }
  document.getElementById('productCount').textContent = 'Toplam ' + items.length + ' Teklif Bulundu';

  const imgEl = document.getElementById('productImg');
  const invalidImageKeywords = ['yok', 'no-image', 'noimage', 'default', 'c=.png'];
  const preferredDepotOrder = ['Selçuk Ecza', 'Sentez B2B', 'Nevzat Ecza', 'Anadolu İtriyat', 'Alliance Healthcare', 'Anadolu Pharma'];
  const imgCandidates = items.filter(i => {
    if (!i.imgUrl || i.imgUrl.trim() === '') return false;
    const lower = String(i.imgUrl).toLowerCase();
    return !invalidImageKeywords.some(k => lower.includes(k));
  });
  imgCandidates.sort((a, b) => {
    let indexA = preferredDepotOrder.indexOf(a.depot);
    let indexB = preferredDepotOrder.indexOf(b.depot);
    if (indexA === -1) indexA = 99;
    if (indexB === -1) indexB = 99;
    return indexA - indexB;
  });
  const firstValidImg = imgCandidates.length > 0 ? imgCandidates[0].imgUrl : null;

  const imgFallback = document.getElementById('productImgFallback');
  if (firstValidImg) {
    imgEl.src = firstValidImg;
    imgEl.style.display = 'block';
    imgFallback.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    imgFallback.style.display = 'block';
  }
  productCard.style.display = 'flex';
  productCard.classList.add('result-card-enter');
  setTimeout(() => productCard.classList.remove('result-card-enter'), 400);

  const bestItem = items.find(i => i.fiyatNum > 0) || items[0];
  document.getElementById('bestDepotName').textContent = bestItem.depot;
  document.getElementById('bestPrice').textContent = '₺' + bestItem.fiyat;

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

  bestPriceCard.style.display = 'block';
  bestPriceCard.classList.add('result-best-enter');
  setTimeout(() => bestPriceCard.classList.remove('result-best-enter'), 500);

  const otherItems = items.filter(i => i !== bestItem);
  tbody.innerHTML = '';
  if (otherItems.length > 0) {
    otherItems.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'stagger-enter stagger-delay-' + Math.min(idx, 9);
      const isInStock = item.stokVar;
      const stockStr = isInStock
        ? (item.stok > 0 && item.stokGosterilsin ? item.stok + ' Adet' : 'Stokta var')
        : 'Stok yok';

      const depotBtnHtml = item.depotUrl
        ? `<button class="btn-depot-link" data-url="${esc(item.depotUrl)}" data-depot-id="${esc(item.depotId || '')}">Depoya Git <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></button>`
        : '';

      tr.innerHTML = `
        <td>
          <div class="depot-name-cell">
            <div class="depot-icon-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </div>
            <span class="depot-name-text">${esc(item.depot)}</span>
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
        <td class="price-cell">₺${esc(item.fiyat)}</td>
        <td>${depotBtnHtml}</td>
      `;

      const btn = tr.querySelector('.btn-depot-link');
      if (btn) {
        btn.addEventListener('click', () => {
          copyAndOpenDepot(btn.dataset.url, btn.dataset.depotId);
        });
      }

      tbody.appendChild(tr);
    });
    otherDepots.style.display = 'block';
    otherDepots.classList.add('result-table-enter');
    setTimeout(() => otherDepots.classList.remove('result-table-enter'), 500);
  } else {
    otherDepots.style.display = 'none';
  }

  initStockCalc(items);
}

function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ═══════════════════════════════════════════════════
// STOCK CALCULATOR
// ═══════════════════════════════════════════════════
let _scItems = [];
let _scActiveQty = null;

function parseMf(mfStr) {
  if (!mfStr) return null;
  const m = String(mfStr).match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return null;
  const buy = parseInt(m[1], 10);
  const free = parseInt(m[2], 10);
  if (buy <= 0 || free <= 0) return null;
  return { buy, free, total: buy + free };
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
          ad: item.ad,
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
        ad: item.ad,
      };
    });

  const bestPerDepot = new Map();
  allOptions.forEach(opt => {
    const key = opt.depot;
    if (!bestPerDepot.has(key) || opt.effectiveUnit < bestPerDepot.get(key).effectiveUnit) {
      bestPerDepot.set(key, opt);
    }
  });

  return Array.from(bestPerDepot.values()).sort((a, b) => a.effectiveUnit - b.effectiveUnit);
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
    let sub = `<span class="mf-chip-label">${s.buy} al → ${s.qty}</span>`;
    if (isBest) sub += ` <span class="mf-chip-best">★ en uygun</span>`;
    chip.innerHTML = label + ' ' + sub;
    chip.addEventListener('click', () => {
      document.getElementById('stockQtyInput').value = s.qty;
      _scActiveQty = s.qty;
      document.querySelectorAll('.mf-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderStockCalc(items, s.qty);
    });
    chipsContainer.appendChild(chip);
  });
}

function renderStockCalc(items, qty) {
  const container = document.getElementById('stockCalcResults');
  if (!qty || qty <= 0) {
    container.innerHTML = '';
    return;
  }

  const options = calcMfOptions(items, qty);
  if (options.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-3); font-size:13px;">Fiyat verisi bulunamadı.</div>';
    return;
  }

  const bestEff = options[0].effectiveUnit;
  container.innerHTML = options.map((opt, idx) => {
    const isBest = idx === 0;
    const saving = opt.effectiveUnit > bestEff
      ? ((1 - bestEff / opt.effectiveUnit) * 100).toFixed(1)
      : 0;

    const mfDetail = opt.mf
      ? `MF <strong>${opt.mfStr}</strong> · ${opt.orderQty} al → ${opt.receiveQty} gel`
      : `Kampanyasız · ${opt.orderQty} adet`;

    return `
      <div class="sc-row ${isBest ? 'sc-best' : ''}">
        <div class="sc-rank">${idx + 1}</div>
        <div class="sc-depot">
          <div class="sc-depot-name">${esc(opt.depot)}</div>
          <div class="sc-depot-detail">${mfDetail}</div>
        </div>
        <div class="sc-prices">
          ${isBest ? '<div class="sc-best-badge">EN UYGUN</div>' : ''}
          <div class="sc-unit-price">₺${opt.effectiveUnit.toFixed(2).replace('.', ',')}</div>
          <div class="sc-total-price">Toplam: ₺${opt.totalCost.toFixed(2).replace('.', ',')}</div>
          ${!isBest && saving > 0 ? `<div class="sc-saving">1. sıra %${saving} daha ucuz</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function initStockCalc(items) {
  _scItems = items;
  _scActiveQty = null;

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
      _scActiveQty = val;
      document.querySelectorAll('.mf-chip').forEach(c => {
        const chipQty = parseInt(c.textContent, 10);
        c.classList.toggle('active', chipQty === val);
      });
      renderStockCalc(_scItems, val);
    } else {
      document.getElementById('stockCalcResults').innerHTML = '';
      document.querySelectorAll('.mf-chip').forEach(c => c.classList.remove('active'));
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

// ── Depoya Git — open in depot panel ──
function copyAndOpenDepot(url, depotId) {
  const textToCopy = selectedBarcode
    || document.getElementById('searchInput').value.trim()
    || '';

  if (textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('"' + textToCopy + '" kopyalandı');
    }).catch(() => {});
  }

  if (window.electronAPI && typeof openDepotPanel === 'function') {
    openDepotPanel(url, depotId, textToCopy);
  } else {
    window.open(url, '_blank');
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── Autocomplete ──
function setupAutocomplete(inputId, suggestionsId, onSelect) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(suggestionsId);
  let debounceTimer = null;
  let abortController = null;
  let selectedIndex = -1;

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

    debounceTimer = setTimeout(() => fetchSuggestions(q), 300);
  });

  async function fetchSuggestions(q) {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    dropdown.innerHTML = '<div class="suggestion-loading">Aranıyor...</div>';
    dropdown.classList.add('open');

    try {
      const res = await fetch(API_BASE + '/api/autocomplete?q=' + encodeURIComponent(q), {
        signal: abortController.signal,
      });
      const data = await res.json();

      if (!data.suggestions || data.suggestions.length === 0) {
        dropdown.innerHTML = '<div class="suggestion-loading">Sonuç bulunamadı</div>';
        return;
      }

      dropdown.innerHTML = '';
      const items = data.suggestions.slice(0, 10);
      const regex = new RegExp('(' + escRegex(q) + ')', 'gi');

      items.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        const highlighted = esc(item.ad).replace(regex, '<mark>$1</mark>');
        const barcode = item.barcode || extractBarcode(item.kodu);
        div.innerHTML = `
          <span class="suggestion-name">${highlighted}</span>
          <span class="suggestion-meta">
            ${barcode ? '<span class="suggestion-code">' + esc(barcode) + '</span>' : ''}
            <span class="suggestion-price">₺${esc(item.fiyat)}</span>
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
    } catch (err) {
      if (err.name !== 'AbortError') {
        dropdown.innerHTML = '<div class="suggestion-loading">Hata oluştu</div>';
      }
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

// ── Depot status ──
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
    const res = await fetch(API_BASE + '/api/config');
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
  } catch (e) {}
}

loadDepotStatus();

// ── Settings ──
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

function renderSettings() {
  const container = document.getElementById('settingsContainer');
  container.innerHTML = '';

  for (const [depotId, form] of Object.entries(DEPOT_FORMS)) {
    const depotInfo = cachedConfig?.depots?.[depotId];
    const isConfigured = depotInfo && (depotInfo.hasCredentials || depotInfo.hasCookies || depotInfo.hasToken);
    const card = document.createElement('div');
    card.className = 'settings-card';

    let fieldsHtml = '<div class="form-row">';
    form.fields.forEach(f => {
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
          <label>Manuel Cookie (opsiyonel — DevTools cookie'si yapıştır)</label>
          <textarea id="${depotId}-cookies" placeholder="Cookie string..."></textarea>
          <div class="hint">Chrome DevTools → Application → Cookies</div>
        </div>
      `;
    }
    if (form.hasTokenField) {
      extraHtml += `
        <hr class="divider" />
        <div class="form-group">
          <label>Manuel JWT Token (opsiyonel)</label>
          <textarea id="${depotId}-token" placeholder="eyJ..."></textarea>
          <div class="hint">Chrome DevTools → Network → Authorization header'dan kopyalayın</div>
        </div>
      `;
    }

    card.innerHTML = `
      <h3>
        ${esc(form.name)}
        <span class="badge ${isConfigured ? 'badge-ok' : 'badge-off'}">${isConfigured ? 'bağlı' : 'bağlı değil'}</span>
      </h3>
      ${fieldsHtml}
      <div class="btn-row">
        <button class="btn btn-primary" data-action="test-login" data-depot="${depotId}">Giriş Yap & Kaydet</button>
        <button class="btn btn-outline" data-action="save" data-depot="${depotId}">Sadece Kaydet</button>
        ${isConfigured ? '<button class="btn btn-danger" data-action="delete" data-depot="' + depotId + '">Sil</button>' : ''}
        <span id="${depotId}-status" class="action-status"></span>
      </div>
      ${extraHtml}
    `;

    card.querySelector('[data-action="test-login"]')?.addEventListener('click', () => testDepotLogin(depotId));
    card.querySelector('[data-action="save"]')?.addEventListener('click', () => saveDepot(depotId));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteDepot(depotId));

    container.appendChild(card);
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
    const res = await fetch(API_BASE + '/api/test-login', {
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
    const res = await fetch(API_BASE + '/api/config/depot', {
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
    await fetch(API_BASE + '/api/config/depot/' + depotId, { method: 'DELETE' });
    await loadDepotStatus();
    renderSettings();
  } catch (e) {}
}

// ── History ──
function saveHistory(items, query) {
  if (!items || items.length === 0) return;
  const bestItem = items.find(i => i.fiyatNum > 0) || items[0];
  const isBarcode = /^\d{8,}$/.test(query);
  fetch(API_BASE + '/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ilac: bestItem.ad || query,
      barkod: isBarcode ? query : null,
      sonuclar: items.map(i => ({
        depot: i.depot,
        fiyat: i.fiyat,
        stok: i.stokVar,
        mf: i.malFazlasi || '',
      })),
      enUcuz: { depot: bestItem.depot, fiyat: bestItem.fiyat },
    }),
  }).then(() => {
    renderHomeHistory();
    if (currentPage === 'history') renderHistory();
  }).catch(() => {});
}

async function fetchHistory(limit = 100) {
  const res = await fetch(API_BASE + '/api/history?limit=' + limit);
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
      const bestPrice = entry.enUcuz ? '₺' + entry.enUcuz.fiyat : '-';

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

    if (!history || history.length === 0) {
      container.innerHTML = '<div class="status-msg">Henüz arama geçmişi yok.</div>';
      return;
    }

    let html = `
      <div class="others-table-wrap">
        <table class="others-table">
          <thead>
            <tr>
              <th>TARİH</th>
              <th>İLAÇ</th>
              <th>EN UCUZ DEPO</th>
              <th style="text-align:right">FİYAT</th>
              <th>TEKLİF</th>
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
          <td class="price-cell">${entry.enUcuz ? '₺' + esc(entry.enUcuz.fiyat) : '-'}</td>
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
    container.innerHTML = '<div class="status-msg error">Geçmiş yüklenemedi: ' + esc(err.message) + '</div>';
  }
}

async function deleteHistory(id) {
  await fetch(API_BASE + '/api/history/' + id, { method: 'DELETE' });
  renderHomeHistory();
  renderHistory();
}

renderHomeHistory();
