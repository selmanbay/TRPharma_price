/**
 * navigation-runtime.js
 * Top navigation and page switching runtime owner for V2.3.
 */
(function initV23NavigationRuntime(globalScope) {
  if (!globalScope) return;

  function updateNavSummary(runtime = {}, deps = {}) {
    const { state } = runtime;
    if (!state) return;
    const {
      getOrderPlan,
      configuredDepotIds,
      depotMeta = {},
      getStoredUser,
    } = deps;
    const planCount = typeof getOrderPlan === 'function' ? getOrderPlan().length : 0;
    const connected = typeof configuredDepotIds === 'function' ? configuredDepotIds().length : 0;
    const total = Object.keys(state.config?.availableDepots || depotMeta).length;

    const brandBtn = Array.from(document.querySelectorAll('.btn.btn-brand'))
      .find((button) => {
        const text = String(button.textContent || '').toLowerCase();
        const hint = String(button.getAttribute('onclick') || '').toLowerCase();
        return text.includes('sipari') || hint.includes("switchmock('plan')");
      });
    if (brandBtn) {
      brandBtn.classList.add('nav-plan-btn');
      brandBtn.setAttribute('data-role', 'open-plan-modal');
      brandBtn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 18px;">shopping_bag</span>
        <span>Sipariş Planı</span>
        ${planCount ? `<span class="nav-plan-count">${planCount}</span>` : ''}
      `;
      brandBtn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.openOrderPlanModal === 'function') {
          window.openOrderPlanModal();
          return;
        }
        if (typeof switchMock === 'function') switchMock('plan');
      };
    }

    const healthChip = document.querySelector('.nav-right > .flex.items-center.gap-2');
    if (healthChip) {
      healthChip.className = 'nav-health-chip';
      let dot = healthChip.querySelector('.nav-health-dot');
      let label = healthChip.querySelector('.nav-health-label');
      if (!dot || !label) {
        healthChip.innerHTML = '<div class="nav-health-dot"></div><span class="nav-health-label"></span>';
        dot = healthChip.querySelector('.nav-health-dot');
        label = healthChip.querySelector('.nav-health-label');
      }
      const healthy = connected > 0;
      healthChip.style.background = healthy ? 'var(--ink-50)' : 'rgba(244,63,94,0.08)';
      healthChip.style.borderColor = healthy ? 'var(--ink-200)' : 'rgba(244,63,94,0.18)';
      if (dot) {
        dot.style.background = healthy ? 'var(--mint-500)' : 'var(--rose-500)';
        dot.style.boxShadow = healthy ? '0 0 0 2px rgba(16,185,129,0.2)' : '0 0 0 2px rgba(244,63,94,0.16)';
      }
      if (label) {
        label.textContent = `${connected}/${total} Aktif`;
        label.style.color = healthy ? 'var(--mint-600)' : 'var(--rose-500)';
      }
    }

    const fallbackUser = typeof getStoredUser === 'function' ? getStoredUser() : null;
    const name = state.user?.displayName || fallbackUser?.displayName || 'Eczane';
    const profileName = document.getElementById('profileMenuName');
    const avatar = document.getElementById('profileMenuAvatar');
    if (profileName) profileName.textContent = name;
    if (avatar) avatar.textContent = String(name).trim().slice(0, 1).toUpperCase();
  }

  function switchPage(pageId, runtime = {}) {
    const { state } = runtime;
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const next = document.getElementById(`page-${pageId}`);
    if (next) next.classList.add('active');
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = pageId === 'login' ? 'none' : 'flex';
    if (state) state.currentPage = pageId;
  }

  function bindTopNav(runtime = {}, deps = {}) {
    const { state } = runtime;
    if (!state) return;
    const {
      parseQRCode,
      isBarcodeQuery,
      fetchSuggestions,
      runSearch,
      esc,
      renderVariantsPage,
      switchMock,
    } = deps;

    const searchInput = document.querySelector('.nav-search');
    if (!searchInput) return;
    if (searchInput.dataset.boundTopNav === '1') return;
    searchInput.dataset.boundTopNav = '1';
    searchInput.removeAttribute('onclick');
    searchInput.onclick = null;
    const searchShell = searchInput.closest('.nav-search-shell');
    const searchIcon = searchShell?.querySelector('.nav-search-icon');
    const searchShortcut = searchShell?.querySelector('.nav-search-shortcut');

    let suggestionsEl = document.getElementById('globalSearchSuggestions');
    if (!suggestionsEl) {
      suggestionsEl = document.createElement('div');
      suggestionsEl.id = 'globalSearchSuggestions';
      suggestionsEl.className = 'global-search-suggestions';
      searchInput.parentElement?.appendChild(suggestionsEl);
    }

    const executeSearch = async (value) => {
      const query = String(value || '').trim();
      if (!query) return;
      if (state.suggestionAbortController) state.suggestionAbortController.abort();
      state.searchDrafting = false;
      state.searchDraftQuery = '';
      suggestionsEl.classList.remove('open');
      await runSearch(query);
    };

    searchInput.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await executeSearch(searchInput.value);
      }
    });

    searchIcon?.addEventListener('click', async () => {
      await executeSearch(searchInput.value);
    });

    searchShortcut?.addEventListener('click', () => {
      searchInput.focus();
      searchInput.select();
    });

    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      clearTimeout(debounceTimer);

      if (query.length < 2) {
        if (state.suggestionAbortController) state.suggestionAbortController.abort();
        state.searchDrafting = false;
        state.searchDraftQuery = '';
        suggestionsEl.classList.remove('open');
        if (state.currentPage === 'search-variants') renderVariantsPage();
        return;
      }

      const parsedQuery = parseQRCode(query) || query;
      if (isBarcodeQuery(parsedQuery)) {
        state.searchDrafting = false;
        state.searchDraftQuery = '';
        suggestionsEl.classList.remove('open');
        debounceTimer = setTimeout(async () => {
          await executeSearch(parsedQuery);
        }, 140);
        return;
      }

      state.searchDrafting = true;
      state.searchDraftQuery = query;
      if (state.currentPage === 'search-detail') {
        switchMock('search-variants');
      } else if (state.currentPage === 'search-variants') {
        renderVariantsPage();
      }

      debounceTimer = setTimeout(async () => {
        try {
          const requestQuery = query;
          const suggestions = await fetchSuggestions(requestQuery);
          if (requestQuery !== searchInput.value.trim()) return;
          if (!state.searchDrafting || state.searchDraftQuery !== requestQuery) return;
          if (!suggestions.length) {
            suggestionsEl.classList.remove('open');
            return;
          }
          suggestionsEl.innerHTML = suggestions.slice(0, 8).map((item) => `
            <button class="suggestion-item" data-suggestion="${esc(item.barcode || item.kodu || item.ad)}" style="width:100%; text-align:left; border:none; background:#fff;">
              <strong style="display:block; margin-bottom:4px;">${esc(item.ad)}</strong>
              <span style="font-size:12px; color:var(--ink-500);">${esc(item.barcode || item.kodu || '')} ${item.fiyat ? `· ${esc(item.fiyat)}` : ''}</span>
            </button>
          `).join('');
          suggestionsEl.classList.add('open');
          suggestionsEl.querySelectorAll('[data-suggestion]').forEach((button) => {
            button.addEventListener('click', async () => {
              searchInput.value = button.getAttribute('data-suggestion') || '';
              await executeSearch(searchInput.value);
            });
          });
        } catch (error) {
          if (error?.name === 'AbortError') return;
          suggestionsEl.classList.remove('open');
        }
      }, 160);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.nav-left')) {
        suggestionsEl.classList.remove('open');
      }
    });
  }

  globalScope.V23NavigationRuntime = {
    updateNavSummary,
    switchPage,
    bindTopNav,
  };
})(typeof window !== 'undefined' ? window : null);
