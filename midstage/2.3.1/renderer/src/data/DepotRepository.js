import { DepotEntity } from '../domain/DepotEntity.js';
import { authService } from '../core/AuthService.js';

/**
 * DepotRepository.js
 * Sistemdeki bağlı depoları ve bunların config ayarlarını backend'den fetchleyip,
 * "kullanılabilir (active)" depolar listesini çıkaran Domain Veri deposu.
 */

export class DepotRepository {
  constructor() {
    this.depots = new Map(); // id -> DepotEntity
  }

  /**
   * Database / API 'den Eczacıya tanımlı depo listesini ve configlerini çeker.
   */
  async fetchDepots() {
    try {
      const res = await authService.authFetch('/api/config');
      if (!res.ok) throw new Error('Depo listesi çekilemedi');
      const data = await res.json();
      
      this.depots.clear();
      
      // Backend availableDepots ve ayarlanan depolar olarak veriyi dönüyor.
      if (data.availableDepots) {
        for (const [id, info] of Object.entries(data.availableDepots)) {
          // Sistemdeki ayarlanmış depo detayı
          const configDetails = data.depots[id] || {}; 
          const mergedConfig = { ...info, ...configDetails };
          
          this.depots.set(id, new DepotEntity(id, mergedConfig));
        }
      }
      return Array.from(this.depots.values());
    } catch (err) {
      console.error('[DepotRepository] fetchDepots Hatası:', err);
      return [];
    }
  }

  getActiveDepots() {
    const list = Array.from(this.depots.values());
    return list.filter(depot => depot.isReadyForSearch());
  }

  getDepot(id) {
    return this.depots.get(id);
  }
}

export const depotRepository = new DepotRepository();
