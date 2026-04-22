/**
 * OrderDataEngine.js
 * (Veri Formatlama ve Sipariş Matematiği)
 * app.js içerisinde DOM ile iç içe geçmiş olan MF (Mal Fazlası) hesaplama,
 * toplam maliyet (TotalCost) hesaplama ve varyasyon kıyaslamalarını saf matematikle çözer.
 */

export class OrderDataEngine {
  /**
   * String olarak gelen "10+2" gibi mf verisini objeye çevirir.
   */
  static parseMf(str) {
    if (!str) return null;
    const match = str.match(/(\d+)[\+\-](\d+)/);
    if (!match) return null;
    const buy = parseInt(match[1], 10);
    const get = parseInt(match[2], 10);
    if (buy <= 0 || get <= 0) return null;
    return { buy, get, total: buy + get };
  }

  /**
   * Verilen Entity listesi için "Birim Fiyat" ve "Mal Fazlası" seçeneklerini birleştirerek
   * en avantajlı alım kombinasyonlarını çıkartır. 
   */
  static calculateBestOptions(items, targetQty) {
    const safeQty = Math.max(parseInt(targetQty, 10) || 1, 1);
    
    // Kampanyasız "düz adet" alım seçenekleri
    const unitOptions = this._buildUnitOptions(items, safeQty);
    
    // Kullanıcı çoklu ürün aldıysa belki MF baremini de geçiyordur
    const hasMfPossibility = safeQty > 1;
    const mfOptions = hasMfPossibility ? this._calcMfOptions(items, safeQty) : [];

    // Hepsini birleştirip "EffectiveUnit" (Birim Başına Düşen Gerçek Fiyat) bazında sıralayalım
    const combined = [...mfOptions, ...unitOptions];

    // Depo başına sadece "en iyi" teklifi seç (Örn: Selçuk hem MF'de hem düz fiyatta varsa, ucuz olan kalsın)
    const bestPerDepot = new Map();
    combined.forEach(opt => {
      const key = opt.depotId;
      if (!bestPerDepot.has(key) || opt.effectiveUnit < bestPerDepot.get(key).effectiveUnit) {
        bestPerDepot.set(key, opt);
      }
    });

    return Array.from(bestPerDepot.values()).sort((a, b) => a.effectiveUnit - b.effectiveUnit);
  }

  static _buildUnitOptions(items, safeQty) {
    return items
      .filter(i => i.price > 0)
      .map(item => ({
        depot: item.depotName,
        depotId: item.depotId,
        mf: null,
        mfStr: '',
        orderQty: safeQty,
        receiveQty: safeQty,
        totalCost: safeQty * item.price,
        effectiveUnit: item.price,
        unitPrice: item.price,
        sourceItem: item
      }));
  }

  static _calcMfOptions(items, targetQty) {
    return items
      .filter(i => i.price > 0)
      .map(item => {
        const mf = this.parseMf(item.mfString);
        const unitPrice = item.price;

        if (!mf || targetQty < mf.total) { // Hedef MF limitine ulaşmadı
          return {
            depot: item.depotName,
            depotId: item.depotId,
            mf: null,
            mfStr: '',
            orderQty: targetQty,
            receiveQty: targetQty,
            totalCost: targetQty * unitPrice,
            effectiveUnit: unitPrice,
            unitPrice,
            sourceItem: item
          };
        }

        const batches = Math.ceil(targetQty / mf.total);
        const orderQty = batches * mf.buy;
        const receiveQty = batches * mf.total;

        return {
          depot: item.depotName,
          depotId: item.depotId,
          mf,
          mfStr: item.mfString,
          orderQty,
          receiveQty,
          totalCost: orderQty * unitPrice,
          effectiveUnit: (orderQty * unitPrice) / receiveQty, // Yeni mal fazlası düşülmüş efektif birim fiyat
          unitPrice,
          sourceItem: item
        };
      });
  }
}
