import { searchEngineService } from '../../data/SearchEngineService.js';
import { depotRepository } from '../../data/DepotRepository.js';
import { formatCurrency, isBarcodeQuery } from '../../utils/formatters.js';
import { EventBinder } from '../EventBinder.js';

/**
 * BulkSearchLayout.js
 * 
 * Toplu Arama motoru: Kullanıcının girdiği onca barkodu/ismi sırayla işler,
 * her biri için SearchEngineService üzerinden canlı data çeker
 * ve sonuçları Toplu Arama ekranına asar.
 */

export class BulkSearchLayout {
  constructor() {
    this.isSearching = false;
    this.queue = [];
    this.results = []; // { query, state, bestHit }
  }

  init() {
    EventBinder.bind('bulkSearchRunBtn', 'click', () => this.startBulkSearch());
  }

  async startBulkSearch() {
    if (this.isSearching) return;
    
    const textarea = document.getElementById('bulkSearchInput');
    if (!textarea) return;

    const rawInput = textarea.value;
    const lines = rawInput.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 2);

    if (lines.length === 0) return;

    this.isSearching = true;
    this.queue = [...lines];
    this.results = [];
    
    this._renderTable();
    this._updateStatus(`0 / ${this.queue.length} Arama tamamlandı...`);

    // Sırada paralel ya da sırayla yürü (depoları çökertmemek için batch: 1)
    for (let i = 0; i < this.queue.length; i++) {
        const query = this.queue[i];
        
        let localHits = [];
        // Servisi dinle, resolve edilene kadar veriyi topla
        await new Promise((resolve) => {
            searchEngineService.searchAcrossDepots(query, (newEntities) => {
               localHits.push(...newEntities);
            }).then(() => resolve());
        });

        const bestHit = this._extractBestPricing(localHits);
        this.results.push({
           query,
           bestHit: bestHit,
           found: localHits.length > 0
        });

        this._renderTable();
        this._updateStatus(`${i + 1} / ${this.queue.length} Arama tamamlandı...`);
    }

    this.isSearching = false;
    this._updateStatus('Toplu arama tamamlandı.');
  }

  _extractBestPricing(entities) {
      if (!entities || entities.length === 0) return null;
      let min = Infinity;
      let best = null;
      entities.forEach(en => {
         if (en.price > 0 && en.price < min) {
             min = en.price;
             best = en;
         }
      });
      return best || entities[0]; // Hepsinin fiyatı 0 (stok yok) is ilkini göster
  }

  _renderTable() {
    const listContainer = document.getElementById('bulkSearchResults');
    if (!listContainer) return;

    const html = this.results.map(r => {
        if (!r.found) {
            return `
            <div class="bulk-row error">
               <div class="br-name" style="color:var(--status-red)">${r.query} - Bulunamadı</div>
            </div>`;
        }
        return `
        <div class="bulk-row">
           <div class="br-name" style="font-weight:600;">${r.bestHit.name}</div>
           <div class="br-depot">${r.bestHit.depotName}</div>
           <div class="br-stock ${r.bestHit.inStock ? 'ok' : 'crit'}">${r.bestHit.inStock ? 'Stok Var' : 'Yok'}</div>
           <div class="br-price">${formatCurrency(r.bestHit.price)}</div>
        </div>
        `;
    }).join('');

    listContainer.innerHTML = html;
  }

  _updateStatus(msg) {
      const s = document.getElementById('bulkSearchStatus');
      if (s) s.textContent = msg;
  }
}

export const bulkSearchLayout = new BulkSearchLayout();
