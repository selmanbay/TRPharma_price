import { Storage, StorageKeys } from '../../core/storage.js';

/**
 * HistoryLayout.js
 * Kullanıcının son yaptığı aramaları localStorage'dan okuyup listeler
 * ve ana sayfadaki "Son Aramalar" widget'ını besler.
 */
export class HistoryLayout {
  constructor() {
    this.history = [];
  }

  init() {
    this.history = Storage.read('eczane.history.v2', []);
    this.renderHomeWidget();
    this.renderFullList();
  }

  addSearch(drugName, barcode, bestPrice, depotCount) {
    if (!drugName) return;
    
    // Aynı öğe varsa sil (en başa alacağız)
    this.history = this.history.filter(h => h.barcode !== barcode || h.name !== drugName);
    
    this.history.unshift({
       key: `HIST_${Date.now()}`,
       name: drugName,
       barcode: barcode,
       bestPrice: bestPrice,
       depotCount: depotCount,
       date: Date.now()
    });

    if (this.history.length > 50) {
      this.history.length = 50;
    }

    Storage.writeLocal('eczane.history.v2', this.history);
    this.renderHomeWidget();
    this.renderFullList();
  }

  renderHomeWidget() {
    const listContainer = document.getElementById('homeHistoryContainer');
    if (!listContainer) return;

    if (this.history.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--text-3); font-size:13px; padding:20px;">Geçmiş arama yok.</div>';
        return;
    }

    const html = this.history.slice(0, 4).map(h => `
        <div class="home-hist-card" onclick="document.getElementById('searchInput').value='${h.barcode || h.name}'; window.doSearch();">
            <div class="hist-card-title">${h.name}</div>
            <div class="hist-card-meta">
                <span>${h.barcode ? `Barkod: ${h.barcode}` : 'İsim Araması'}</span>
                <span style="color:var(--accent)">${h.depotCount} Depo</span>
            </div>
            <div class="hist-card-date">${this._formatDate(h.date)}</div>
        </div>
    `).join('');

    listContainer.innerHTML = html;
  }

  renderFullList() {
    const listContainer = document.getElementById('historyContainer');
    if (!listContainer) return;

    if (this.history.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--text-3); margin-top:20px;">Arama geçmişi boş.</div>';
        return;
    }

    listContainer.innerHTML = this.history.map(h => `
        <div class="hist-card" onclick="document.getElementById('searchInput').value='${h.barcode || h.name}'; window.doSearch();">
            <h3>${h.name}</h3>
            <div>${h.barcode ? `Barkod: ${h.barcode}` : 'İsim Araması'} | En düşük: ${h.bestPrice} ₺ | ${h.depotCount} Depo Yanıtı</div>
            <div style="font-size:11px; color:#aaa; margin-top:5px;">${this._formatDate(h.date)}</div>
        </div>
    `).join('');
  }

  _formatDate(ts) {
     return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
  }
}

export const historyLayout = new HistoryLayout();
