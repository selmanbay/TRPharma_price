import { DrugEntity } from '../domain/DrugEntity.js';
import { authService } from '../core/AuthService.js';
import { depotRepository } from './DepotRepository.js';

/**
 * SearchEngineService.js
 * Arama mantığını UI'dan soyutlar. İsteklerin iptal edilmesi (abort),
 * concurrent depoların sorgulanması ve DrugEntity objesine çevrilmesi burada yapılır.
 */

export class SearchEngineService {
  constructor() {
    this.activeAborter = null;
  }

  /**
   * 
   * @param {String} query - Arama kelimesi veya barkodu
   * @param {Function} onResult - Depodan sonuç geldikçe çağrılır: (DrugEntity[])
   */
  async searchAcrossDepots(query, onResult) {
    // 1) Eski aramayı iptal et
    if (this.activeAborter) {
      this.activeAborter.abort();
    }
    this.activeAborter = new AbortController();
    const signal = this.activeAborter.signal;

    // 2) Aktif depoları al (20 depoya kadar ölçeklenebilir)
    const activeDepots = depotRepository.getActiveDepots();
    if (activeDepots.length === 0) {
      throw new Error('Aktif ve ayarlanmış hiçbir depo bulunamadı.');
    }

    let successCount = 0;
    
    // 3) Her depo için parelel request çık ("Race")
    // Gerçek SSE geçilirse buralar EventSource handlerına dönüşecek.
    const promises = activeDepots.map(async (depot) => {
      try {
        const url = `/api/search-depot?q=${encodeURIComponent(query)}&depotId=${depot.id}`;
        // AuthFetch kendi içinde 15s timeout ekliyor, ancak biz component mount signal'i de verebiliriz.
        // Ama şimdilik AuthFetch direkt kullanılacak şekilde ayarlandı, sinyali param geçiriyoruz (desteklenmesi lazım)
        const res = await authService.authFetch(url, { signal });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);

        // Raw datayı standardize et
        if (data.results && data.results.length > 0) {
          successCount++;
          const entities = data.results.map(raw => new DrugEntity(raw, depot.id));
          onResult(entities); // UI'ya emit
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // İptal edildiyse loglama
        console.warn(`[SearchEngine] ${depot.name} araması başarısız:`, err.message);
        // Hata durumunu loglayabiliriz ancak "race" gereği UI çökmez, diğerleri gelmeye devam eder.
      }
    });

    // Ana akışı bitir
    await Promise.allSettled(promises);
    return successCount; // Kaç depodan olumlu yanıt döndü
  }

  cancelSearch() {
    if (this.activeAborter) {
      this.activeAborter.abort();
      this.activeAborter = null;
    }
  }
}

export const searchEngineService = new SearchEngineService();
