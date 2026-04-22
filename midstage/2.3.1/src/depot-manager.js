const SelcukDepot = require('./depots/selcuk');

class DepotManager {
  constructor() {
    this.depots = [];
  }

  /**
   * Depot ekle
   * @param {object} depot - search(query) methodu olan bir depot nesnesi
   */
  addDepot(depot) {
    this.depots.push(depot);
  }

  /**
   * Tüm depolarda paralel arama yap
   * @param {string} query - barkod veya ilaç adı
   * @returns {Promise<Array>} - her depodan gelen sonuçlar
   */
  async searchAll(query) {
    const results = await Promise.allSettled(
      this.depots.map(depot => depot.search(query))
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      }
      return {
        depot: this.depots[i].name,
        error: r.reason?.message || 'Bilinmeyen hata',
        results: [],
      };
    });
  }

  /**
   * Tüm depo sonuçlarını birleştirip fiyata göre sırala
   */
  async searchAndCompare(query) {
    const depotResults = await this.searchAll(query);
    const isBarcodeQuery = /^\d{13,}$/.test(query);

    // Tüm sonuçları düz bir listeye çevir
    const allProducts = [];
    for (const dr of depotResults) {
      for (const product of dr.results) {
        // Eğer ürün stokta yoksa doğrudan atla, kullanıcı görmek istemiyor.
        if (!product.stokVar || product.stok === 0 && product.stokGosterilsin) {
          // Bazı depolar stok = 0 gönderiyor ama stokVar = true diyebiliyor (yanlış veri).
          // Garantilemek için stok: 0 ve stokGosterilsin: true ise de atla.
          if (!product.stokVar || (product.stok === 0 && product.stokGosterilsin)) {
             continue;
          }
        }

        // Eğer sorgu bir barkod ise ve dönen ürünün kodu da bir barkod formatındaysa,
        // sadece birebir eşleşen barkodları tut, eşdeğerleri (farklı barkodlu ürünleri) ele.
        if (isBarcodeQuery) {
          const code = String(product.kodu || '').trim();
          if (code.startsWith('8') && code.length >= 13) {
            if (code !== query) continue;
          } else {
            // Depot internal ID döndüyse (Selçuk, Nevzat vb.),
            // kodu görsel tutarlılık için sorgulanan barkod ile ez.
            product.kodu = query;
          }
        }

        allProducts.push({
          ...product,
          depot: dr.depot,
        });
      }
    }

    // Fiyata gore sirala (ucuzdan pahaliya) - fiyatı 0 olmayanları öne, olanları sona alalım
    allProducts.sort((a, b) => {
      if (a.fiyatNum === 0 && b.fiyatNum !== 0) return 1;
      if (b.fiyatNum === 0 && a.fiyatNum !== 0) return -1;
      return a.fiyatNum - b.fiyatNum;
    });

    // Fotoyu bul (Ilk gecerli resim alanini al, "resim yok" tarzlarini ele)
    let imageUrl = '';
    const invalidImageKeywords = ['yok', 'no-image', 'noimage', 'default', 'c=.png'];
    for (const p of allProducts) {
      if (p.imgUrl) {
        const urlLower = p.imgUrl.toLowerCase();
        const isInvalid = invalidImageKeywords.some(k => urlLower.includes(k));
        if (!isInvalid) {
          imageUrl = p.imgUrl;
          // Nevzat relative URL duzeltme
          if (imageUrl.startsWith('/Resim')) {
            imageUrl = 'https://www.nevzatecza.com.tr' + imageUrl;
          }
          break;
        }
      }
    }

    return {
      query,
      depotResults, // her deponun kendi sonuçları (hata bilgisi dahil)
      compared: allProducts, // birleşik ve sıralı
      imageUrl, // tablonun ustunde gosterilecek foto
    };
  }
}

module.exports = DepotManager;
