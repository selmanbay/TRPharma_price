import { OrderDataEngine } from '../../domain/OrderDataEngine.js';
import { AppState, pushDiagnostic } from '../state.js';
import { formatCurrency } from '../../utils/formatters.js';
import { EventBinder } from '../EventBinder.js';

/**
 * StockCalculator.js
 * Ürün detayındayken mal fazlası hesaplamasını (MF) yapan flyout paneli.
 * Eski app.js'teki 500 satırlık karmaşık MF DOM yönetimi bu sınıfa indirgendi.
 */

export class StockCalculator {
  constructor() {
    this.isOpen = false;
    this.currentEntities = [];
    this._activeQty = 1;

    // DOM Elements
    this.container = null;
    this.resultsEl = null;
    this.inputEl = null;
    this.chipsEl = null;
    
    // Bind the handlers so they don't lose context
    this.handleIncrease = this.handleIncrease.bind(this);
    this.handleDecrease = this.handleDecrease.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.close = this.close.bind(this);
  }

  init() {
    this.container = document.getElementById('stockCalcPanel');
    this.resultsEl = document.getElementById('stockCalcResults');
    this.inputEl = document.getElementById('stockQtyInput');
    this.chipsEl = document.getElementById('stockMfChips');

    EventBinder.bind('stockCalcTrigger', 'click', () => this.toggle());
    EventBinder.bind('stockCalcClose', 'click', this.close);
    EventBinder.bind('stockPlus', 'click', this.handleIncrease);
    EventBinder.bind('stockMinus', 'click', this.handleDecrease);
    
    if (this.inputEl) {
      this.inputEl.addEventListener('input', this.handleInput);
    }
  }

  loadEntities(entities) {
    this.currentEntities = entities;
    const hasMf = entities.some(e => OrderDataEngine.parseMf(e.mfString));
    
    const trigger = document.getElementById('stockCalcTrigger');
    if (trigger) {
      trigger.style.display = hasMf ? 'inline-flex' : 'none';
      if (!hasMf) this.close();
    }

    if (this.isOpen) {
      this.renderSuggestions();
      this.processCalculation(this._activeQty);
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    const overlay = document.getElementById('variantSelectionLayer'); // Or whatever locks focus
    if (this.container) this.container.classList.add('open');
    const trigger = document.getElementById('stockCalcTrigger');
    if (trigger) trigger.classList.add('open');

    this.renderSuggestions();
    this.processCalculation(this._activeQty);
    if (this.inputEl) {
      this.inputEl.focus();
    }
  }

  close() {
    this.isOpen = false;
    if (this.container) this.container.classList.remove('open');
    const trigger = document.getElementById('stockCalcTrigger');
    if (trigger) trigger.classList.remove('open');
  }

  handleIncrease() {
    this._activeQty++;
    if (this.inputEl) this.inputEl.value = this._activeQty;
    this.processCalculation(this._activeQty);
  }

  handleDecrease() {
    if (this._activeQty > 1) {
      this._activeQty--;
      if (this.inputEl) this.inputEl.value = this._activeQty;
      this.processCalculation(this._activeQty);
    }
  }
  
  handleInput() {
    const val = parseInt(this.inputEl.value, 10);
    if (!isNaN(val) && val > 0) {
       this._activeQty = val;
       this.processCalculation(val);
    }
  }

  renderSuggestions() {
    if (!this.chipsEl) return;
    this.chipsEl.innerHTML = '';
    
    // Entitylerimizden uniq MF değerleri çıkar (örnek: 10 alana 2 bedava -> 12)
    const suggestions = new Set();
    this.currentEntities.forEach(e => {
       const mf = OrderDataEngine.parseMf(e.mfString);
       if (mf) {
         suggestions.add(mf.total);
         suggestions.add(mf.total * 2); // 2 paket önerimi
       }
    });

    Array.from(suggestions).sort((a,b)=>a-b).slice(0,5).forEach(qty => {
      const btn = document.createElement('button');
      btn.className = 'mf-chip' + (this._activeQty === qty ? ' active' : '');
      btn.innerHTML = `${qty} Adet`;
      btn.onclick = () => {
         this._activeQty = qty;
         if (this.inputEl) this.inputEl.value = qty;
         this.renderSuggestions(); // Update active chip
         this.processCalculation(qty);
      };
      this.chipsEl.appendChild(btn);
    });
  }

  processCalculation(qty) {
    if (!this.resultsEl) return;
    if (!this.currentEntities.length) {
      this.resultsEl.innerHTML = '<div style="text-align:center; padding:16px;">Veri yok.</div>';
      return;
    }

    // Matematik moturundan en karlı fiyat senaryolarını çek
    const bestOptions = OrderDataEngine.calculateBestOptions(this.currentEntities, qty);
    
    if (!bestOptions.length) {
        this.resultsEl.innerHTML = 'Fiyat bulunamadı';
        return;
    }

    const html = bestOptions.map((opt, idx) => {
        const isBest = idx === 0;
        const mfDetail = opt.mf ? `MF: ${opt.mfStr} (${opt.orderQty} ödenir, ${opt.receiveQty} gelir)` : `[Düz Adet: ${opt.orderQty}]`;
        
        return `
        <div class="sc-row sc-row-clickable ${isBest ? 'sc-best' : ''}" onclick="window.addToPlanFromStockCalc('${opt.depotId}', ${qty})">
          <div class="sc-rank">${idx + 1}</div>
          <div class="sc-depot">
            <div class="sc-depot-name">${opt.depot}</div>
            <div class="sc-depot-detail">${mfDetail}</div>
          </div>
          <div class="sc-prices">
            ${isBest ? '<div class="sc-best-badge">EN UYGUN</div>' : ''}
            <div class="sc-unit-price">${formatCurrency(opt.effectiveUnit)} (Birim başı)</div>
            <div class="sc-total-price">Toplam: ${formatCurrency(opt.totalCost)}</div>
          </div>
        </div>
        `;
    }).join('');

    this.resultsEl.innerHTML = html;
  }
}

export const stockCalculator = new StockCalculator();

// Expose click action to window for the rendered HTML
EventBinder.exposeToWindow('addToPlanFromStockCalc', (depotId, qty) => {
   pushDiagnostic('plan/add', `Stok hesaplayıcıdan PLANA EKLENDİ (Depo: ${depotId}, Miktar: ${qty})`);
   // OrderLayout.add(depotId, qty);
   stockCalculator.close();
});
