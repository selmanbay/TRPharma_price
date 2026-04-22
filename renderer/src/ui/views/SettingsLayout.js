import { depotRepository } from '../../data/DepotRepository.js';
import { authService } from '../../core/AuthService.js';
import { EventBinder } from '../EventBinder.js';

/**
 * SettingsLayout.js
 * Kullanıcının Eczane depo API bağlantıları için şifre ve kullanıcı ID'si
 * ayarladığı ve backend'e gönderdiği arayüz tablosunu render eder.
 */
export class SettingsLayout {
  init() {
     // Ayarlar butonu tıklaması nav barda (Şimdilik global scope)
     // EventBinder.bind('profileSettingsBtn', 'click', () => { window.showPage('settings') });
  }

  async render() {
    if (!authService.getCurrentUser()?.canEditSettings()) {
      this._showUnauthorized();
      return;
    }

    const container = document.getElementById('settingsContainer');
    if (!container) return;

    // Depolar configden besleniyor
    const allDepots = Array.from(depotRepository.depots.values());

    const formsHtml = allDepots.map(depot => `
       <div class="settings-card">
           <div class="settings-card-head">
               <div class="sc-depot-info">
                   <div class="sc-depot-icon connected"></div>
                   <div>
                       <h3>${depot.name}</h3>
                       <div class="sc-depot-status ${depot.isConfigured ? 'status-ok' : 'status-err'}">
                          ${depot.isConfigured ? 'Bağlantı Kurulu' : 'Bağlantı Yok'}
                       </div>
                   </div>
               </div>
           </div>
           <div class="settings-card-body">
               <div class="settings-form-row">
                   <input type="text" id="cfg_${depot.id}_user" placeholder="Kullanıcı Adı" autocomplete="off" class="sc-input">
                   <input type="password" id="cfg_${depot.id}_pass" placeholder="Şifre" autocomplete="off" class="sc-input">
                   <button class="btn btn-primary" onclick="window.saveDepotCreds('${depot.id}')">Kaydet</button>
               </div>
           </div>
       </div>
    `).join('');

    container.innerHTML = `
        <div class="settings-section">
            <h3 class="settings-section-title">Depo Bağlantıları</h3>
            ${formsHtml}
        </div>
    `;
  }

  async saveCredentials(depotId, username, password) {
      if (!username || !password) return;
      
      try {
          // Backend /api/config/depot/{id}
          const res = await authService.authFetch(`/api/config/depots/${depotId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });

          if (res.ok) {
              const toast = document.getElementById('toast');
              if (toast) { toast.textContent = 'Bağlantı güncellendi'; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),3000); }
              await depotRepository.fetchDepots();
              this.render(); // Redraw
          }
      } catch (err) {
          console.error('[Settings] Kayıt Hatası', err);
      }
  }

  _showUnauthorized() {
    const container = document.getElementById('settingsContainer');
    if (container) {
      container.innerHTML = `<div class="auth-error visible">Bu ayarları değiştirmek için yönetici (Admin) olmalısınız.</div>`;
    }
  }
}

export const settingsLayout = new SettingsLayout();

EventBinder.exposeToWindow('saveDepotCreds', (depotId) => {
    const user = document.getElementById(`cfg_${depotId}_user`)?.value;
    const pass = document.getElementById(`cfg_${depotId}_pass`)?.value;
    settingsLayout.saveCredentials(depotId, user, pass);
});
