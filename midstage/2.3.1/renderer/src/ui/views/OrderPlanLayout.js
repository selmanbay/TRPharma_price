import { Storage, StorageKeys } from '../../core/storage.js';
import { EventBinder } from '../EventBinder.js';
import { formatCurrency } from '../../utils/formatters.js';

/**
 * OrderPlanLayout.js
 * Sağ taraftaki "Sipariş Planı"nın tamamı. Efsanevi "app.js" içerisindeki
 * OrderPlan drawer ve grid çizdirme operasyonlarının temizlenmiş halidir.
 */

export class OrderPlanLayout {
  constructor() {
    this.plan = []; // { key, name, barcode, depot, qty, expectedPrice, ... }
    
    // DOM bindings
    this.boundClose = this.closeEditor.bind(this);
  }

  init() {
    this.plan = Storage.read(StorageKeys.ORDER_PLAN, []);
    EventBinder.bind('openOrderPlanBtn', 'click', () => { window.showPage('order-plan') });
    EventBinder.bind('clearOrderPlanBtn', 'click', () => this.clearPlan());
    EventBinder.bind('.plan-editor-close', 'click', this.boundClose);
    EventBinder.bind('.plan-editor-overlay', 'click', this.boundClose);

    this.renderMiniDashboardWidget(); // Ana sayfadaki mini gösterim
  }

  save() {
    Storage.writeLocal(StorageKeys.ORDER_PLAN, this.plan);
    this.renderMiniDashboardWidget();
  }

  addToPlan(drugEntity, qty, depotId, effectiveCost = null) {
      const existing = this.plan.find(p => p.barcode === drugEntity.barcode && p.depotId === depotId);
      if (existing) {
          existing.qty += qty;
      } else {
          this.plan.unshift({
             key: `PLAN_${Date.now()}`,
             name: drugEntity.name,
             barcode: drugEntity.barcode,
             depotId: depotId,
             depotName: drugEntity.depotName,
             qty: qty,
             effectiveCost: effectiveCost || drugEntity.price
          });
      }
      this.save();
      
      const toast = document.getElementById('toast');
      if (toast) {
         toast.textContent = `${qty} adet plana eklendi`;
         toast.classList.add('show');
         setTimeout(() => toast.classList.remove('show'), 3000);
      }
  }

  clearPlan() {
      if(confirm('Tüm sipariş planını silmek istiyor musunuz?')) {
          this.plan = [];
          this.save();
      }
  }

  renderMiniDashboardWidget() {
     const container = document.getElementById('orderPlanContainer');
     if (!container) return;

     if (this.plan.length === 0) {
         container.innerHTML = '<div style="color:var(--text-3); font-size:0.9rem; padding: 20px 0;">Henüz planda ürün yok.</div>';
         return;
     }

     const totalSum = this.plan.reduce((sum, p) => sum + (p.qty * p.effectiveCost), 0);
     
     // Sadece en son eklenen 3 tanesini ana sayfada göster
     const html = this.plan.slice(0, 3).map(p => `
         <div class="op-mini-item">
             <div class="op-mi-meta">
                 <div class="op-mi-name">${p.name}</div>
                 <div class="op-mi-depot">${p.depotName}</div>
             </div>
             <div class="op-mi-price">${p.qty}x ${formatCurrency(p.effectiveCost)}</div>
         </div>
     `).join('');

     const footer = `
         <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
             <span>Toplam: <strong style="color:var(--accent)">${formatCurrency(totalSum)}</strong></span>
             <span style="font-size:0.8rem; color:var(--text-3)">${this.plan.length} Çeşit</span>
         </div>
     `;

     container.innerHTML = html + footer;
  }

  // --- Drawer ---

  openEditor(planItemKey) {
    const item = this.plan.find(p => p.key === planItemKey);
    if (!item) return;

    document.getElementById('planEditorTitle').textContent = item.name;
    document.getElementById('planEditorSubtitle').textContent = `${item.depotName} - Barkod: ${item.barcode}`;
    
    const body = document.getElementById('planEditorBody');
    body.innerHTML = `
        <div style="padding:20px; font-size:14px;">
           <label>Miktar</label><br>
           <input type="number" id="drawerQty" value="${item.qty}" class="sc-input" style="width:100%; margin-top:5px;" />
           <button class="btn btn-primary" onclick="window.updatePlanDrawerItem('${item.key}')" style="margin-top:15px; width:100%;">Kaydet</button>
           <button class="btn btn-outline" onclick="window.removePlanDrawerItem('${item.key}')" style="margin-top:10px; width:100%; border-color:var(--status-red); color:var(--status-red);">Listeden Kaldır</button>
        </div>
    `;

    const overlay = document.getElementById('planEditorOverlay');
    const panel = document.getElementById('planEditorPanel');
    if (overlay) overlay.classList.add('open');
    if (panel) panel.classList.add('open');
  }

  closeEditor() {
    const overlay = document.getElementById('planEditorOverlay');
    const panel = document.getElementById('planEditorPanel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }
}

export const orderPlanLayout = new OrderPlanLayout();

EventBinder.exposeToWindow('updatePlanDrawerItem', (key) => {
    const qty = parseInt(document.getElementById('drawerQty').value, 10);
    const item = orderPlanLayout.plan.find(p => p.key === key);
    if (item && qty > 0) {
        item.qty = qty;
        orderPlanLayout.save();
        orderPlanLayout.closeEditor();
    }
});

EventBinder.exposeToWindow('removePlanDrawerItem', (key) => {
    orderPlanLayout.plan = orderPlanLayout.plan.filter(p => p.key !== key);
    orderPlanLayout.save();
    orderPlanLayout.closeEditor();
});
