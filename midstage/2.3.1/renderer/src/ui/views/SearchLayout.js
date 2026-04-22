import { AppState, pushDiagnostic } from '../state.js';
import { searchEngineService } from '../../data/SearchEngineService.js';
import { formatCurrency, isBarcodeQuery, parseQRCode } from '../../utils/formatters.js';

/**
 * SearchLayout.js
 * Arama sonuçlarının ekrana çizilmesi, "loading" durumları ve dom güncellemelerini yönetir.
 * Bu sınıf içerisinde API çağrısı veya data işleme yapılmaz, sadece render edilir.
 */

export class SearchLayout {
  constructor() {
    this.batchTimer = null;
    this.BATCH_INTERVAL_MS = 120;
  }

  // --- UI Update Methods ---

  showLoading(query) {
    AppState.search.status = 'loading';
    AppState.search.query = query;
    AppState.search.items = [];

    this._setElementDisplay('loading', 'block');
    this._setElementText('statusMsg', 'Sonuçlar aranıyor...');
    this._setElementClass('statusMsg', 'status-msg');
    
    this.hideResults();
  }

  showError(errorObj) {
    AppState.search.status = 'error';
    
    this._setElementDisplay('loading', 'none');
    this._setElementDisplay('searchErrorCard', 'block');
    this._setElementText('searchErrorTitle', errorObj?.title || 'Sonuçlar yüklenemedi');
    this._setElementText('searchErrorMessage', errorObj?.message || 'Bağlantınızı kontrol edip tekrar deneyin.');
    this._setElementText('statusMsg', '');
  }

  hideResults() {
    this._setElementDisplay('productCard', 'none');
    this._setElementDisplay('bestPriceCard', 'none');
    this._setElementDisplay('searchActionPanel', 'none');
    this._setElementDisplay('otherDepots', 'none');
  }

  // --- Rendering Process ---

  /**
   * SearchEngineService'den gelen yeni entityleri listeye katarak batch ekrana sunar.
   */
  queueRender(newDrugEntities, isBarcode) {
    AppState.search.items = AppState.search.items.concat(newDrugEntities);

    // Eğer barkod aramasıysa bekleme (throttle) yapmadan hemen render et
    if (isBarcode) {
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this._renderDOM();
      return;
    }

    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      this._renderDOM();
      this.batchTimer = null;
    }, this.BATCH_INTERVAL_MS);
  }

  _renderDOM() {
    if (AppState.search.items.length === 0) return;

    this._setElementDisplay('loading', 'none');
    this._setElementText('statusMsg', '');

    const dedupedList = this._dedupeItems(AppState.search.items);
    this._setElementDisplay('otherDepots', 'block');
    
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;

    // Burada DrugEntity özelliklerine göre tablo satırları çizilecek (clean map)
    tbody.innerHTML = dedupedList.map(drug => `
      <tr class="result-row bg-depot-${drug.depotId}">
        <td>
          <div class="result-depot-info">
            <span class="rd-name">${drug.depotName}</span>
          </div>
        </td>
        <td>
           <span class="stock-badge ${drug.inStock ? 'ok' : 'crit'}">
             ${drug.inStock ? 'Stokta' : 'Yok'}
           </span>
        </td>
        <td><div class="mf-desc">${drug.mfString || '-'}</div></td>
        <td style="text-align:right">
          <div class="price-val"><strong>${formatCurrency(drug.price)}</strong></div>
        </td>
        <td>
           <button class="btn btn-sm btn-outline">Seç</button>
        </td>
      </tr>
    `).join('');
  }

  _dedupeItems(items) {
    // Fiyatlara göre ucuzdan pahalıya sırala
    return [...items].sort((a, b) => {
      if (a.price === 0 && b.price !== 0) return 1;
      if (b.price === 0 && a.price !== 0) return -1;
      return a.price - b.price;
    });
  }

  // --- DOM Helpers ---

  _setElementDisplay(id, display) {
    const el = document.getElementById(id);
    if (el) el.style.display = display;
  }
  
  _setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _setElementClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.className = className;
  }
}

export const searchLayout = new SearchLayout();
