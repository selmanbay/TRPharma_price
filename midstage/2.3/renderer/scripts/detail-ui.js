/**
 * detail-ui.js
 * Search detail page HTML owner for V2.3 runtime.
 */
(function initV23DetailUI(globalScope) {
  if (!globalScope) return;

  /** Uzun BUYUK HARF ilac adlarini daha okunur hale getirir (TR locale). */
  function formatPlanLineTitle(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    return raw.split(/\s+/).map((word) => {
      if (!word) return '';
      const lower = word.toLocaleLowerCase('tr-TR');
      return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    }).join(' ');
  }

  /**
   * V2.2 `buildMfChips` / `renderWorkspaceMfCalc` ile aynı: mf.total * mult (1..5), qty bazlı uniq, sort, max 10.
   * "en uygun": tum depo satirlari icin calculatePlanning ile en düşük effectiveUnit veren adet.
   * Chip metni: V2.2 gibi ana sayı = hedef adet (s.qty); alt satır = "buy al → qty" (mf deseni title ile).
   */
  function buildMfQtyChips(items, selected, desiredQty, deps) {
    const { parseMf, calculatePlanning } = deps || {};
    const fallback = [1, 3, 5, 10, 20].map((qty) => ({
      qty,
      buy: null,
      mf: null,
    }));
    if (typeof parseMf !== 'function' || typeof calculatePlanning !== 'function') {
      return { rows: fallback, bestQty: null };
    }
    const seen = new Set();
    const suggestions = [];
    (items || []).forEach((item) => {
      const mfStr = item?.malFazlasi || item?.mfStr || '';
      const mf = parseMf(mfStr);
      if (!mf) return;
      for (let mult = 1; mult <= 5; mult += 1) {
        const qty = mf.total * mult;
        if (qty > 0 && qty <= 500 && !seen.has(qty)) {
          seen.add(qty);
          suggestions.push({
            qty,
            buy: mf.buy * mult,
            mf,
          });
        }
      }
    });
    suggestions.sort((a, b) => a.qty - b.qty);
    const topSuggestions = suggestions.slice(0, 10);
    if (topSuggestions.length === 0) {
      return { rows: fallback, bestQty: null };
    }
    let bestQty = null;
    let bestEff = Infinity;
    topSuggestions.forEach((s) => {
      let minEff = Infinity;
      (items || []).forEach((item) => {
        const plan = calculatePlanning(item, s.qty);
        const eff = Number(plan?.effectiveUnit);
        if (Number.isFinite(eff) && eff < minEff) minEff = eff;
      });
      if (minEff < bestEff) {
        bestEff = minEff;
        bestQty = s.qty;
      }
    });
    return { rows: topSuggestions, bestQty };
  }

  function resolvePlanThumbUrl(item, imageDeps) {
    const { normalizeImageUrl, isUsableImageUrl } = imageDeps || {};
    const raw = String(item?.imageUrl || item?.imgUrl || '').trim();
    if (!raw) return '';
    const norm = typeof normalizeImageUrl === 'function'
      ? String(normalizeImageUrl(raw, item?.depotUrl || '') || '').trim()
      : raw;
    if (!norm) return '';
    if (typeof isUsableImageUrl === 'function' && !isUsableImageUrl(norm)) return '';
    return norm;
  }

  /** current-modular app.js renderDetailResults ile ayni mantik: tum tekliflerden gecerli gorsel + depo onceligi */
  function pickDetailHeroImage(selected, items, imageDeps) {
    const { normalizeImageUrl, isUsableImageUrl } = imageDeps || {};
    const preferredDepotOrder = ['Selçuk Ecza', 'Sentez B2B', 'Nevzat Ecza', 'Anadolu İtriyat', 'Alliance Healthcare', 'Anadolu Pharma'];
    const rankDepot = (depot) => {
      const idx = preferredDepotOrder.indexOf(String(depot || ''));
      return idx === -1 ? 99 : idx;
    };
    const resolveOne = (item) => {
      if (!item) return '';
      const raw = String(item.imageUrl || item.imgUrl || '').trim();
      if (!raw) return '';
      const norm = typeof normalizeImageUrl === 'function'
        ? String(normalizeImageUrl(raw, item.depotUrl || '') || '').trim()
        : raw;
      if (!norm) return '';
      if (typeof isUsableImageUrl === 'function' && !isUsableImageUrl(norm)) return '';
      return norm;
    };
    const scored = [];
    const consider = (item) => {
      const url = resolveOne(item);
      if (url) scored.push({ url, rank: rankDepot(item.depot) });
    };
    consider(selected);
    (items || []).forEach(consider);
    scored.sort((a, b) => a.rank - b.rank || a.url.length - b.url.length);
    return scored[0]?.url || resolveOne(selected) || '';
  }

  function renderDetailPage(ctx, deps) {
    const {
      items = [],
      selected = null,
      planning = null,
      barcode = '',
      plan = [],
      planMetrics = { totalCost: 0 },
      hasMfOptions = false,
      selectedMf = null,
      detailPlanAdded = false,
      detailOperationState = { inPlan: false, isApproved: false },
      detailPlanCrossDepotHint = '',
      itemPlanAddedByOfferKey = {},
      detailPlanSummaryExpanded = false,
      desiredQty = 1,
      bulkDetailContext = null,
      selectedOfferKey = '',
      selectedGroupName = '',
    } = ctx || {};
    const {
      esc,
      escJs,
      formatCurrency,
      depotBadgeHtml,
      formatStock,
      renderOperationStateBadges,
      calculatePlanning,
      getOfferKey,
      normalizeImageUrl,
      isUsableImageUrl,
      parseMf,
    } = deps || {};
    if (
      typeof esc !== 'function'
      || typeof escJs !== 'function'
      || typeof formatCurrency !== 'function'
      || typeof depotBadgeHtml !== 'function'
      || typeof formatStock !== 'function'
      || typeof renderOperationStateBadges !== 'function'
      || typeof calculatePlanning !== 'function'
      || typeof getOfferKey !== 'function'
    ) return '';

    if (!selected) {
      return '<div class="v23-detail-wrapper"><div class="card" style="padding:32px; color:var(--ink-500);">Detay yüklenemedi.</div></div>';
    }
    const detailImageUrl = pickDetailHeroImage(selected, items, { normalizeImageUrl, isUsableImageUrl });

    let minEffectiveAcross = Infinity;
    (items || []).forEach((it) => {
      const eff = Number(calculatePlanning(it, desiredQty)?.effectiveUnit);
      if (Number.isFinite(eff) && eff < minEffectiveAcross) minEffectiveAcross = eff;
    });
    const selectedEffective = Number(calculatePlanning(selected, desiredQty)?.effectiveUnit);
    const showEnUygunCostLabel = Number.isFinite(minEffectiveAcross)
      && Number.isFinite(selectedEffective)
      && selectedEffective <= minEffectiveAcross + 1e-6;
    const selectedMfStr = String(selected.mfStr || selected.malFazlasi || selected.MalFazlasi || '').trim();
    const displayMf = selectedMfStr;

    const unitCaption = planning?.planningMode === 'mf'
      ? 'MF dahil net birim maliyet'
      : 'Depo net birim fiyatı';
    const planImageDeps = { normalizeImageUrl, isUsableImageUrl };
    const mfChipModel = hasMfOptions
      ? buildMfQtyChips(items, selected, desiredQty, { parseMf, calculatePlanning })
      : { rows: [], bestQty: null };
    const depotCampaignLabel = String(selected?.depot || '').toLocaleLowerCase('tr-TR').includes('selçuk')
      ? 'Selçuk kampanya'
      : 'Depo kampanya';

    return `
      <div class="search-layout">
        <div class="search-sidebar v23-detail-sidebar">
          <div class="v23-detail-sidebar__section v23-detail-sidebar__section--offer">
            <button type="button" class="btn btn-ghost v23-detail-sidebar__back" onclick="switchMock('search-variants')"><span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span> Formlara dön</button>
            <div class="v23-offer-lux-card">
              <div class="v23-offer-lux-card__accent" aria-hidden="true"></div>
              <div class="v23-offer-lux-card__body">
                <div class="v23-detail-sidebar__eyebrow">Seçili teklif</div>
                <div class="v23-detail-sidebar__depot">${depotBadgeHtml(selected.depotId, selected.depot)}</div>
                <div class="v23-offer-sheet v23-offer-sheet--lux">
                  <div class="v23-offer-sheet__row v23-offer-sheet__row--hero">
                    <span class="v23-offer-sheet__label">Birim maliyet</span>
                    <span class="v23-offer-sheet__value">${formatCurrency(planning?.effectiveUnit || selected.fiyatNum || 0)}</span>
                  </div>
                  <p class="v23-offer-sheet__hint">${esc(unitCaption)}</p>
                  <div class="v23-offer-sheet__divider"></div>
                  <div class="v23-offer-sheet__row">
                    <span class="v23-offer-sheet__label">Müşteri fiyatı</span>
                    <span class="v23-offer-sheet__value ${selected.psfFiyatNum ? '' : 'v23-offer-sheet__value--muted'}">${selected.psfFiyatNum ? formatCurrency(selected.psfFiyatNum) : 'PSF yok'}</span>
                  </div>
                  <div class="v23-offer-sheet__row">
                    <span class="v23-offer-sheet__label">Stok</span>
                    <span class="v23-offer-sheet__value">${esc(formatStock(selected))}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="v23-detail-sidebar__actions">
              <button type="button" class="btn ${detailPlanAdded ? 'btn-outline' : 'btn-brand'} v23-detail-sidebar__btn-main" style="${detailPlanAdded ? 'border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);' : ''}" onclick="addSelectedOfferToPlan()">${detailPlanAdded ? 'Bu depoda planda' : `Plana ekle · ${formatCurrency(planning?.totalCost || 0)}`}</button>
              ${detailPlanAdded ? `<button type="button" class="btn ${detailOperationState?.isApproved ? 'btn-outline' : 'btn-brand'} v23-detail-sidebar__btn-sec" style="${detailOperationState?.isApproved ? 'border-color:rgba(245,158,11,0.35); color:#a16207; background:rgba(245,158,11,0.12);' : ''}" onclick="${detailOperationState?.isApproved ? 'removeSelectedOfferApproval()' : 'approveSelectedOfferFromDetail()'}">${detailOperationState?.isApproved ? 'Onayı kaldır' : 'Onaya gönder'}</button>` : ''}
              ${detailPlanAdded ? `<button type="button" class="btn btn-outline v23-detail-sidebar__btn-sec" style="border-color:rgba(239,68,68,0.3); color:#b91c1c;" onclick="removeSelectedOfferFromPlan()">Plandan sil</button>` : ''}
              <button type="button" class="btn btn-outline v23-detail-sidebar__btn-sec" onclick="openSelectedOfferInDepot()">Web'de aç</button>
              ${detailPlanCrossDepotHint ? `<p class="v23-detail-sidebar__hint text-sm text-muted" style="margin:10px 0 0;line-height:1.35;">${esc(detailPlanCrossDepotHint)}</p>` : ''}
            </div>
          </div>
          <div class="v23-detail-sidebar__section v23-detail-sidebar__section--plan">
            <div class="v23-detail-sidebar__eyebrow">Sipariş planı özeti</div>
            <div class="v23-plan-summary-toolbar">
              <button type="button" class="btn btn-outline v23-plan-summary-toolbar__btn" onclick="scrollDetailPlanSummary(-1)" aria-label="Önceki kart"><span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span></button>
              <button type="button" class="btn btn-outline v23-plan-summary-toolbar__btn" onclick="scrollDetailPlanSummary(1)" aria-label="Sonraki kart"><span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span></button>
              <button type="button" class="btn btn-outline v23-plan-summary-toolbar__btn" onclick="toggleDetailPlanSummarySize()">${detailPlanSummaryExpanded ? 'Küçült' : 'Büyüt'}</button>
            </div>
            <div id="detail-plan-summary-track" class="v23-plan-snippet-list ${detailPlanSummaryExpanded ? 'is-expanded' : ''}">
              ${plan.length ? plan.slice(0, 6).map((item) => {
                const thumb = resolvePlanThumbUrl(item, planImageDeps);
                const lineTitle = formatPlanLineTitle(item.name || item.key);
                return `
                <div class="v23-plan-snippet v23-plan-summary-card">
                  ${thumb ? `<div class="v23-plan-snippet__thumb"><img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.style.display='none'" /></div>` : '<div class="v23-plan-snippet__thumb v23-plan-snippet__thumb--empty" aria-hidden="true"><span class="material-symbols-outlined">medication</span></div>'}
                  <div class="v23-plan-snippet__body">
                    <div class="v23-plan-snippet__top">
                      <div class="v23-plan-snippet__name">${esc(lineTitle)}</div>
                      <div class="v23-plan-snippet__price">${formatCurrency(item.totalCost)}</div>
                    </div>
                    <div class="v23-plan-snippet__foot">
                      <span class="v23-plan-snippet__depot">${depotBadgeHtml(item.depotId, item.depot)}</span>
                      <span class="v23-plan-snippet__qty">${item.desiredQty} adet</span>
                    </div>
                  </div>
                </div>`;
              }).join('') : '<div class="v23-plan-snippet-list__empty">Plan boş.</div>'}
            </div>
            <button type="button" class="btn btn-outline v23-detail-sidebar__btn-plan" onclick="switchMock('plan')">Planı düzenle ve gönder</button>
            <div class="v23-detail-sidebar__footer">${plan.length} kalem · toplam ${formatCurrency(planMetrics.totalCost)}</div>
          </div>
        </div>
        <div class="search-main">
          <div class="v23-detail-wrapper">
            <section class="v23-detail-hero" aria-label="İlaç özeti">
              <header class="v23-detail-hero__head">
                <h2>${esc(selected.ad)}</h2>
              </header>
              <div class="v23-detail-hero__body">
                <div class="v23-detail-hero__identity">
                  <div class="v23-detail-hero__identity-row">
                    <div class="v23-detail-hero__identity-visual">
                      <div class="v23-detail-hero__media" title="İlaç görseli">
                        ${detailImageUrl ? `<img src="${esc(detailImageUrl)}" alt="${esc(selected.ad || 'İlaç')}" onerror="this.style.display='none'; if(this.nextElementSibling){ this.nextElementSibling.style.display='flex'; }" />` : ''}
                        <div class="v23-detail-hero__media-fallback" ${detailImageUrl ? 'style="display:none;"' : 'style="display:flex;"'}>
                          <span class="material-symbols-outlined" style="font-size:40px;">medication</span>
                        </div>
                      </div>
                      ${barcode ? `<div class="v23-detail-hero__barcode" title="Barkod">Barkod: ${esc(barcode)}</div>` : ''}
                      ${displayMf ? `<div class="v23-detail-hero__mf-under" title="Mal fazlası">MF: ${esc(displayMf)}</div>` : ''}
                    </div>
                    <div class="v23-detail-hero__chips">
                      ${selected.psfFiyatNum ? `<span class="badge badge-outline">PSF: ${formatCurrency(selected.psfFiyatNum)}</span>` : ''}
                    </div>
                  </div>
                  <div class="v23-detail-hero__ops">${renderOperationStateBadges(detailOperationState)}</div>
                </div>
                <div class="v23-detail-hero__kpi" role="group" aria-label="Seçili teklif özeti">
                  <div class="v23-detail-hero__kpi-cell">
                    <div class="v23-detail-hero__kpi-label">Depo</div>
                    <div class="v23-detail-hero__kpi-value">${esc(selected.depot || '—')}</div>
                  </div>
                  <div class="v23-detail-hero__kpi-cell">
                    <div class="v23-detail-hero__kpi-label">Liste / net</div>
                    <div class="v23-detail-hero__kpi-value">${formatCurrency(selected.fiyatNum || 0)}</div>
                  </div>
                </div>
                <aside class="v23-detail-hero__commerce" aria-label="Maliyet ve adet">
                  <div class="v23-detail-hero__price-stack${showEnUygunCostLabel ? '' : ' v23-detail-hero__price-stack--plain'}">
                    ${showEnUygunCostLabel ? '<div class="v23-detail-hero__price-label">En uygun maliyet</div>' : ''}
                    <div class="v23-detail-hero__price-value">${formatCurrency(planning?.effectiveUnit || selected.fiyatNum || 0)}</div>
                  </div>
                  <div class="v23-detail-hero__divider"></div>
                  <div class="v23-detail-hero__qty-row">
                    <span class="v23-detail-hero__qty-label">Adet</span>
                    <div class="v23-detail-hero__qty-control">
                      <button type="button" class="v23-detail-hero__qty-btn" onclick="changeDesiredQty(-1)" aria-label="Azalt"><span class="material-symbols-outlined" style="font-size:18px;">remove</span></button>
                      <span class="v23-detail-hero__qty-value">${desiredQty}</span>
                      <button type="button" class="v23-detail-hero__qty-btn" onclick="changeDesiredQty(1)" aria-label="Arttır"><span class="material-symbols-outlined" style="font-size:18px;">add</span></button>
                    </div>
                  </div>
                  <div class="v23-detail-hero__meta">
                    <span class="badge badge-outline">Hedef: ${desiredQty} adet</span>
                  </div>
                  ${hasMfOptions ? `
                    <button type="button" class="btn btn-brand" style="font-size:12px; padding:8px 12px;" onclick="toggleMfCalculator()">
                      <span class="material-symbols-outlined" style="font-size:16px;">insights</span>
                      ${ctx?.mfCalculatorOpen ? 'MF hesaplayıcıyı gizle' : 'MF hesapla'}
                    </button>
                  ` : ''}
                </aside>
              </div>
            </section>
            ${hasMfOptions ? `
            <div class="mf-calc" data-open="${ctx?.mfCalculatorOpen ? 'true' : 'false'}">
            <div class="mf-calculator">
              <div class="mf-calc-header">
                  <div class="mf-calc-title"><span class="material-symbols-outlined" style="font-size:18px;">insights</span> Akıllı MF Hesaplayıcı</div>
                  <div class="text-sm text-muted">Seçili depo: ${esc(selected.depot)}</div>
              </div>
              <div class="text-sm text-muted mb-2" style="font-weight:700;">Hedef adet</div>
              <div class="mf-input-group">
                <button class="mf-qty-btn" onclick="changeDesiredQty(-1)"><span class="material-symbols-outlined" style="font-size:18px;">remove</span></button>
                <div class="mf-input-wrapper"><input id="desiredQtyInput" class="mf-main-input" type="number" min="1" value="${desiredQty}" /></div>
                <button class="mf-qty-btn" onclick="changeDesiredQty(1)"><span class="material-symbols-outlined" style="font-size:18px;">add</span></button>
              </div>
                <div class="mf-shortcuts">
                  <div class="mf-chips">
                    ${mfChipModel.rows.map((s) => {
                      const chipQty = Number(s.qty);
                      const isActive = chipQty === Number(desiredQty);
                      const isBest = mfChipModel.bestQty != null && chipQty === Number(mfChipModel.bestQty);
                      const mfStr = s.mf ? `${s.mf.buy}+${s.mf.free}` : '';
                      const buyShown = s.buy != null && s.mf ? Number(s.buy) : (s.mf ? s.mf.buy : '');
                      const subLine = s.mf && buyShown !== ''
                        ? `<span class="mf-chip-label">${esc(String(buyShown))} al → ${esc(String(chipQty))}</span>`
                        : '';
                      const titleAttr = mfStr ? ` title="${esc(mfStr)} · ${esc(String(chipQty))} adet"` : '';
                      const bestMark = isBest ? '<span class="mf-chip-best"> en uygun</span>' : '';
                      return `<button type="button"${titleAttr} class="mf-chip ${isActive ? 'active' : ''}" onclick="setDesiredQty(${chipQty})"><span class="mf-chip-val">${esc(String(chipQty))}</span>${subLine}${bestMark}</button>`;
                    }).join('')}
                  </div>
                  ${selectedMfStr ? `<div class="mf-campaign-row"><div class="mf-chip mf-campaign"><span class="mf-chip-val">${esc(selectedMfStr)}</span><span class="mf-chip-sub"> ${esc(depotCampaignLabel)}</span></div></div>` : ''}
                </div>
                <div class="mt-4" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
                  <div class="info-card info-card-order"><div class="info-card-lbl">Sipariş</div><div class="info-card-val">${planning?.orderQty || 0}</div></div>
                  <div class="info-card info-card-receive"><div class="info-card-lbl">Teslim</div><div class="info-card-val">${planning?.receiveQty || 0}</div></div>
                  <div class="info-card info-card-total"><div class="info-card-lbl">Toplam</div><div class="info-card-val">${formatCurrency(planning?.totalCost || 0)}</div></div>
                  <div class="info-card info-card-effective"><div class="info-card-lbl">Birim</div><div class="info-card-val">${formatCurrency(planning?.effectiveUnit || 0)}</div></div>
                </div>
              <div class="mt-4 text-sm text-muted">
                ${selectedMf ? (desiredQty >= selectedMf.buy
                    ? `${esc(depotCampaignLabel)}: ${esc(selectedMfStr)} uygulandı. ${selectedMf.buy} sipariş verilir, ${selectedMf.total} teslim edilir.`
                    : `MF bilgisi: ${esc(selectedMfStr)}. Bu kampanya ${selectedMf.buy} siparişte devreye girer ve ${selectedMf.total} teslim sağlar.`) : 'Bu depoda otomatik MF kampanyası bulunmuyor.'}
              </div>
            </div>
            </div>
            ` : ''}
            <div class="decision-table-wrapper">
              <table class="decision-table">
                <thead>
                  <tr>
                    <th>Depo</th>
                    <th>MF</th>
                    <th>Maliyet</th>
                      <th class="align-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((item) => {
                    const key = getOfferKey(item);
                    const isSelected = key === selectedOfferKey;
                    const calc = calculatePlanning(item, desiredQty);
                    const rowInPlan = Boolean(itemPlanAddedByOfferKey && itemPlanAddedByOfferKey[key]);
                    return `
                      <tr class="${isSelected ? 'row-best' : ''}">
                        <td>
                          <div class="flex gap-2" style="align-items:center;flex-wrap:wrap;">
                            ${depotBadgeHtml(item.depotId, item.depot)}
                            ${rowInPlan ? '<span class="badge badge-outline" style="border-color:rgba(16,185,129,0.35);color:var(--mint-600);background:rgba(16,185,129,0.08);font-size:11px;">Planda</span>' : ''}
                          </div>
                        </td>
                        <td>${(item.mfStr || item.malFazlasi || item.MalFazlasi) ? `<span class="badge badge-outline">${esc(item.mfStr || item.malFazlasi || item.MalFazlasi)}</span>` : '-'}</td>
                          <td>
                            <div class="font-mono font-weight-700 detail-cost-value">${formatCurrency(calc.effectiveUnit || item.fiyatNum || 0)}</div>
                            <div class="text-sm text-muted">${calc.planningMode === 'mf' ? 'MF efektif maliyet' : 'Net birim maliyet'}</div>
                          </td>
                        <td>
                            <div class="flex gap-2" style="justify-content:flex-end;flex-wrap:wrap;">
                              <button class="btn ${isSelected ? 'btn-brand' : 'btn-outline'}" style="font-size:12px; padding:6px 12px;" onclick="selectOffer('${escJs(key)}')">${isSelected ? 'Seçili' : 'Bu Depoyu Seç'}</button>
                              <button class="btn ${rowInPlan ? 'btn-outline' : 'btn-brand'}" style="${rowInPlan ? 'font-size:12px; padding:6px 10px; border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);' : 'font-size:12px; padding:6px 10px;'}" onclick="addOfferToPlan('${escJs(key)}')">${rowInPlan ? 'Bu depoda planda' : 'Plana Ekle'}</button>
                              ${isSelected ? `<button class="btn btn-outline" style="font-size:12px; padding:6px 10px;" onclick="openOfferInDepot('${escJs(key)}')">Web'de Aç</button>` : ''}
                            </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  globalScope.V23DetailUI = {
    renderDetailPage,
  };
})(typeof window !== 'undefined' ? window : null);

