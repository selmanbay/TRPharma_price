/**
 * plan-ui.js
 * UI rendering owner for plan page + plan drawer.
 * Input-only string builder; DOM operations stay in orchestrator.
 */
(function initV23PlanUI(globalScope) {
  if (!globalScope) return;

  function renderPlanPage(ctx) {
    const {
      plan = [],
      groups = [],
      metrics = { totalCost: 0, depotCount: 0 },
      approvalQueue = [],
      approvalItems = [],
      approvalTotal = 0,
      selectedApprovalCount = 0,
      viewMode = 'drug',
      approvalMode = false,
      approvalScope = null,
      approvalSelection = [],
      deps = {},
    } = ctx || {};

    const formatCurrency = deps.formatCurrency || ((value) => String(value || 0));
    const depotBadgeHtml = deps.depotBadgeHtml || (() => '');
    const esc = deps.esc || ((value) => String(value || ''));
    const escJs = deps.escJs || ((value) => String(value || ''));
    const renderEmptyState = deps.renderEmptyState || (() => '');
    const getApprovalSelectionKey = deps.getApprovalSelectionKey || ((item) => `${item?.key || ''}::${item?.depotId || ''}`);

    const renderDrugGroups = () => groups.map((group) => `
      <div class="plan-item-group" data-depot-tone="${esc(group.items?.[0]?.depotId || group.items?.[0]?.depot || '')}">
        <div class="plan-item-header">
          <div>
            <strong>${esc(group.name)}</strong>
            <div class="text-sm text-muted">${(group.items || []).length > 1 ? `${(group.items || []).length} depoda dağıtıldı` : 'Tek depoda'}</div>
          </div>
          <div class="flex items-center gap-4">
            <strong class="font-mono">${formatCurrency((group.items || []).reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0))}</strong>
            <button class="btn-icon plan-edit-btn" onclick="event.stopPropagation(); openPlanDrawer('${escJs(group.key)}')"><span class="material-symbols-outlined">edit</span></button>
          </div>
        </div>
        <table class="plan-sub-table">
          <thead><tr><th>Depo</th><th class="align-right">Adet</th><th class="align-right">Birim</th><th class="align-right">Toplam</th><th class="align-right">Aksiyon</th></tr></thead>
          <tbody>
            ${(group.items || []).map((item) => `
              <tr onclick="openPlanDrawer('${escJs(group.key)}')">
                <td>${depotBadgeHtml(item.depotId, item.depot)}</td>
                <td class="align-right font-mono">${item.desiredQty}</td>
                <td class="align-right font-mono">${formatCurrency(item.effectiveUnit || 0)}</td>
                <td class="align-right font-mono">${formatCurrency(item.totalCost || 0)}</td>
                <td class="align-right">
                  <div class="plan-row-actions">
                    ${item.approvalStatus === 'approved' ? '<span class="plan-approved-chip">Onaylandı</span>' : ''}
                    ${item.depotUrl ? `<button class="btn btn-ghost plan-inline-action" onclick="event.stopPropagation(); openPlanInDepot('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')">Depoda Aç</button>` : ''}
                    ${item.approvalStatus === 'approved'
                      ? `<button class="btn btn-outline plan-inline-action" onclick="event.stopPropagation(); removePlanApproval('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')"><span class="material-symbols-outlined" style="font-size:16px;">restart_alt</span><span>Onayı Kaldır</span></button>`
                      : `<button class="btn btn-brand plan-inline-action plan-inline-action-primary" onclick="event.stopPropagation(); queuePlanItemForApproval('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')"><span class="material-symbols-outlined" style="font-size:16px;">outbox</span><span>Onaya Gönder</span></button>`}
                    <button class="btn-icon destructive" onclick="event.stopPropagation(); removePlanItemAndRender('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')"><span class="material-symbols-outlined">delete</span></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    const renderDepotGroups = () => groups.map((group) => `
      <div class="plan-item-group" data-depot-tone="${esc(group.depotId || group.depot || '')}">
        <div class="plan-item-header">
          <div>
            <strong>${esc(group.depot)}</strong>
            <div class="text-sm text-muted">${(group.items || []).length} ilaç bu depoda</div>
          </div>
          <div class="flex items-center gap-4">
            <strong class="font-mono">${formatCurrency((group.items || []).reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0))}</strong>
            ${group.items?.[0]?.depotUrl ? `<button class="btn btn-ghost plan-inline-action" onclick="event.stopPropagation(); openPlanInDepot('${escJs(group.items[0].key)}','${escJs(group.items[0].depotId || group.items[0].depot)}')">Depoda Aç</button>` : ''}
          </div>
        </div>
        <table class="plan-sub-table">
          <thead><tr><th>İlaç</th><th class="align-right">Adet</th><th class="align-right">Birim</th><th class="align-right">Toplam</th><th class="align-right">Aksiyon</th></tr></thead>
          <tbody>
            ${(group.items || []).map((item) => `
              <tr class="${item.approvalStatus === 'approved' ? 'is-approved' : ''}" onclick="openPlanDrawer('${escJs(item.key)}')">
                <td>${esc(item.name || item.ad || item.key)}</td>
                <td class="align-right font-mono">${item.desiredQty}</td>
                <td class="align-right font-mono">${formatCurrency(item.effectiveUnit || 0)}</td>
                <td class="align-right font-mono">${formatCurrency(item.totalCost || 0)}</td>
                <td class="align-right">
                  <div class="plan-row-actions">
                    ${item.approvalStatus === 'approved' ? '<span class="plan-approved-chip">Onaylandı</span>' : ''}
                    ${item.depotUrl ? `<button class="btn btn-ghost plan-inline-action" onclick="event.stopPropagation(); openPlanInDepot('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')">Depoda Aç</button>` : ''}
                    ${item.approvalStatus === 'approved'
                      ? `<button class="btn btn-outline plan-inline-action" onclick="event.stopPropagation(); removePlanApproval('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')"><span class="material-symbols-outlined" style="font-size:16px;">restart_alt</span><span>Onayı Kaldır</span></button>`
                      : `<button class="btn btn-brand plan-inline-action plan-inline-action-primary" onclick="event.stopPropagation(); queuePlanItemForApproval('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')"><span class="material-symbols-outlined" style="font-size:16px;">outbox</span><span>Onaya Gönder</span></button>`}
                    <button class="btn-icon plan-edit-btn" onclick="event.stopPropagation(); openPlanDrawer('${escJs(item.key)}')"><span class="material-symbols-outlined">edit</span></button>
                    <button class="btn-icon destructive" onclick="event.stopPropagation(); removePlanItemAndRender('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')"><span class="material-symbols-outlined">delete</span></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    const renderApprovalSelectionScaffold = () => `
      <div class="plan-card approval-card">
        <div class="plan-card-top">
          <div>
            <div class="plan-card-title">${approvalScope ? 'Kalem Onay Listesi' : 'Onaya Gonderilenler'}</div>
            <div class="text-sm text-muted" style="margin-top:6px;">Listeden tek tek secip bir sonraki onay adimina gecin.</div>
          </div>
          <div class="plan-card-top-right">
            <div class="plan-card-total-label">Toplam</div>
            <div class="plan-card-total">${formatCurrency(approvalTotal)}</div>
          </div>
        </div>
        ${approvalItems.length ? `
          <div class="approval-toolbar">
            <div class="text-sm text-muted">${selectedApprovalCount} kalem seçili</div>
            <div class="approval-toolbar-actions">
              <button type="button" class="btn btn-ghost plan-inline-action" data-plan-approval-cmd="select-all">Tümünü Seç</button>
              <button type="button" class="btn btn-ghost plan-inline-action" data-plan-approval-cmd="select-none">Seçimi Temizle</button>
              <button type="button" class="btn btn-brand plan-inline-action plan-inline-action-primary" data-plan-approval-cmd="complete" ${selectedApprovalCount === 0 ? 'disabled aria-disabled="true"' : ''}>Seçilenlerle Devam Et</button>
            </div>
          </div>
          <div class="approval-list">
            ${approvalItems.map((item) => `
              <div class="approval-row ${approvalSelection.includes(getApprovalSelectionKey(item)) ? 'is-selected' : ''}" role="button" tabindex="0" data-plan-approval-row="1" data-plan-approval-k="${encodeURIComponent(String(item.key || ''))}" data-plan-approval-d="${encodeURIComponent(String(item.depotId || item.depot || ''))}">
                <div>
                  <strong>${esc(item.name || item.ad || item.key)}</strong>
                  <div class="text-sm text-muted" style="margin-top:6px;">${depotBadgeHtml(item.depotId, item.depot)}</div>
                </div>
                <div class="approval-meta">
                  <span>${item.desiredQty} adet</span>
                  <span>${formatCurrency(item.unitCost || 0)} birim</span>
                  <strong class="font-mono">${formatCurrency(item.totalCost || 0)}</strong>
                  <span class="approval-check" aria-hidden="true"><span class="material-symbols-outlined" style="font-size:16px;">check</span></span>
                  <button type="button" class="btn btn-ghost plan-inline-action plan-approval-remove" data-plan-approval-k="${encodeURIComponent(String(item.key || ''))}" data-plan-approval-d="${encodeURIComponent(String(item.depotId || item.depot || ''))}">Listeden Çıkar</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="padding:28px 24px;">
            ${renderEmptyState({
              variant: 'plan',
              title: 'Onay listesi bos',
              body: 'Plan satirlarindan Onaya Gonder dediginiz kalemler burada listelenecek.',
            })}
          </div>
        `}
      </div>
    `;

    return `
      <div class="plan-container plan-container-wide">
        <div class="plan-header">
          <h1>Aktif Sipariş Planı</h1>
          <p class="text-muted">${plan.length} kalem, ${metrics.depotCount} depo, toplam ${formatCurrency(metrics.totalCost)}</p>
        </div>
        <div class="plan-toolbar">
          <div class="plan-segment">
            <button class="btn ${viewMode === 'drug' ? 'btn-brand' : 'btn-outline'}" onclick="setPlanViewMode('drug')">İlaç Bazlı</button>
            <button class="btn ${viewMode === 'depot' ? 'btn-brand' : 'btn-outline'}" onclick="setPlanViewMode('depot')">Depo Bazlı</button>
          </div>
          <div class="plan-toolbar-actions">
            ${approvalMode ? '<button class="btn btn-outline" onclick="closePlanApproval()">Listeye Dön</button>' : '<button class="btn btn-outline" onclick="openPlanInDepot()">Depoda Aç</button>'}
            <button class="btn btn-brand" onclick="openPlanApproval()">Onay Listesi${approvalQueue.length ? ` (${approvalQueue.length})` : ''}</button>
          </div>
        </div>
        ${plan.length ? (approvalMode ? renderApprovalSelectionScaffold() : `
          <div class="plan-card">
            <div class="plan-card-top">
              <div class="plan-card-title">${viewMode === 'depot' ? 'Depo bazlı operasyon özeti' : 'İlaç bazlı operasyon özeti'}</div>
              <div class="plan-card-top-right">
                <div class="plan-card-total-label">Toplam</div>
                <div class="plan-card-total">${formatCurrency(metrics.totalCost)}</div>
              </div>
            </div>
            ${viewMode === 'depot' ? renderDepotGroups() : renderDrugGroups()}
          </div>
        `) : `
          ${renderEmptyState({
            variant: 'plan',
            title: 'Plan boş',
            body: 'Detay ekranından veya toplu aramadan ürün ekleyin.',
            ctaLabel: 'Ana Sayfa',
            ctaAction: "switchMock('home')",
          })}
        `}
      </div>
    `;
  }

  function renderPlanDrawer(ctx) {
    const { group, drawerOptions = [], deps = {} } = ctx || {};
    const formatCurrency = deps.formatCurrency || ((value) => String(value || 0));
    const depotBadgeHtml = deps.depotBadgeHtml || (() => '');
    const esc = deps.esc || ((value) => String(value || ''));
    const escJs = deps.escJs || ((value) => String(value || ''));

    return {
      headerHtml: `
        <div>
          <div style="font-size:12px; font-weight:700; color:var(--ink-500); text-transform:uppercase;">Plan Duzenleme</div>
          <h3 style="font-size:24px; margin-top:8px;">${esc(group?.name || '')}</h3>
        </div>
        <button class="btn-icon" onclick="closeDrawer()"><span class="material-symbols-outlined">close</span></button>
      `,
      bodyHtml: `
        <div class="drawer-hero">
          <div class="info-grid">
            <div class="info-card"><div class="info-card-lbl">Kalem Sayisi</div><div class="info-card-val">${group?.items?.length || 0}</div></div>
            <div class="info-card"><div class="info-card-lbl">Toplam</div><div class="info-card-val">${formatCurrency((group?.items || []).reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0))}</div></div>
          </div>
        </div>
        <div class="drawer-scroll">
        ${(() => {
          // Duplicate depoları kaldır (aynı depotId → sadece birini göster, selected olana öncelik)
          const seen = new Set();
          const uniqueOptions = [];
          // Önce seçili olanları ekle
          drawerOptions.filter(o => o.selected).forEach(item => {
            const dId = String(item.depotId || item.depot || '').trim();
            if (!seen.has(dId)) { seen.add(dId); uniqueOptions.push(item); }
          });
          // Sonra seçili olmayanları ekle
          drawerOptions.filter(o => !o.selected).forEach(item => {
            const dId = String(item.depotId || item.depot || '').trim();
            if (!seen.has(dId)) { seen.add(dId); uniqueOptions.push(item); }
          });
          return uniqueOptions.map((item) => `
          <div class="depot-alt-card ${item.selected ? 'best' : ''}" data-selected="${item.selected ? 'true' : 'false'}">
            <div class="flex justify-between items-center mb-4">
              <div>
                ${depotBadgeHtml(item.depotId, item.depot)}
                <div class="text-sm text-muted" style="margin-top:6px;">${item.selected ? 'Plana ekli teklif' : 'Alternatif teklif'}</div>
              </div>
              <div class="flex items-center gap-2">
                ${item.selected ? '<span class="drawer-check" aria-hidden="true"><span class="material-symbols-outlined" style="font-size:14px;">check</span></span>' : ''}
                <strong class="font-mono">${formatCurrency(item.planning?.totalCost || item.totalCost || 0)}</strong>
              </div>
            </div>
            <div class="drawer-offer-meta">
              <div>
                <div class="text-sm text-muted">Birim: <strong class="font-mono" style="color:var(--ink-900);">${formatCurrency(item.planning?.effectiveUnit || item.effectiveUnit || 0)}</strong></div>
                <div class="text-sm text-muted" style="margin-top:4px;">MF: ${esc(item.mfStr || '-')}</div>
              </div>
              <div class="drawer-actions">
                ${item.selected ? `
                  <div class="qty-control">
                    <button onclick="changePlanQty('${escJs(item.key)}','${escJs(item.depotId || item.depot)}', -1)">-</button>
                    <input value="${item.desiredQty}" readonly>
                    <button onclick="changePlanQty('${escJs(item.key)}','${escJs(item.depotId || item.depot)}', 1)">+</button>
                  </div>
                  <button class="btn btn-outline" onclick="removePlanItemAndRender('${escJs(item.key)}','${escJs(item.depotId || item.depot)}')">Sil</button>
                ` : `
                  <button class="btn btn-outline" onclick="selectPlanAlternative('${escJs(group?.key || '')}','${escJs(item.depotId || item.depot)}')">Bu Depoyu Sec</button>
                `}
              </div>
            </div>
          </div>
        `).join('');
          })()}
        </div>
      `,
    };
  }

  globalScope.V23PlanUI = {
    renderPlanPage,
    renderPlanDrawer,
  };
})(typeof window !== 'undefined' ? window : null);
