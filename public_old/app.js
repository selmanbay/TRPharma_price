// ── Navigation ──
    function showPage(name) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + name).classList.add('active');
      if (name === 'home') document.getElementById('homeSearchInput').focus();
      if (name === 'search') document.getElementById('searchInput').focus();
      if (name === 'settings') renderSettings();
      if (name === 'history') renderHistory();
    }

    // ── Profile menu ──
    function toggleProfileMenu() {
      document.querySelector('.profile-wrapper').classList.toggle('open');
    }

    function closeProfileMenu() {
      document.querySelector('.profile-wrapper').classList.remove('open');
    }

    // Close profile menu on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.profile-wrapper')) {
        closeProfileMenu();
      }
    });

    function homeSearch() {
      const q = document.getElementById('homeSearchInput').value.trim();
      if (!q) return;
      document.getElementById('searchInput').value = q;
      showPage('search');
      doSearch();
    }

    document.getElementById('homeSearchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !document.getElementById('homeSuggestions').classList.contains('open')) homeSearch();
    });
    document.getElementById('searchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !document.getElementById('searchSuggestions').classList.contains('open')) doSearch();
    });

    // ── Barcode extraction ──
    function extractBarcode(kodu) {
      if (!kodu) return null;
      const str = String(kodu).trim();
      if (str.startsWith('8')) return str;
      return null;
    }

    // ── Search (barcode-based cross-depot) ──
    let selectedBarcode = null;

    async function doSearch() {
      const input = document.getElementById('searchInput');
      const query = selectedBarcode || input.value.trim();
      if (!query) return;

      const loading = document.getElementById('loading');
      const status = document.getElementById('statusMsg');
      
      // Reset
      loading.style.display = 'block';
      status.textContent = 'Sonuçlar aranıyor...';
      status.className = 'status-msg';

      if (!cachedConfig) {
        await loadDepotStatus();
      }

      const activeDepots = DEPOT_LIST.filter(d => {
         const info = cachedConfig.depots[d.id];
         return info && (info.hasCredentials || info.hasCookies || info.hasToken);
      });

      if (activeDepots.length === 0) {
        loading.style.display = 'none';
        status.textContent = 'Ayarlanmış depo bulunamadı.';
        return;
      }

      let allItems = [];
      let pendingReqs = activeDepots.length;

      // Hızlı render için ön temizlik
      document.getElementById('productCard').style.display = 'none';
      document.getElementById('bestPriceCard').style.display = 'none';
      document.getElementById('otherDepots').style.display = 'none';
      document.getElementById('resultsBody').innerHTML = '';

      activeDepots.forEach(depot => {
        fetch(`/api/search-depot?q=${encodeURIComponent(query)}&depotId=${depot.id}`)
          .then(res => res.json())
          .then(data => {
            if (!data.error && data.results && data.results.length > 0) {
              const depotUrl = data.depotUrl || '';
              data.results.forEach(r => { r.depotUrl = depotUrl; });
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

      const productCard = document.getElementById('productCard');
      const bestPriceCard = document.getElementById('bestPriceCard');
      const otherDepots = document.getElementById('otherDepots');
      const tbody = document.getElementById('resultsBody');

      // Product info card
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
      // Güvenilir fotoğraf kaynaklarını (Selçuk vb.) diğerlerine (Anadolu Pharma gibi kırık CDNs) göre öncelemek için sırala
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

      // Best price card (first item with price > 0)
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

      // Depoya Git butonu
      const bestLinkEl = document.getElementById('bestDepotLink');
      if (bestItem.depotUrl) {
        bestLinkEl.dataset.url = bestItem.depotUrl;
        bestLinkEl.style.display = 'inline-flex';
      } else {
        bestLinkEl.style.display = 'none';
      }

      bestPriceCard.style.display = 'block';

      // Other depots table
      const otherItems = items.filter(i => i !== bestItem);
      tbody.innerHTML = '';
      if (otherItems.length > 0) {
        for (const item of otherItems) {
          const tr = document.createElement('tr');
          const isInStock = item.stokVar;
          const stockStr = isInStock
            ? (item.stok > 0 && item.stokGosterilsin ? item.stok + ' Adet' : 'Stokta var')
            : 'Stok yok';

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
            <td>${item.depotUrl ? '<button onclick="copyAndOpenDepot(\'' + esc(item.depotUrl).replace(/'/g, "\\'") + '\')" class="btn-depot-link">Depoya Git <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></button>' : ''}</td>
          `;
          tbody.appendChild(tr);
        }
        otherDepots.style.display = 'block';
      } else {
        otherDepots.style.display = 'none';
      }
    }

    function esc(str) {
      if (str == null) return '';
      const d = document.createElement('div');
      d.textContent = String(str);
      return d.innerHTML;
    }

    // ── Depoya Git — clipboard + open ──
    function copyAndOpenDepot(url) {
      // Barkod varsa barkodu, yoksa ilaç adını kopyala
      const textToCopy = selectedBarcode
        || document.getElementById('searchInput').value.trim()
        || '';

      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('📋 "' + textToCopy + '" kopyalandı — siteye yapıştırın (Ctrl+V)');
        }).catch(() => {
          showToast('Kopyalanamadı — elle kopyalayın: ' + textToCopy);
        });
      }

      window.open(url, '_blank');
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

        // Eğer geçerli bir barkod tarandıysa (8 veya 13 haneli sayılar barkod okuyucuyla hızlıca girilir) beklemeden direkt ara:
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
          const res = await fetch('/api/autocomplete?q=' + encodeURIComponent(q), {
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

    // Autocomplete selection handler
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

    // Setup autocompletes
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
        const res = await fetch('/api/config');
        cachedConfig = await res.json();

        safeCreds = {};
        for (const [id, info] of Object.entries(cachedConfig.depots || {})) {
          safeCreds[id] = info.credentials || {};
        }

        // Home page depot cards
        const cards = document.getElementById('depotCards');
        cards.innerHTML = '';

        // Navbar depot dots
        const navDepots = document.getElementById('navDepots');
        navDepots.innerHTML = '';

        for (const d of DEPOT_LIST) {
          const info = cachedConfig.depots[d.id];
          const connected = info && (info.hasCredentials || info.hasCookies || info.hasToken);

          // Home depot card
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

          // Nav dot
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
          const savedVal = depotInfo
            ? (safeCreds[depotId]?.[f.id] || '')
            : '';
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
            <button class="btn btn-primary" onclick="testDepotLogin('${depotId}')">Giriş Yap & Kaydet</button>
            <button class="btn btn-outline" onclick="saveDepot('${depotId}')">Sadece Kaydet</button>
            ${isConfigured ? '<button class="btn btn-danger" onclick="deleteDepot(\'' + depotId + '\')">Sil</button>' : ''}
            <span id="${depotId}-status" class="action-status"></span>
          </div>
          ${extraHtml}
        `;

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
        const res = await fetch('/api/test-login', {
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
        const res = await fetch('/api/config/depot', {
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
        await fetch('/api/config/depot/' + depotId, { method: 'DELETE' });
        await loadDepotStatus();
        renderSettings();
      } catch (e) {}
    }

    // ── Alım Geçmişi ──
    function saveHistory(items, query) {
      if (!items || items.length === 0) return;
      const bestItem = items.find(i => i.fiyatNum > 0) || items[0];
      const isBarcode = /^\d{8,}$/.test(query);
      fetch('/api/history', {
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
      }).catch(() => {});
    }

    async function renderHistory() {
      const container = document.getElementById('historyContainer');
      container.innerHTML = '<div class="loading" style="display:block"><div class="spinner"></div><div>Yükleniyor...</div></div>';

      try {
        const res = await fetch('/api/history?limit=100');
        const history = await res.json();

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
          const date = new Date(entry.tarih);
          const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

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
                <button class="btn-depot-link" onclick="deleteHistory('${entry.id}')" title="Sil">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </td>
            </tr>
          `;
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
      } catch (err) {
        container.innerHTML = '<div class="status-msg error">Geçmiş yüklenemedi: ' + esc(err.message) + '</div>';
      }
    }

    async function deleteHistory(id) {
      await fetch('/api/history/' + id, { method: 'DELETE' });
      renderHistory();
    }
