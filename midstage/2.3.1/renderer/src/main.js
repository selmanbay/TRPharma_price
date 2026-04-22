import { authService } from './core/AuthService.js';
import { depotRepository } from './data/DepotRepository.js';
import { searchEngineService } from './data/SearchEngineService.js';
import { router } from './ui/Router.js';
import { EventBinder } from './ui/EventBinder.js';
import { searchLayout } from './ui/views/SearchLayout.js';
import { parseQRCode, isBarcodeQuery } from './utils/formatters.js';
import * as sharedHelpers from './shared/LegacySharedHelpers.js';
import * as pricingEngine from './features/pricing/LegacyPricingEngine.js';
import * as searchUtils from './features/search/LegacySearchUtils.js';
import * as workspaceShell from './features/workspace/WorkspaceShell.js';
import * as settingsTabs from './features/settings/SettingsTabs.js';
import * as workspacePlanView from './features/plan/WorkspacePlanView.js';
import { createLocalJsonStore } from './shared/storage/LocalJsonStore.js';
import { getProductIdentity, getSearchIdentity } from './shared/products/ProductIdentity.js';
import { createPlanStateStore } from './state/PlanState.js';

if (typeof window !== 'undefined') {
  window.ModularAppAdapters = window.ModularAppAdapters || {};
  window.ModularAppAdapters.shared = sharedHelpers;
  window.ModularAppAdapters.pricing = pricingEngine;
  window.ModularAppAdapters.search = searchUtils;
  window.ModularAppAdapters.workspace = workspaceShell;
  window.ModularAppAdapters.settings = settingsTabs;
  window.ModularAppAdapters.plan = workspacePlanView;

  window.V22Modules = window.V22Modules || {};
  window.V22Modules.storage = {
    createLocalJsonStore,
  };
  window.V22Modules.products = {
    getProductIdentity,
    getSearchIdentity,
  };
  window.V22Modules.planState = {
    createPlanStateStore,
  };
}

function hasLegacyRuntime() {
  return typeof window.showPage === 'function'
    && typeof window.doSearch === 'function'
    && typeof window.homeSearch === 'function';
}

function bindFallbackWindowActions() {
  if (typeof window.showPage !== 'function') {
    EventBinder.exposeToWindow('showPage', (pageName) => router.navigate(pageName));
  }

  if (typeof window.homeSearch !== 'function') {
    EventBinder.exposeToWindow('homeSearch', () => {
      let query = document.getElementById('homeSearchInput')?.value.trim();
      if (!query) return;

      const cleanBarcode = parseQRCode(query);
      if (cleanBarcode && cleanBarcode.length === 13) query = cleanBarcode;

      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = query;
      router.navigate('search');
      if (typeof window.doSearch === 'function') window.doSearch();
    });
  }

  if (typeof window.doSearch !== 'function') {
    EventBinder.exposeToWindow('doSearch', async () => {
      const input = document.getElementById('searchInput');
      let query = input ? input.value.trim() : '';
      const cleanBarcode = parseQRCode(query);
      if (cleanBarcode && cleanBarcode.length === 13) {
        query = cleanBarcode;
        if (input) input.value = cleanBarcode;
      }
      if (!query) return;

      searchLayout.showLoading(query);
      const isBarcode = isBarcodeQuery(query);

      try {
        const activeCount = await searchEngineService.searchAcrossDepots(query, (entities) => {
          searchLayout.queueRender(entities, isBarcode);
        });

        if (activeCount === 0) {
          throw new Error('Aktif depolardan sonuc alinamadi.');
        }
      } catch (err) {
        searchLayout.showError({
          title: 'Arama Basarisiz',
          message: err?.message || 'Bilinmeyen hata',
        });
      }
    });
  }

  if (typeof window.toggleProfileMenu !== 'function') {
    EventBinder.exposeToWindow('toggleProfileMenu', () => {
      document.querySelector('.profile-wrapper')?.classList.toggle('open');
    });
  }

  if (typeof window.closeDepotPanel !== 'function') {
    EventBinder.exposeToWindow('closeDepotPanel', () => {
      document.getElementById('depotOverlay')?.classList.remove('open');
      document.getElementById('depotPanel')?.classList.remove('open');
    });
  }

  if (typeof window.closePlanEditorDrawer !== 'function') {
    EventBinder.exposeToWindow('closePlanEditorDrawer', () => {
      document.getElementById('planEditorOverlay')?.classList.remove('open');
      const panel = document.getElementById('planEditorPanel');
      if (panel) {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
  }
}

async function bootstrap() {
  console.log('[ModularApp] Bootstrap basladi.');

  authService.init();
  bindFallbackWindowActions();

  if (hasLegacyRuntime()) {
    window.ModularApp = {
      mode: 'compatibility',
      authService,
      depotRepository,
      searchEngineService,
      router,
    };
    console.log('[ModularApp] Legacy runtime algilandi, uyumluluk modunda devam ediliyor.');
    return;
  }

  try {
    await depotRepository.fetchDepots();
    window.ModularApp = {
      mode: 'modular',
      authService,
      depotRepository,
      searchEngineService,
      router,
    };
  } catch (err) {
    console.error('[ModularApp] Bootstrap hatasi:', err);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', bootstrap);
}
