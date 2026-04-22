/**
 * WorkspacePlanView.js
 *
 * Workspace modunda "Aktif Siparis Plani" detay ekraninin yogun liste render'i.
 * Klasik mod degistirilmez; yalniz `isWorkspaceMode()` branch'inden cagrilir.
 *
 * Rol:
 *  - Urun bazinda tek satir ozet + altinda depo karar satirlari (accordion).
 *  - Tek depo varsa inline tek satir gosterim.
 *  - Her grup icinde en ucuz birim maliyetli depo "en ucuz" isareti alir;
 *    digerleri icin en ucuza gore +delta bilgisi gosterilir.
 *
 * Event baglama: sadece data-* attribute uretilir. Tiklama/qty/remove
 * davranisi `bindOrderPlanEntryEvents()` tarafinca app.js icinde zaten
 * mevcut ayni data-attribute'lar uzerinden baglanir. Bu modul olay
 * dinleyici eklemez, sadece HTML uretir.
 */

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTl(value) {
  const num = Number(value) || 0;
  return `TL ${num.toFixed(2).replace('.', ',')}`;
}

function formatDelta(value) {
  const num = Number(value) || 0;
  if (num <= 0) return '';
  return `+${num.toFixed(2).replace('.', ',')}`;
}

function findCheapestEntryKey(entries) {
  let cheapestKey = null;
  let cheapestUnit = Infinity;
  for (const entry of entries) {
    const unit = Number(entry.effectiveUnit);
    if (!Number.isFinite(unit) || unit <= 0) continue;
    if (unit < cheapestUnit) {
      cheapestUnit = unit;
      cheapestKey = `${entry.key}::${entry.depot}`;
    }
  }
  return { key: cheapestKey, unit: cheapestUnit };
}

function renderDepotRow(item, { cheapestKey, cheapestUnit }) {
  const qty = Math.max(parseInt(item.desiredQty, 10) || 1, 1);
  const unit = Number(item.effectiveUnit) || 0;
  const total = Number(item.totalCost) || 0;
  const unitText = unit > 0 ? formatTl(unit) : 'Birim yok';
  const totalText = formatTl(total);
  const depotName = escHtml(item.depot || 'Depo yok');
  const barcode = escHtml(item.barcode || '');
  const modeText = item.planningMode === 'mf' && item.mfStr ? escHtml(item.mfStr) : 'Normal alim';
  const rowKey = `${item.key}::${item.depot}`;
  const isCheapest = rowKey === cheapestKey && unit > 0;
  const delta = !isCheapest && unit > 0 && Number.isFinite(cheapestUnit)
    ? (unit - cheapestUnit) * qty
    : 0;
  const marker = isCheapest
    ? '<span class="ws-plan-marker is-best" title="En ucuz depo">En ucuz</span>'
    : (delta > 0
        ? `<span class="ws-plan-marker is-delta" title="En ucuza gore fark">${formatDelta(delta)}</span>`
        : '<span class="ws-plan-marker is-muted"></span>');

  const depotGoBtn = item.depotUrl
    ? `<button class="ws-plan-icon-btn" type="button" title="Depoya Git" data-plan-card-depot="${escHtml(item.key)}" data-plan-card-depot-name="${escHtml(item.depot)}">Depoya Git</button>`
    : '';

  return `
    <div class="ws-plan-depot-row plan-detail-item-editable"
         tabindex="0"
         role="button"
         data-plan-editor-open="${escHtml(item.key)}"
         data-plan-editor-depot="${escHtml(item.depot)}"
         data-barcode="${barcode}">
      <div class="ws-plan-depot-name">
        <span class="ws-plan-dot ${isCheapest ? 'is-best' : ''}"></span>
        <span class="ws-plan-depot-text">${depotName}</span>
      </div>
      <div class="ws-plan-calc">
        <span class="ws-plan-qty">${qty}</span>
        <span class="ws-plan-sep">x</span>
        <span class="ws-plan-unit">${unitText}</span>
        <span class="ws-plan-sep">=</span>
        <span class="ws-plan-total">${totalText}</span>
      </div>
      <div class="ws-plan-mode">${modeText}</div>
      <div class="ws-plan-marker-cell">${marker}</div>
      <div class="ws-plan-row-actions">
        <div class="ws-plan-stepper">
          <button type="button" class="ws-plan-step" data-plan-card-minus="${escHtml(item.key)}" data-plan-card-minus-depot="${escHtml(item.depot)}" aria-label="Azalt">&minus;</button>
          <span class="ws-plan-step-value">${qty}</span>
          <button type="button" class="ws-plan-step" data-plan-card-plus="${escHtml(item.key)}" data-plan-card-plus-depot="${escHtml(item.depot)}" aria-label="Artir">+</button>
        </div>
        ${depotGoBtn}
        <button type="button" class="ws-plan-icon-btn is-danger" title="Listeden Kaldir" data-plan-card-remove="${escHtml(item.key)}" data-plan-card-remove-depot="${escHtml(item.depot)}">Sil</button>
      </div>
    </div>
  `;
}

function renderProductGroup(group) {
  const entries = group.entries || [];
  const cheapest = findCheapestEntryKey(entries);
  const totalText = formatTl(group.totalCost);
  const depotBadge = `${entries.length} depo`;
  const singleEntry = entries.length === 1;

  const headExtras = singleEntry
    ? ''
    : `<button type="button" class="ws-plan-collapse-btn" aria-label="Katla" data-ws-plan-toggle="${escHtml(group.key)}">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
           <polyline points="6 9 12 15 18 9" />
         </svg>
       </button>`;

  return `
    <section class="ws-plan-group ${singleEntry ? 'is-single' : 'is-multi'}"
             data-ws-plan-group="${escHtml(group.key)}"
             data-ws-plan-open="true">
      <header class="ws-plan-group-head">
        <div class="ws-plan-group-title">
          <h3>${escHtml(group.name || 'Urun')}</h3>
          <div class="ws-plan-group-meta">
            <span>${escHtml(group.barcode || 'Barkod yok')}</span>
            <span>${depotBadge}</span>
          </div>
        </div>
        <div class="ws-plan-group-total">${totalText}</div>
        ${headExtras}
      </header>
      <div class="ws-plan-group-body">
        ${entries.map((entry) => renderDepotRow(entry, cheapest)).join('')}
      </div>
    </section>
  `;
}

export function renderWorkspacePlanDetail(container, ctx) {
  if (!container) return;
  const planGroups = ctx.planGroups || [];
  const totalCost = Number(ctx.totalCost) || 0;
  const depotCount = Array.isArray(ctx.depots) ? ctx.depots.length : 0;
  const itemCount = planGroups.length;

  container.innerHTML = `
    <section class="ops-card plan-detail-shell workspace-plan-detail-shell ws-plan-shell">
      <div class="ws-plan-toolbar" role="toolbar">
        <div class="ws-plan-toolbar-stats">
          <span><strong>${itemCount}</strong> kalem</span>
          <span class="ws-plan-dot-sep">&bull;</span>
          <span><strong>${depotCount}</strong> depo</span>
          <span class="ws-plan-dot-sep">&bull;</span>
          <span>Toplam <strong class="ws-plan-total-accent">${formatTl(totalCost)}</strong></span>
        </div>
        <div class="ws-plan-toolbar-actions">
          <button type="button" class="btn btn-outline ws-plan-csv-btn" id="exportPlanCsvBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV Indir
          </button>
        </div>
      </div>

      <div class="ws-plan-list-head" aria-hidden="true">
        <div>Depo</div>
        <div>Adet &times; Birim = Toplam</div>
        <div>Alim</div>
        <div>Fark</div>
        <div></div>
      </div>

      <div class="ws-plan-list">
        ${planGroups.map((group) => renderProductGroup(group)).join('')}
      </div>
    </section>
  `;

  // Basit accordion - CSS-free davranis. Sadece katlama butonu ile calisir.
  container.querySelectorAll('[data-ws-plan-toggle]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const key = btn.getAttribute('data-ws-plan-toggle');
      const group = container.querySelector(`[data-ws-plan-group="${key}"]`);
      if (!group) return;
      const open = group.getAttribute('data-ws-plan-open') === 'true';
      group.setAttribute('data-ws-plan-open', open ? 'false' : 'true');
    });
  });
}
