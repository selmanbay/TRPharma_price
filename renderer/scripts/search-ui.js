/**
 * search-ui.js
 * Search surface rendering owner for V2.3 runtime.
 */
(function initV23SearchUI(globalScope) {
  if (!globalScope) return;

  function renderSearchLoadingState(query, deps) {
    const { esc, formatSearchHeading } = deps || {};
    if (typeof esc !== 'function' || typeof formatSearchHeading !== 'function') return '';
    return `
      <div class="search-loading-surface">
        <div class="search-loading-badge">Arama sürüyor</div>
        <h2>${esc(formatSearchHeading(query))}</h2>
        <p>Depolardan sonuçlar yükleniyor. Tek bir karar yüzeyi hazırlıyoruz.</p>
        <div class="search-loading-stack">
          ${Array.from({ length: 3 }).map(() => '<div class="search-loading-line skeleton"></div>').join('')}
        </div>
      </div>
    `;
  }

  function renderSearchDraftState(query, deps) {
    const { esc, formatSearchHeading } = deps || {};
    if (typeof esc !== 'function' || typeof formatSearchHeading !== 'function') return '';
    return `
      <div class="search-loading-surface">
        <div class="search-loading-badge">Arama hazırlığı</div>
        <h2>${esc(formatSearchHeading(query))}</h2>
        <p>Yazmayı bitirdiğinde tek bir sonuç yüzeyi açılacak. Şu an sadece öneriler gösteriliyor.</p>
        <div class="search-loading-stack">
          ${Array.from({ length: 2 }).map(() => '<div class="search-loading-line skeleton"></div>').join('')}
        </div>
      </div>
    `;
  }

  function renderBulkDropzoneArt() {
    return `
      <div class="bulk-dropzone-art" aria-hidden="true">
        <svg viewBox="0 0 80 80" fill="none" width="48" height="48">
          <rect x="22" y="14" width="28" height="38" rx="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M30 28H42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M30 36H42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M40 56V36" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M34 44L40 36L46 44" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
  }

  function renderVariantsPage(ctx, deps) {
    const {
      searchLoading,
      searchDrafting,
      searchQuery,
      searchDraftQuery,
      searchError,
      searchGroups,
    } = ctx || {};
    const {
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
    } = deps || {};

    if (
      typeof esc !== 'function'
      || typeof escJs !== 'function'
      || typeof formatSearchHeading !== 'function'
      || typeof actionLink !== 'function'
      || typeof resolveGroupOperationState !== 'function'
      || typeof renderOperationStateBadges !== 'function'
      || typeof formatCurrency !== 'function'
      || typeof depotBadgeHtml !== 'function'
      || typeof renderEmptyState !== 'function'
      || typeof renderSearchLoadingState !== 'function'
      || typeof renderSearchDraftState !== 'function'
    ) {
      return '';
    }

    if (searchLoading) {
      return `
        <div class="variant-list">
          ${renderSearchLoadingState(searchQuery)}
        </div>
      `;
    }
    if (searchDrafting) {
      return `
        <div class="variant-list">
          ${renderSearchDraftState(searchDraftQuery || searchQuery)}
        </div>
      `;
    }

    return `
      <div class="variant-list">
        <div class="flex justify-between items-center mb-6">
          <div>
            <div style="font-size:12px; font-weight:700; color:var(--ink-500); text-transform:uppercase;">Varyant Seçimi</div>
            <h2 style="font-size:32px; margin-top:8px;">${esc(formatSearchHeading(searchQuery))}</h2>
            <p style="color:var(--ink-500); margin-top:8px;">Birden fazla form bulundu. Doğru ürünü seçip depo karar ekranına geçin.</p>
          </div>
          ${actionLink('Ana Sayfa', "switchMock('home')")}
        </div>
        ${searchError ? `
          <div class="card" style="padding:32px; text-align:center; color:var(--rose-500);">${esc(searchError)}</div>
        ` : (searchGroups || []).length ? (searchGroups || []).map((group) => {
          const groupOperationState = resolveGroupOperationState(group);
          return `
            <div class="variant-item" onclick="openVariantDetail('${escJs(group.key)}')">
              <div>
                <div class="variant-name mb-2">${esc(group.name)}</div>
                <div class="variant-meta">
                  <span class="${group.barcode ? '' : 'variant-meta-muted'}">${group.barcode ? esc(group.barcode) : 'Barkod yok'}</span>
                  <span aria-hidden="true">&bull;</span>
                  <span>${group.items.length} depo sonucu</span>
                </div>
                ${renderOperationStateBadges(groupOperationState, { compact: true })}
              </div>
              <div style="text-align:right;">
                <div class="variant-price-label">min.</div>
                <div class="variant-price">${formatCurrency(group.bestItem?.fiyatNum || 0)}</div>
                <div style="margin-top:8px;">${depotBadgeHtml(group.bestItem?.depotId, group.bestItem?.depot)}</div>
              </div>
            </div>
          `;
        }).join('') : `
          ${renderEmptyState({
            variant: 'variants',
            title: 'Sonuç bulunamadı',
            body: 'Farklı bir kelime veya barkod deneyin.',
            ctaLabel: 'Ana Sayfa',
            ctaAction: "switchMock('home')",
          })}
        `}
      </div>
    `;
  }

  globalScope.V23SearchUI = {
    renderSearchLoadingState,
    renderSearchDraftState,
    renderBulkDropzoneArt,
    renderVariantsPage,
  };
})(typeof window !== 'undefined' ? window : null);
