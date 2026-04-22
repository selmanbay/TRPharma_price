/**
 * bulk-ui.js
 * Bulk search and bulk drawer HTML owner for V2.3 runtime.
 */
(function initV23BulkUI(globalScope) {
  if (!globalScope) return;

  // ── helpers ──────────────────────────────────────────────────────────────

  function _renderBulkRowHtml(row, index, deps, animate) {
    const { esc, getBulkRowQty, calculatePlanning, formatCurrency, depotBadgeHtml, renderOperationStateBadges } = deps;
    const rowPlanAdded = Boolean(row._meta?.rowPlanAdded);
    const rowOperationState = row._meta?.rowOperationState || { inPlan: false, isApproved: false };
    const animClass = animate ? ' bulk-row-revealed' : '';
    return `
      <tr class="${row.bestItem ? 'row-highlight' : ''}${animClass}" data-bulk-row-index="${index}" style="cursor:pointer;" onclick="openBulkDrawer(${index})">
        <td>
          <strong>${esc(row.query)}</strong>
          ${row.bestItem?.ad ? `<div style="font-size:12px; font-weight:600; color:var(--ink-700); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">${esc(row.bestItem.ad)}</div>` : ''}
          <div class="text-sm text-muted">
            ${row.status === 'loading'
              ? '<span class="bulk-row-shimmer">Depolar taraniyor…</span>'
              : row.error
                ? row.error
                : row.requiresVariantChoice
                  ? `${row.groupCount} form bulundu, seçim bekleniyor`
                  : `${row.groupCount} varyant, ${row.totalItems} teklif`}
          </div>
        </td>
        <td>
          ${row.status === 'loading' ? `
            <span class="text-sm text-muted">Yükleniyor…</span>
          ` : row.bestItem ? `
            <div>${depotBadgeHtml(row.bestItem.depotId, row.bestItem.depot)}</div>
            <div class="text-sm text-muted" style="margin-top:6px;">${esc(row.bestItem.ad)}</div>
            ${renderOperationStateBadges(rowOperationState, { compact: true })}
          ` : row.requiresVariantChoice ? `
            <span class="text-sm text-muted">Form seçimi gerekli</span>
          ` : '<span class="text-danger">Sonuç yok</span>'}
        </td>
        <td>${row.bestItem?.mfStr ? `<span class="badge badge-outline">${esc(row.bestItem.mfStr)}</span>` : (row.status === 'loading' ? '<span class="text-sm text-muted">…</span>' : '-')}</td>
        <td>${row.bestItem ? `<span class="font-mono">${formatCurrency(calculatePlanning(row.bestItem, getBulkRowQty(row)).effectiveUnit || row.bestItem.fiyatNum || 0)}</span>` : (row.status === 'loading' ? '<span class="text-sm text-muted">…</span>' : '-')}</td>
        <td>
          ${row.status === 'loading'
            ? '<span class="text-sm text-muted bulk-row-shimmer">…</span>'
            : `<div class="qty-control" onclick="event.stopPropagation()">
                <button type="button" onclick="changeBulkRowQty(${index}, -1)">-</button>
                <input type="number" min="1" value="${getBulkRowQty(row)}" onchange="setBulkRowQty(${index}, this.value)">
                <button type="button" onclick="changeBulkRowQty(${index}, 1)">+</button>
              </div>`}
        </td>
        <td>
          ${row.status === 'loading'
            ? '<span class="text-sm text-muted bulk-row-shimmer">Taraniyor</span>'
            : row.requiresVariantChoice
              ? `<button class="btn btn-outline" style="font-size:12px; padding:6px 12px;" onclick="event.stopPropagation(); openBulkDrawer(${index})">Form Seç</button>`
              : rowPlanAdded
                ? `<button class="btn btn-outline" style="font-size:12px; padding:6px 12px; border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);" onclick="event.stopPropagation(); addBulkRowToPlan(${index})">Plana Eklendi</button>`
                : row.bestItem
                  ? `<button class="btn btn-brand" style="font-size:12px; padding:6px 12px;" onclick="event.stopPropagation(); addBulkRowToPlan(${index})">Plana Ekle</button>`
                  : '-'}
        </td>
      </tr>
    `;
  }

  function _renderBulkStatsHtml(bulkRows) {
    if (!bulkRows.length) return '';
    const total = bulkRows.length;
    const loaded = bulkRows.filter(r => r.status !== 'loading').length;
    const found = bulkRows.filter(r => r.bestItem && r.status !== 'loading').length;
    const notFound = bulkRows.filter(r => !r.bestItem && !r.requiresVariantChoice && r.status !== 'loading' && !r.error).length;
    const errors = bulkRows.filter(r => r.error).length;
    const needsChoice = bulkRows.filter(r => r.requiresVariantChoice && !r.bestItem).length;
    const queryCounts = {};
    bulkRows.forEach(r => { const q = String(r.query || '').trim().toLowerCase(); queryCounts[q] = (queryCounts[q] || 0) + 1; });
    const duplicates = bulkRows.filter(r => queryCounts[String(r.query || '').trim().toLowerCase()] > 1).length;
    return `
      <div class="bulk-stats-bar">
        <div class="bulk-stat">
          <span class="bulk-stat__num">${total}</span>
          <span class="bulk-stat__lbl">Girilen</span>
        </div>
        ${duplicates > 0 ? `<div class="bulk-stat bulk-stat--warn">
          <span class="bulk-stat__num">${duplicates}</span>
          <span class="bulk-stat__lbl">Tekrar</span>
        </div>` : ''}
        <div class="bulk-stat bulk-stat--ok">
          <span class="bulk-stat__num">${found}</span>
          <span class="bulk-stat__lbl">Bulundu</span>
        </div>
        ${needsChoice > 0 ? `<div class="bulk-stat bulk-stat--info">
          <span class="bulk-stat__num">${needsChoice}</span>
          <span class="bulk-stat__lbl">Form seçimi</span>
        </div>` : ''}
        ${notFound > 0 ? `<div class="bulk-stat bulk-stat--err">
          <span class="bulk-stat__num">${notFound}</span>
          <span class="bulk-stat__lbl">Bulunamadı</span>
        </div>` : ''}
        ${errors > 0 ? `<div class="bulk-stat bulk-stat--err">
          <span class="bulk-stat__num">${errors}</span>
          <span class="bulk-stat__lbl">Hata</span>
        </div>` : ''}
        ${loaded < total ? `<div class="bulk-stat bulk-stat--loading">
          <span class="bulk-stat__num">${total - loaded}</span>
          <span class="bulk-stat__lbl">Taraniyor</span>
        </div>` : ''}
      </div>`;
  }

  // ── patchBulkRow: targeted DOM update for a single row ───────────────────

  function patchBulkRow(index, row, deps) {
    if (
      typeof deps?.esc !== 'function'
      || typeof deps?.depotBadgeHtml !== 'function'
    ) return false;
    const tr = document.querySelector(`tr[data-bulk-row-index="${index}"]`);
    if (!tr) return false;
    const newHtml = _renderBulkRowHtml(row, index, deps, true /* animate */);
    const tmp = document.createElement('tbody');
    tmp.innerHTML = newHtml;
    const newTr = tmp.firstElementChild;
    if (!newTr) return false;
    tr.replaceWith(newTr);
    return true;
  }

  function patchBulkStats(bulkRows) {
    const bar = document.querySelector('.bulk-stats-bar');
    if (!bar) return false;
    bar.outerHTML = _renderBulkStatsHtml(bulkRows);
    return true;
  }

  // ── renderBulkPage: full page render ─────────────────────────────────────

  function renderBulkPage(ctx, deps) {
    const {
      bulkInput = '',
      bulkRows = [],
    } = ctx || {};
    const {
      esc,
      renderBulkDropzoneArt,
      getBulkRowQty,
      calculatePlanning,
      formatCurrency,
      depotBadgeHtml,
      renderOperationStateBadges,
    } = deps || {};

    if (
      typeof esc !== 'function'
      || typeof renderBulkDropzoneArt !== 'function'
      || typeof getBulkRowQty !== 'function'
      || typeof calculatePlanning !== 'function'
      || typeof formatCurrency !== 'function'
      || typeof depotBadgeHtml !== 'function'
      || typeof renderOperationStateBadges !== 'function'
    ) return '';

    return `
      <div class="home-wrapper">
        <div class="dashboard-header">
          <div>
            <h1 style="font-size: 36px; margin-bottom: 8px;">Toplu Arama</h1>
            <p style="font-size: 16px; color: var(--ink-500);">Listeyi yapistir, en uygun teklifleri sec ve plani optimize et.</p>
          </div>
          <div class="flex gap-3">
            <button class="btn btn-outline" onclick="switchMock('home')">Dashboard</button>
            <button class="btn btn-brand" onclick="bulkSearch()">Listeyi Tara</button>
          </div>
        </div>
        <div class="bulk-dropzone mb-4">
          <div class="bulk-dropzone-head">
            ${renderBulkDropzoneArt()}
            <div>
              <div style="font-size: 18px; font-weight: 700; margin-bottom: 10px;">Listeyi buraya yapistir</div>
              <p style="color: var(--ink-500);">Her satira bir urun adi veya barkod gelecek sekilde text/excel verisini yapistirin.</p>
            </div>
          </div>
          <textarea id="bulkInputArea" class="input" style="min-height: 180px; resize: vertical; text-align:left;">${esc(bulkInput)}</textarea>
        </div>
        ${_renderBulkStatsHtml(bulkRows)}
        <div class="table-container">
          <table class="data-table" id="bulkResultsTable">
            <thead>
              <tr>
                <th>Arama</th>
                <th>Seçili Teklif</th>
                <th>MF</th>
                <th>Maliyet</th>
                <th>Adet</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              ${bulkRows.length
                ? bulkRows.map((row, index) => _renderBulkRowHtml(row, index, { esc, getBulkRowQty, calculatePlanning, formatCurrency, depotBadgeHtml, renderOperationStateBadges }, false)).join('')
                : `<tr><td colspan="6" style="padding:32px; text-align:center; color:var(--ink-500);">Henüz toplu arama çalışmadı.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderBulkDrawer(ctx, deps) {
    const {
      row = null,
      bulkDrawerIndex = -1,
      selectedGroup = null,
      selectedGroupIndex = 0,
      selectedItem = null,
      bulkQty = 1,
      selectedPlanning = null,
    } = ctx || {};
    const {
      esc,
      escJs,
      calculatePlanning,
      formatCurrency,
      getOfferKey,
      depotBadgeHtml,
      renderOperationStateBadges,
    } = deps || {};

    if (
      typeof esc !== 'function'
      || typeof escJs !== 'function'
      || typeof calculatePlanning !== 'function'
      || typeof formatCurrency !== 'function'
      || typeof getOfferKey !== 'function'
      || typeof depotBadgeHtml !== 'function'
      || typeof renderOperationStateBadges !== 'function'
    ) return '';

    if (!row) {
      return '<div class="text-muted">Secili satir bulunamadi.</div>';
    }
    if (row.requiresVariantChoice && !row.selectedGroupKey) {
      return `
        <div class="bulk-group-picker">
          <div class="bulk-group-picker-head">
            <div style="font-size:12px; font-weight:700; color:var(--ink-500); text-transform:uppercase;">Form Seçimi</div>
            <h3>Hangisini seçmek istiyorsunuz?</h3>
            <p class="text-sm text-muted">Listeden doğru ilacı seçin. Sonra seçili barkod üzerinden düzenleme başlayacak.</p>
          </div>
          <div class="bulk-group-picker-list">
            ${(row.groups || []).map((group, groupIndex) => `
              <button class="bulk-group-picker-item" onclick="selectBulkGroup(${bulkDrawerIndex}, ${groupIndex})">
                <span class="bulk-group-picker-name">${esc(group.name)}</span>
                <span class="material-symbols-outlined" style="font-size:18px;">chevron_right</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="mb-4">
        <div style="font-size:12px; font-weight:700; color:var(--ink-500); text-transform:uppercase;">Toplu Arama Satiri</div>
        <h3 style="font-size:24px; margin-top:8px;">${esc(row.query)}</h3>
      </div>
      ${selectedItem ? `
        <div class="drawer-hero">
          <div class="info-grid">
            <div class="info-card info-card-order">
              <div class="info-card-lbl">Hedef Adet</div>
              <div class="info-card-val">
                <div class="qty-control" style="margin-top:8px;">
                  <button type="button" onclick="changeBulkRowQty(${bulkDrawerIndex}, -1)">-</button>
                  <input type="number" min="1" value="${bulkQty}" onchange="setBulkRowQty(${bulkDrawerIndex}, this.value)">
                  <button type="button" onclick="changeBulkRowQty(${bulkDrawerIndex}, 1)">+</button>
                </div>
              </div>
            </div>
            <div class="info-card info-card-receive"><div class="info-card-lbl">Teslim</div><div class="info-card-val">${selectedPlanning?.receiveQty || '-'}</div></div>
            <div class="info-card info-card-total"><div class="info-card-lbl">Toplam</div><div class="info-card-val">${formatCurrency(selectedPlanning?.totalCost || selectedItem.fiyatNum || 0)}</div></div>
            <div class="info-card info-card-effective"><div class="info-card-lbl">Birim</div><div class="info-card-val">${formatCurrency(selectedPlanning?.effectiveUnit || selectedItem.fiyatNum || 0)}</div></div>
          </div>
          <div class="mt-4 text-sm text-muted">MF hesaplama secili form ve adet uzerinden canli guncellenir.</div>
        </div>
      ` : ''}
      ${((selectedGroup ? [selectedGroup] : [])).map((group) => `
        <div class="card mb-4" style="padding:16px;">
          <div class="flex justify-between items-center mb-4">
            <div>
              <strong>${esc(group.name)}</strong>
              <div class="text-sm text-muted">${group.items.length} depo teklifi${group.barcode ? ` · Barkod: ${esc(group.barcode)}` : ''}</div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-outline" onclick="openBulkVariant(${bulkDrawerIndex}, ${selectedGroupIndex})">Varyant Detayı</button>
            </div>
          </div>
          ${group.items.map((item) => {
            const drawerPlanAdded = Boolean(item?._meta?.drawerPlanAdded);
            const drawerOperationState = item?._meta?.drawerOperationState || { inPlan: false, isApproved: false };
            return `
            <div class="card mb-4" style="padding:16px;">
              <div class="flex justify-between items-center mb-4 pb-4" style="border-bottom: 1px solid var(--ink-100);">
                <div>${depotBadgeHtml(item.depotId, item.depot)}</div>
                <div class="font-mono font-weight-700" style="font-size: 18px;">${formatCurrency(calculatePlanning(item, bulkQty).effectiveUnit || item.fiyatNum || 0)}</div>
              </div>
              <div class="flex justify-between items-center">
                <div>
                  <div style="font-size:11px; font-weight:700; color:var(--ink-500); text-transform:uppercase;">MF</div>
                  <div style="font-size:14px; font-weight:700; color:var(--ink-900);">${esc(item.mfStr || '-')}</div>
                  <div class="text-sm text-muted" style="margin-top:6px;">${calculatePlanning(item, bulkQty).planningMode === 'mf' ? 'MF efektif maliyet' : 'Net birim maliyet'}</div>
                  ${renderOperationStateBadges(drawerOperationState, { compact: true })}
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-outline" style="font-size:12px; padding:6px 10px;" onclick="selectBulkOffer(${bulkDrawerIndex}, ${selectedGroupIndex}, '${escJs(getOfferKey(item))}')">Bu Depoyu Sec</button>
                  <button class="btn ${drawerPlanAdded ? 'btn-outline' : 'btn-brand'}" style="font-size:12px; padding:6px 12px; ${drawerPlanAdded ? 'border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);' : ''}" onclick="addBulkOfferToPlan(${bulkDrawerIndex}, ${selectedGroupIndex}, '${escJs(getOfferKey(item))}')">${drawerPlanAdded ? 'Plana Eklendi' : 'Plana Ekle'}</button>
                </div>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      `).join('')}
    `;
  }

  globalScope.V23BulkUI = {
    renderBulkPage,
    renderBulkDrawer,
    patchBulkRow,
    patchBulkStats,
  };
})(typeof window !== 'undefined' ? window : null);
