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
  /**
   * Her deponun MF string'ini benzersiz buton olarak toplar.
   * Tıklanınca mf.buy (siparis adedi) set edilir, total degil.
   * bestMfStr: en dusuk effectiveUnit veren MF.
   */
  function buildMfQtyChips(items, selected, desiredQty, deps) {
    const { parseMf, calculatePlanning } = deps || {};
    if (typeof parseMf !== 'function' || typeof calculatePlanning !== 'function') {
      return { rows: [], bestMfStr: null };
    }

    const seen = new Set();
    const rows = [];
    (items || []).forEach((item) => {
      const rawMfStr = String(item?.malFazlasi || item?.mfStr || '').trim();
      if (!rawMfStr || seen.has(rawMfStr)) return;
      const mf = parseMf(rawMfStr);
      if (!mf || mf.buy <= 0) return;
      seen.add(rawMfStr);
      rows.push({ mfStr: rawMfStr, mf, depotId: item.depotId, depot: item.depot });
    });

    if (rows.length === 0) return { rows: [], bestMfStr: null };

    // En iyi birim fiyat veren MF'i bul
    let bestMfStr = null;
    let bestEff = Infinity;
    rows.forEach((r) => {
      (items || []).forEach((item) => {
        const plan = calculatePlanning(item, r.mf.buy);
        const eff = Number(plan?.effectiveUnit);
        if (Number.isFinite(eff) && eff < bestEff) {
          bestEff = eff;
          bestMfStr = r.mfStr;
        }
      });
    });

    return { rows, bestMfStr };
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
      : { rows: [], bestMfStr: null };
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
                    <span id="v23-sidebar-unit" class="v23-offer-sheet__value">${formatCurrency(planning?.effectiveUnit || selected.fiyatNum || 0)}</span>
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
              <button id="v23-plan-add-btn" type="button" class="btn ${detailPlanAdded ? 'btn-outline' : 'btn-brand'} v23-detail-sidebar__btn-main" style="${detailPlanAdded ? 'border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);' : ''}" onclick="addSelectedOfferToPlan()">${detailPlanAdded ? 'Bu depoda planda' : `Plana ekle · ${formatCurrency(planning?.totalCost || 0)}`}</button>
              ${detailPlanAdded ? `<button type="button" class="btn ${detailOperationState?.isApproved ? 'btn-outline' : 'btn-brand'} v23-detail-sidebar__btn-sec" style="${detailOperationState?.isApproved ? 'border-color:rgba(245,158,11,0.35); color:#a16207; background:rgba(245,158,11,0.12);' : ''}" onclick="${detailOperationState?.isApproved ? 'removeSelectedOfferApproval()' : 'approveSelectedOfferFromDetail()'}">${detailOperationState?.isApproved ? 'Onayı kaldır' : 'Onaya gönder'}</button>` : ''}
              ${detailPlanAdded ? `<button type="button" class="btn btn-outline v23-detail-sidebar__btn-sec" style="border-color:rgba(239,68,68,0.3); color:#b91c1c;" onclick="removeSelectedOfferFromPlan()">Plandan sil</button>` : ''}
              <button type="button" class="btn btn-outline v23-detail-sidebar__btn-sec" onclick="openSelectedOfferInDepot()">Web'de aç</button>
              ${detailPlanCrossDepotHint ? `<p class="v23-detail-sidebar__hint text-sm text-muted" style="margin:10px 0 0;line-height:1.35;">${esc(detailPlanCrossDepotHint)}</p>` : ''}
            </div>
          </div>
          <div class="v23-detail-sidebar__section v23-detail-sidebar__section--plan">
            <div class="v23-offer-lux-card v23-offer-lux-card--plan">
              <div class="v23-offer-lux-card__accent v23-offer-lux-card__accent--plan" aria-hidden="true"></div>
              <div class="v23-offer-lux-card__body">
                <div class="v23-plan-section-head">
                  <span class="v23-detail-sidebar__eyebrow" style="margin-bottom:0;"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;">shopping_cart</span>Sipariş planı</span>
                  ${plan.length ? `<span class="v23-plan-section-badge">${plan.length} kalem</span>` : ''}
                </div>
                <div class="v23-plan-rows">
                  ${plan.length ? (() => {
                    // Duplicate ilaçları birleştir
                    const mergedMap = new Map();
                    plan.forEach((item) => {
                      const rawBc = String(item.barkod || item.barcode || '').trim();
                      const keyBc = String(item.key || '').startsWith('BARCODE_') ? String(item.key).replace('BARCODE_', '') : '';
                      const groupId = rawBc || keyBc || item.name || item.ad || item.key;

                      if (mergedMap.has(groupId)) {
                        const existing = mergedMap.get(groupId);
                        existing.depotCount += 1;
                        existing.totalCost += (Number(item.totalCost) || 0);
                        existing.totalQty += Math.max(parseInt(item.desiredQty, 10) || 1, 1);
                        existing.depots.push(item.depot || '');
                      } else {
                        mergedMap.set(groupId, {
                          name: formatPlanLineTitle(item.name || item.key),
                          depot: item.depot || '',
                          depotCount: 1,
                          totalCost: Number(item.totalCost) || 0,
                          totalQty: Math.max(parseInt(item.desiredQty, 10) || 1, 1),
                          depots: [item.depot || ''],
                        });
                      }
                    });
                    return Array.from(mergedMap.values()).slice(0, 8).map((merged, idx) => {
                      const metaText = merged.depotCount > 1
                        ? `${merged.depotCount} depoda · ${merged.totalQty} adet`
                        : `${esc(merged.depot)} · ${merged.totalQty} adet`;
                      return `
                      <div class="v23-plan-row">
                        <span class="v23-plan-row__num">${idx + 1}</span>
                        <div class="v23-plan-row__info">
                          <span class="v23-plan-row__name">${esc(merged.name)}</span>
                          <span class="v23-plan-row__meta">${metaText}</span>
                        </div>
                        <span class="v23-plan-row__price">${formatCurrency(merged.totalCost)}</span>
                      </div>`;
                    }).join('');
                  })() : '<div class="v23-plan-rows__empty"><span class="material-symbols-outlined" style="font-size:20px;opacity:.4;">inbox</span><span>Plan boş</span></div>'}
                </div>
                <div class="v23-plan-section-foot">
                  <div class="v23-plan-total-row">
                    <span class="v23-plan-total-label">Toplam</span>
                    <span class="v23-plan-total-value">${formatCurrency(planMetrics.totalCost)}</span>
                  </div>
                  <button type="button" class="v23-plan-goto-btn" onclick="typeof toggleDetailPlanSummarySize === 'function' ? toggleDetailPlanSummarySize() : switchMock('plan')">
                    <span class="material-symbols-outlined" style="font-size:16px;">edit_note</span>
                    Planı görüntüle
                  </button>
                </div>
              </div>
            </div>
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
                <div class="v23-kpi-lux-card" role="group" aria-label="Teklif özeti">
                  <div class="v23-detail-hero__kpi-cell">
                    <div class="v23-detail-hero__kpi-label">En uygun depo</div>
                    <div class="v23-detail-hero__kpi-value">${esc(items[0]?.depot || '—')}</div>
                  </div>
                  <div class="v23-detail-hero__kpi-cell">
                    <div class="v23-detail-hero__kpi-label">En uygun fiyat</div>
                    <div class="v23-detail-hero__kpi-value">${formatCurrency(items[0]?.fiyatNum || 0)}</div>
                  </div>
                </div>
                <aside class="v23-detail-hero__commerce" aria-label="Maliyet ve adet">
                  <div id="v23-price-stack" class="v23-detail-hero__price-stack">
                    <div class="v23-detail-hero__price-label">${esc(selected.depot || '—')}</div>
                    <div id="v23-price-value" class="v23-detail-hero__price-value">${formatCurrency(planning?.effectiveUnit || selected.fiyatNum || 0)}</div>
                  </div>
                  <div class="v23-detail-hero__divider"></div>
                  <div class="v23-detail-hero__qty-row">
                    <span class="v23-detail-hero__qty-label">Adet</span>
                    <div class="v23-detail-hero__qty-control">
                      <button type="button" class="v23-detail-hero__qty-btn" onclick="changeDesiredQty(-1)" aria-label="Azalt"><span class="material-symbols-outlined" style="font-size:18px;">remove</span></button>
                      <span id="v23-qty-display" class="v23-detail-hero__qty-value">${desiredQty}</span>
                      <button type="button" class="v23-detail-hero__qty-btn" onclick="changeDesiredQty(1)" aria-label="Arttır"><span class="material-symbols-outlined" style="font-size:18px;">add</span></button>
                    </div>
                  </div>
                  <div class="v23-detail-hero__meta">
                    <span id="v23-qty-badge" class="badge badge-outline">Hedef: ${desiredQty} adet</span>
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
                    ${mfChipModel.rows.map((r) => {
                      const buyQty = r.mf.buy;
                      const isActive = buyQty === Number(desiredQty);
                      const isBest = mfChipModel.bestMfStr != null && r.mfStr === mfChipModel.bestMfStr;
                      const titleAttr = ` title="${esc(r.mfStr)} · ${buyQty} sipariş ver, ${r.mf.total} gel${r.depot ? ' · ' + esc(r.depot) : ''}"`;
                      const bestMark = isBest ? '<span class="mf-chip-best">★</span>' : '';
                      return `<button type="button"${titleAttr} data-chip-qty="${buyQty}" class="mf-chip ${isActive ? 'active' : ''} ${isBest ? 'is-best' : ''}" onclick="setDesiredQty(${buyQty})"><span class="mf-chip-val">${esc(r.mfStr)}</span>${bestMark}</button>`;
                    }).join('')}
                  </div>
                </div>
                <div class="mt-4" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
                  <div class="info-card info-card-order"><div class="info-card-lbl">Sipariş</div><div id="v23-ic-order" class="info-card-val">${planning?.orderQty || 0}</div></div>
                  <div class="info-card info-card-receive"><div class="info-card-lbl">Teslim</div><div id="v23-ic-receive" class="info-card-val">${planning?.receiveQty || 0}</div></div>
                  <div class="info-card info-card-total"><div class="info-card-lbl">Toplam</div><div id="v23-ic-total" class="info-card-val">${formatCurrency(planning?.totalCost || 0)}</div></div>
                  <div class="info-card info-card-effective"><div class="info-card-lbl">Birim</div><div id="v23-ic-effective" class="info-card-val">${formatCurrency(planning?.effectiveUnit || 0)}</div></div>
                </div>
              <div id="v23-mf-desc" class="mt-4 text-sm text-muted">
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
                  ${(() => {
                    // Seçili depoyu en üste koy, kalanları fiyata göre sırala
                    const sortedItems = items.slice().sort((a, b) => {
                      const aKey = getOfferKey(a);
                      const bKey = getOfferKey(b);
                      const aSelected = aKey === selectedOfferKey ? 1 : 0;
                      const bSelected = bKey === selectedOfferKey ? 1 : 0;
                      if (aSelected !== bSelected) return bSelected - aSelected;
                      return 0; // orijinal sırayı koru
                    });
                    return sortedItems.map((item) => {
                    const key = getOfferKey(item);
                    const isSelected = key === selectedOfferKey;
                    const calc = calculatePlanning(item, desiredQty);
                    const rowInPlan = Boolean(itemPlanAddedByOfferKey && itemPlanAddedByOfferKey[key]);
                    const itemMfStr = item.mfStr || item.malFazlasi || item.MalFazlasi || '';
                    // Onayda durumunu kontrol et
                    const itemApprovalStatus = String(item.approvalStatus || '').trim();
                    const isItemApproved = itemApprovalStatus === 'approved';
                    return `
                      <tr data-offer-key="${esc(key)}" class="${isSelected ? 'row-best' : ''}" style="${isSelected ? 'animation: slideToTop 220ms var(--ease-standard, ease-out);' : ''}">
                        <td>
                          <div class="flex gap-2" style="align-items:center;flex-wrap:wrap;">
                            ${depotBadgeHtml(item.depotId, item.depot)}
                            ${rowInPlan ? '<span class="badge badge-outline" style="border-color:rgba(16,185,129,0.35);color:var(--mint-600);background:rgba(16,185,129,0.08);font-size:11px;">Planda</span>' : ''}
                            ${isItemApproved ? '<span class="badge badge-outline" style="border-color:rgba(245,158,11,0.35);color:#a16207;background:rgba(245,158,11,0.08);font-size:11px;">Onayda</span>' : ''}
                          </div>
                        </td>
                        <td>${itemMfStr ? `<span class="badge badge-outline">${esc(itemMfStr)}</span>` : '<span class="text-muted" style="font-size:12px;">—</span>'}</td>
                          <td>
                            <div class="font-mono font-weight-700 detail-cost-value">${formatCurrency(calc.effectiveUnit || item.fiyatNum || 0)}</div>
                            <div class="text-sm text-muted detail-cost-hint">${calc.planningMode === 'mf' ? 'MF efektif maliyet' : 'Net birim maliyet'}</div>
                          </td>
                        <td>
                            <div class="flex gap-2" style="justify-content:flex-end;flex-wrap:wrap;">
                              <button class="btn ${isSelected ? 'btn-brand' : 'btn-outline'}" style="font-size:12px; padding:6px 12px;" onclick="selectOffer('${escJs(key)}')">${isSelected ? 'Seçili' : 'Seç'}</button>
                              <button class="btn ${rowInPlan ? 'btn-outline' : 'btn-brand'}" style="${rowInPlan ? 'font-size:12px; padding:6px 10px; border-color:rgba(16,185,129,0.35); color:var(--mint-600); background:rgba(16,185,129,0.08);' : 'font-size:12px; padding:6px 10px;'}" onclick="addOfferToPlan('${escJs(key)}')">${rowInPlan ? 'Planda' : 'Plana Ekle'}</button>
                              ${isSelected ? `<button class="btn btn-outline" style="font-size:12px; padding:6px 10px;" onclick="openOfferInDepot('${escJs(key)}')">Web'de Aç</button>` : ''}
                            </div>
                        </td>
                      </tr>
                    `;
                  }).join('');
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Qty degistiginde tam re-render yapmadan sadece adet-bagimlı DOM'u gunceller.
   * Fokus/scroll kaybi olmaz.
   */
  function patchDetailQty(page, ctx, deps) {
    if (!page) return;
    const {
      desiredQty = 1,
      selected = null,
      planning = null,
      selectedMf = null,
      selectedMfStr = '',
      depotCampaignLabel = 'Depo kampanya',
      items = [],
    } = ctx || {};
    const { formatCurrency, calculatePlanning, getOfferKey } = deps || {};
    if (typeof formatCurrency !== 'function' || typeof calculatePlanning !== 'function') return;

    const setText = (id, text) => { const el = page.querySelector(id); if (el) el.textContent = text; };

    setText('#v23-qty-display', desiredQty);
    setText('#v23-qty-badge', `Hedef: ${desiredQty} adet`);
    setText('#v23-price-value', formatCurrency(planning?.effectiveUnit || selected?.fiyatNum || 0));
    setText('#v23-sidebar-unit', formatCurrency(planning?.effectiveUnit || selected?.fiyatNum || 0));
    setText('#v23-ic-order', planning?.orderQty || 0);
    setText('#v23-ic-receive', planning?.receiveQty || 0);
    setText('#v23-ic-total', formatCurrency(planning?.totalCost || 0));
    setText('#v23-ic-effective', formatCurrency(planning?.effectiveUnit || 0));

    const planBtn = page.querySelector('#v23-plan-add-btn');
    if (planBtn && !planBtn.classList.contains('btn-outline')) {
      planBtn.textContent = `Plana ekle · ${formatCurrency(planning?.totalCost || 0)}`;
    }

    const qtyInput = page.querySelector('#desiredQtyInput');
    if (qtyInput && document.activeElement !== qtyInput) qtyInput.value = desiredQty;

    const mfDesc = page.querySelector('#v23-mf-desc');
    if (mfDesc) {
      mfDesc.textContent = selectedMf
        ? (desiredQty >= selectedMf.buy
            ? `${depotCampaignLabel}: ${selectedMfStr} uygulandı. ${selectedMf.buy} sipariş verilir, ${selectedMf.total} teslim edilir.`
            : `MF bilgisi: ${selectedMfStr}. Bu kampanya ${selectedMf.buy} siparişte devreye girer ve ${selectedMf.total} teslim sağlar.`)
        : 'Bu depoda otomatik MF kampanyası bulunmuyor.';
    }

    page.querySelectorAll('[data-chip-qty]').forEach((chip) => {
      const chipQty = Number(chip.getAttribute('data-chip-qty'));
      chip.classList.toggle('active', chipQty === Number(desiredQty));
    });

    if (typeof getOfferKey === 'function') {
      page.querySelectorAll('tr[data-offer-key]').forEach((tr) => {
        const key = tr.getAttribute('data-offer-key');
        const item = (items || []).find((i) => getOfferKey(i) === key);
        if (!item) return;
        const calc = calculatePlanning(item, desiredQty);
        const costEl = tr.querySelector('.detail-cost-value');
        if (costEl) costEl.textContent = formatCurrency(calc.effectiveUnit || item.fiyatNum || 0);
        const hintEl = tr.querySelector('.detail-cost-hint');
        if (hintEl) hintEl.textContent = calc.planningMode === 'mf' ? 'MF efektif maliyet' : 'Net birim maliyet';
      });
    }
  }

  /**
   * Live backend quote gelince statik fiyatlarin uzerine yazar.
   * quotedOptions: resolveQuotedOptions'tan gelen dizi.
   */
  function patchDetailQtyLive(page, ctx, deps) {
    if (!page) return;
    const {
      desiredQty = 1,
      selected = null,
      quotedOptions = [],
      selectedQuoted = null,
      depotCampaignLabel = 'Depo kampanya',
      selectedMf = null,
      selectedMfStr = '',
      items = [],
    } = ctx || {};
    const { formatCurrency, getOfferKey } = deps || {};
    if (typeof formatCurrency !== 'function') return;

    const setText = (id, text) => { const el = page.querySelector(id); if (el) el.textContent = text; };

    // Seçili deponun live quote'u ile ana fiyat hücrelerini guncelle
    if (selectedQuoted) {
      setText('#v23-price-value', formatCurrency(selectedQuoted.effectiveUnit || 0));
      setText('#v23-sidebar-unit', formatCurrency(selectedQuoted.effectiveUnit || 0));
      setText('#v23-ic-order', selectedQuoted.orderQty || desiredQty);
      setText('#v23-ic-receive', selectedQuoted.receiveQty || desiredQty);
      setText('#v23-ic-total', formatCurrency(selectedQuoted.totalCost || 0));
      setText('#v23-ic-effective', formatCurrency(selectedQuoted.effectiveUnit || 0));

      const planBtn = page.querySelector('#v23-plan-add-btn');
      if (planBtn && !planBtn.classList.contains('btn-outline')) {
        planBtn.textContent = `Plana ekle · ${formatCurrency(selectedQuoted.totalCost || 0)}`;
      }

      const mfDesc = page.querySelector('#v23-mf-desc');
      if (mfDesc && selectedMf) {
        const appliedMf = selectedQuoted.mf || (selectedQuoted.receiveQty > selectedQuoted.orderQty);
        mfDesc.textContent = appliedMf
          ? `${depotCampaignLabel}: ${selectedMfStr} uygulandı. ${selectedQuoted.orderQty} sipariş, ${selectedQuoted.receiveQty} teslim (canlı fiyat).`
          : `MF bilgisi: ${selectedMfStr}. Bu kampanya ${selectedMf.buy} siparişte devreye girer.`;
      }
    }

    // Her tablo satırı için live quote fiyatı yaz
    if (typeof getOfferKey === 'function') {
      page.querySelectorAll('tr[data-offer-key]').forEach((tr) => {
        const key = tr.getAttribute('data-offer-key');
        const item = (items || []).find((i) => getOfferKey(i) === key);
        if (!item) return;
        const quoted = quotedOptions.find((o) => {
          const di = String(o.depotId || '').trim();
          const si = String(item?.depotId || '').trim();
          return di && si && di === si;
        });
        if (!quoted) return;
        const costEl = tr.querySelector('.detail-cost-value');
        if (costEl) costEl.textContent = formatCurrency(quoted.effectiveUnit || item.fiyatNum || 0);
        const hintEl = tr.querySelector('.detail-cost-hint');
        if (hintEl) hintEl.textContent = quoted.mf ? 'MF efektif maliyet (canlı)' : 'Net birim maliyet (canlı)';
      });
    }
  }

  globalScope.V23DetailUI = {
    renderDetailPage,
    patchDetailQty,
    patchDetailQtyLive,
  };
})(typeof window !== 'undefined' ? window : null);

