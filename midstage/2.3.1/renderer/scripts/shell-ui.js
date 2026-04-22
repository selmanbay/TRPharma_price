/**
 * shell-ui.js
 * Login, home, and settings page HTML owners for V2.3 runtime.
 */
(function initV23ShellUI(globalScope) {
  if (!globalScope) return;

  function renderLoginPage(ctx, deps) {
    const { authMode = 'login', user = null } = ctx || {};
    const { esc } = deps || {};
    if (typeof esc !== 'function') return '';

    const submitLabel = authMode === 'setup' ? 'Kurulumu Tamamla' : 'Giris Yap';
    const title = authMode === 'setup' ? 'Ilk Kurulum' : 'Hos Geldiniz';
    const subtitle = authMode === 'setup'
      ? 'Eczanenizin adini belirleyin, sifrenizi olusturun ve tum depolari tek merkezden yonetin.'
      : 'Siparis plani, toplu arama ve akilli depo karsilastirmasi icin hesabiniza giris yapin.';

    return `
      <div class="auth-overlay auth-overlay--modern">
        <section class="auth-left auth-left--modern">
          <div class="auth-atmosphere">
            <span class="auth-orb auth-orb--one"></span>
            <span class="auth-orb auth-orb--two"></span>
            <span class="auth-grid"></span>
          </div>

          <div class="auth-showcase" aria-hidden="true">
            <div class="auth-illustration-cycle auth-illustration-cycle--stacked">
              <div class="auth-feature-card auth-feature-card--search">
                <div class="auth-feature-card__top">
                  <div class="auth-feature-card__icon">
                    <span class="material-symbols-outlined">search</span>
                  </div>
                  <div class="auth-feature-card__meta">
                    <strong>Aninda Ilac Arama</strong>
                    <small>6 depoyu ayni anda tara</small>
                  </div>
                </div>
                <div class="auth-feature-card__visual auth-feature-card__visual--bars">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div class="auth-feature-card auth-feature-card--price">
                <div class="auth-feature-card__top">
                  <div class="auth-feature-card__icon">
                    <span class="material-symbols-outlined">query_stats</span>
                  </div>
                  <div class="auth-feature-card__meta">
                    <strong>En Uygun Fiyat</strong>
                    <small>Mal fazlasi ve efektif maliyet beraber gorunur</small>
                  </div>
                </div>
                <div class="auth-feature-card__visual auth-feature-card__visual--chart">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div class="auth-feature-card auth-feature-card--bulk">
                <div class="auth-feature-card__top">
                  <div class="auth-feature-card__icon">
                    <span class="material-symbols-outlined">library_add_check</span>
                  </div>
                  <div class="auth-feature-card__meta">
                    <strong>Toplu Arama</strong>
                    <small>Listeyi yapistir, secimi daha hizli tamamla</small>
                  </div>
                </div>
                <div class="auth-feature-card__visual auth-feature-card__visual--grid">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="auth-right auth-right--modern">
          <div class="auth-panel-shell">
            <div class="auth-panel-glow"></div>

            <div class="auth-form-box auth-form-box--modern">
              <div class="auth-form-head">
                <div class="auth-form-chip">${authMode === 'setup' ? 'Setup' : 'Login'}</div>
                <h2>${title}</h2>
                <p class="auth-subtitle">${esc(subtitle)}</p>
              </div>

              ${authMode === 'setup' ? `
                <div class="auth-field">
                  <label>Eczane Adi</label>
                  <div class="auth-input-wrap">
                    <span class="material-symbols-outlined">storefront</span>
                    <input id="setupDisplayNameInput" type="text" placeholder="Eczane adinizi girin">
                  </div>
                </div>
              ` : ''}

              <div class="auth-field">
                <label>Kullanici</label>
                <div class="auth-input-wrap auth-input-wrap--readonly">
                  <span class="material-symbols-outlined">badge</span>
                  <input id="loginReadonlyUser" type="text" value="${esc(user?.displayName || 'eczane-app')}" readonly>
                </div>
              </div>

              <div class="auth-field">
                <label>Sifre</label>
                <div class="auth-input-wrap">
                  <span class="material-symbols-outlined">lock</span>
                  <input id="loginPasswordInput" type="password" placeholder="Sifrenizi girin" autofocus>
                </div>
              </div>

              ${authMode === 'setup' ? `
                <div class="auth-field">
                  <label>Sifre Tekrar</label>
                  <div class="auth-input-wrap">
                    <span class="material-symbols-outlined">verified_user</span>
                    <input id="setupPasswordRepeatInput" type="password" placeholder="Sifreyi tekrar girin">
                  </div>
                </div>
              ` : ''}

              <div id="loginErrorMessage" class="auth-error"></div>

              <button id="loginSubmitButton" class="auth-btn auth-btn--modern">
                <span class="material-symbols-outlined" style="font-size:18px;">north_east</span>
                ${submitLabel}
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderHomePage(ctx, deps) {
    const {
      user = null,
      history = [],
      plan = [],
      metrics = { depotCount: 0, totalCost: 0 },
      healthPct = 0,
      historyItems = [],
    } = ctx || {};
    const {
      esc,
      escJs,
      formatCurrency,
      actionLink,
      depotBadgeHtml,
      formatPlanAltDepots,
      renderEmptyState,
      formatHistory,
    } = deps || {};
    if (
      typeof esc !== 'function'
      || typeof escJs !== 'function'
      || typeof formatCurrency !== 'function'
      || typeof actionLink !== 'function'
      || typeof depotBadgeHtml !== 'function'
      || typeof formatPlanAltDepots !== 'function'
      || typeof renderEmptyState !== 'function'
      || typeof formatHistory !== 'function'
    ) return '';

    return `
      <div class="home-wrapper">
        <div class="dashboard-header dashboard-header-surface">
          <div>
            <h1 style="font-size: 28px; margin-bottom: 8px;">Günaydın, ${esc(user?.displayName || 'Eczane')}</h1>
            <p style="font-size: 16px; color: var(--ink-500);">Bugün ${history.length} geçmiş kaydı, aktif planda ${plan.length} ürün var.</p>
          </div>
          <div class="metric-group">
            <div class="metric-card success">
              <div class="metric-val">${healthPct}<span style="font-size: 18px; color: var(--mint-500);">%</span></div>
              <div class="metric-lbl">Depo Sağlığı</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${plan.length}</div>
              <div class="metric-lbl">Plandaki İlaç</div>
            </div>
          </div>
        </div>
        <div class="operations-banner mb-6" onclick="switchMock('bulk')">
          <div class="flex items-center gap-5">
            <div class="operations-banner-icon">
              <span class="material-symbols-outlined" style="font-size: 22px;">document_scanner</span>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.75;">Toplu Operasyon</div>
              <h2 style="font-size: 28px; color: white; margin: 6px 0;">Toplu aramayı çalıştır</h2>
              <p style="color: rgba(255,255,255,0.75);">Liste yapıştır, en uygun depoları seç ve planı tek ekranda optimize et.</p>
            </div>
          </div>
          <button class="btn btn-primary operations-banner-cta">Toplu Aramaya Git</button>
        </div>
        <div class="dashboard-grid">
          <section class="card" style="padding: 24px; cursor:pointer;" onclick="openPlanPreview()">
            <div class="flex justify-between items-center mb-4">
              <div>
                <div style="font-size: 12px; font-weight: 700; color: var(--ink-500); text-transform: uppercase;">Plan Önizlemesi</div>
                <h3 style="font-size: 22px;">Aktif Sipariş Planı</h3>
              </div>
              ${actionLink('Planı Aç', "event.stopPropagation(); openPlanPreview()")}
            </div>
            ${plan.length ? `
              <div style="display:flex; flex-direction:column; gap:12px;">
                ${(() => {
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
                      existing.keys.push(item.key);
                    } else {
                      mergedMap.set(groupId, {
                        name: item.name || item.ad || item.key,
                        key: item.key,
                        depotId: item.depotId,
                        depot: item.depot,
                        depotCount: 1,
                        totalCost: Number(item.totalCost) || 0,
                        totalQty: Math.max(parseInt(item.desiredQty, 10) || 1, 1),
                        keys: [item.key],
                        originalItem: item
                      });
                    }
                  });
                  return Array.from(mergedMap.values()).slice(0, 5).map((merged) => `
                  <button type="button" class="home-preview-row" onclick="event.stopPropagation(); openPlanPreview('${escJs(merged.key)}')">
                    <div class="flex justify-between items-center mb-2">
                      <strong>${esc(merged.name)}</strong>
                      <span class="font-mono">${formatCurrency(merged.totalCost || 0)}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm text-muted">
                      <span class="home-preview-depots">
                        ${merged.depotCount > 1 ? `<span class="badge badge-outline" style="border-color:rgba(15,23,42,0.1);color:var(--ink-600);background:rgba(15,23,42,0.04);font-size:11px;">${merged.depotCount} depoda</span>` : depotBadgeHtml(merged.depotId, merged.depot)}
                        ${merged.depotCount === 1 && formatPlanAltDepots(merged.originalItem) ? `<span class="home-preview-alt-depots">+ ${esc(formatPlanAltDepots(merged.originalItem))}</span>` : ''}
                      </span>
                      <span>${merged.totalQty} adet</span>
                    </div>
                  </button>
                `).join('');
                })()}
              </div>
            ` : `
              ${renderEmptyState({
                variant: 'plan',
                title: 'Planınız boş',
                body: 'Arama sonucundan ürün eklediğinde burada canlı özet görünür.',
                ctaLabel: 'Aramaya git',
                ctaAction: "switchMock('home')",
              })}
            `}
            <div class="flex justify-between items-center mt-4" style="padding-top: 12px; border-top:1px solid var(--ink-100);">
              <span class="text-sm text-muted">${metrics.depotCount} depoda dağılım</span>
              <strong>${formatCurrency(metrics.totalCost)}</strong>
            </div>
          </section>
          <section class="card" style="padding: 24px;">
            <div class="flex justify-between items-center mb-4">
              <div>
                <div style="font-size: 12px; font-weight: 700; color: var(--ink-500); text-transform: uppercase;">Son İşlemler</div>
                <h3 style="font-size: 22px;">Arama Geçmişi</h3>
              </div>
              ${actionLink('Ayarlar', "switchMock('settings')")}
            </div>
            ${historyItems.length ? historyItems.map((entry) => `
              <button class="history-row" onclick="openHistorySearch('${escJs(entry.ilac || '')}','${escJs(entry.barkod || '')}')" style="border:none;">
                <div class="flex justify-between items-start gap-3">
                  <div>
                    <strong style="display:block; margin-bottom:4px;">${esc(entry.ilac || 'Arama')}</strong>
                    <span class="text-sm text-muted">${esc(formatHistory(entry.tarih))}</span>
                  </div>
                  <span class="text-sm text-muted">${esc(entry.enUcuz?.depot || '-')}</span>
                </div>
              </button>
              `).join('') : renderEmptyState({ variant: 'history', title: 'Geçmiş kaydı yok', body: 'Arama yaptıkça en son işlemler burada görünecek.' })}
          </section>
        </div>
      </div>
    `;
  }

  function renderSettingsPage(ctx, deps) {
    const {
      depots = {},
      current = {},
      connectedCount = 0,
      appVersion = '',
      updateStatus = '',
    } = ctx || {};
    const {
      depotForms,
      depotBadgeHtml,
      esc,
      escJs,
    } = deps || {};
    if (
      !depotForms
      || typeof depotBadgeHtml !== 'function'
      || typeof esc !== 'function'
      || typeof escJs !== 'function'
    ) return '';

    return `
      <div class="home-wrapper">
        <div class="dashboard-header">
          <div>
            <h1 style="font-size:36px; margin-bottom:8px;">Depo Entegrasyonlari</h1>
            <p style="font-size:16px; color:var(--ink-500);">Baglanti durumlarini, credential alanlarini ve test login akislarini yonetin.</p>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 280px 1fr; gap:24px;">
          <aside class="card" style="padding:20px;">
            <div style="font-size:12px; font-weight:700; color:var(--ink-500); text-transform:uppercase; margin-bottom:16px;">Sekmeler</div>
            <div class="settings-tabs">
              <button class="btn btn-outline settings-tab is-active" onclick="scrollToTop()">Depo Baglantilari</button>
              <button class="btn btn-ghost settings-tab" onclick="toggleCompatPanel()">Uyumluluk Araclari</button>
            </div>
          </aside>
          <section style="display:flex; flex-direction:column; gap:16px;">
            ${connectedCount ? '' : `<div class="settings-warning">Henuz hic depo bagli degil. Aramaya baslamak icin en az bir depo ekleyin.</div>`}
            ${Object.keys(depots).map((depotId) => {
              const form = depotForms[depotId];
              const entry = current[depotId] || {};
              const connected = entry.hasCredentials || entry.hasCookies || entry.hasToken;
              return `
                <div class="card settings-card" data-state="${connected ? 'connected' : 'disconnected'}" style="padding:24px;">
                  <div class="flex justify-between items-center mb-4">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="settings-state-dot" aria-hidden="true"></span>
                        ${!connected ? `<span class="settings-state-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="24" height="24"><path d="M8 9L10 7C11.1 5.9 12.9 5.9 14 7L16 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 15L7 17C5.9 18.1 4.1 18.1 3 17C1.9 15.9 1.9 14.1 3 13L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 15L17 17C18.1 18.1 19.9 18.1 21 17C22.1 15.9 22.1 14.1 21 13L19 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>` : ''}
                        <div>${depotBadgeHtml(depotId, form?.title || depots[depotId]?.name || depotId)}</div>
                      </div>
                      <div class="text-sm text-muted" style="margin-top:8px;">${connected ? 'Bagli / kayitli' : 'Henuz bagli degil'}</div>
                    </div>
                    <span class="badge badge-outline" style="border-color:${connected ? 'rgba(16,185,129,0.25)' : 'var(--ink-200)'}; color:${connected ? 'var(--mint-600)' : 'var(--ink-500)'};">${connected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                  <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
                    ${(form?.fields || []).map((field) => `
                      <div>
                        <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-500); text-transform:uppercase; margin-bottom:6px;">${esc(field.label)}</label>
                        <input class="input" type="${field.type || 'text'}" data-depot-field="${esc(field.id)}" data-depot-id="${esc(depotId)}" value="${esc(entry.credentials?.[field.id] || '')}" placeholder="${esc(field.label)}">
                      </div>
                    `).join('')}
                  </div>
                  <div class="flex gap-3 mt-4">
                    <button class="btn btn-brand" onclick="saveDepotSettings('${escJs(depotId)}')">Kaydet</button>
                    <button class="btn btn-ghost" onclick="testDepotLogin('${escJs(depotId)}')">Test Login</button>
                  </div>
                  ${!connected ? `<div class="settings-help">Kullanici adi ve sifre girin, sistem otomatik test edecek.</div>` : ''}
                  <div id="settings-status-${esc(depotId)}" class="text-sm text-muted mt-4"></div>
                </div>
              `;
            }).join('')}
              <details id="compatPanel" class="card compat-panel" style="padding:24px;">
                <summary>Uyumluluk araclari</summary>
              <p class="text-muted mt-4">Mockta gorunmeyen ama korunmasi gereken test, update ve tanisal yuzeyler burada tutulur.</p>
              <div class="flex gap-3 mt-4">
                <button class="btn btn-outline" onclick="runCompatHealth()">Health</button>
                <button class="btn btn-outline" onclick="runCompatDemo()">Demo Panel</button>
                <button class="btn btn-outline" onclick="runCompatUpdate()">Guncelleme Kontrol Et</button>
              </div>
              <div class="mt-4 text-sm text-muted" id="compatStatusBox">Surum: ${esc(appVersion || '-')} ${updateStatus ? ` | Update: ${esc(updateStatus)}` : ''}</div>
            </details>
          </section>
        </div>
      </div>
    `;
  }

  globalScope.V23ShellUI = {
    renderLoginPage,
    renderHomePage,
    renderSettingsPage,
  };
})(typeof window !== 'undefined' ? window : null);
