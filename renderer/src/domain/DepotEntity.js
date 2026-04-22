/**
 * DepotEntity.js
 * Sisteme kayıtlı olan ve arama yapılacak olan depoların yeteneklerini,
 * bağlantı metotlarını ve çevrimiçi kullanılabilirlik durumlarını sarmalar.
 */

export class DepotEntity {
  /**
   * @param {Object} rawConfig - Backend üzerinden (/api/config) okunan config objesi
   * @param {String} depotId - 'selcuk', 'nevzat', vb.
   */
  constructor(depotId, rawConfig) {
    this.id = depotId;
    this.name = rawConfig?.name || depotId;
    this.authType = rawConfig?.authType || 'unknown';
    
    // Config durumu
    this.isConfigured = rawConfig?.configured || false;
    this.isEnabled = rawConfig?.enabled !== false; 

    // Gelecek yetenek matrisi (örneğin stock fetch, canlı quote)
    this.capabilities = {
      liveQuote: rawConfig?.capabilities?.liveQuote || false,
      stockInfo: rawConfig?.capabilities?.stockInfo || true
    };
  }

  /**
   * Bu deponun mevcut eczacı tarafından arama listesinde kullanıma
   * uygun olup olmadığını döner.
   */
  isReadyForSearch() {
    return this.isConfigured && this.isEnabled;
  }
}
