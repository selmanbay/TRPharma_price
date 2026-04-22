import { BaseEntity } from './BaseEntity.js';

/**
 * DrugEntity.js
 * Frontend domain model for depot search results.
 * Barcode is the primary identity when available.
 */
export class DrugEntity extends BaseEntity {
  /**
   * @param {Object} rawData
   * @param {String} sourceDepotId
   */
  constructor(rawData, sourceDepotId = 'unknown') {
    super(rawData);

    // === PRIMARY IDENTIFIER ===
    this.barcode = this._resolveBarcode(rawData);
    this.id = this.barcode
      ? `BARCODE_${this.barcode}`
      : `NAME_${this._normalize(rawData?.ad || rawData?.name)}`;

    // === CORE PROPERTIES ===
    this.name = rawData?.ad || rawData?.name || 'Bilinmeyen Ilac';
    this.normalizedName = this._normalize(this.name);
    this.depotId = sourceDepotId;
    this.depotName = rawData?.depot || sourceDepotId;
    this.innerCode = rawData?.kodu || '';

    // === COMMERCE PROPERTIES ===
    this.price = this._parsePrice(rawData?.fiyat || rawData?.fiyatNum);
    this.priceString = rawData?.fiyat || `${this.price.toFixed(2)} TL`;
    this.psf = this._parsePrice(
      rawData?.psf
      ?? rawData?.psfFiyatNum
      ?? rawData?.psfFiyat
      ?? rawData?.perakende
      ?? rawData?.PSFFiyat
      ?? rawData?.Price2Str
      ?? rawData?.etiketFiyati
    );
    this.psfString = rawData?.psfFiyat
      || rawData?.perakende
      || (this.psf > 0 ? `${this.psf.toFixed(2)} TL` : '');
    this.inStock = rawData?.stokVar === true || rawData?.stok > 0;
    this.stockCount = parseInt(rawData?.stok, 10) || 0;
    this.mfString = rawData?.malFazlasi || rawData?.mf || '';

    // === MEDIA ===
    const rawImage = rawData?.imgUrl
      || rawData?.imageUrl
      || rawData?.PicturePath
      || rawData?.picturePath
      || '';
    this.imageUrl = this._resolveImage(rawImage, sourceDepotId);
  }

  _resolveBarcode(data) {
    const rawBarcode = String(data?.barkod || data?.barcode || '');
    if (this._isValidBarcode(rawBarcode)) return rawBarcode;

    const code = String(data?.kodu || '').trim();
    if (this._isValidBarcode(code)) return code;

    return null;
  }

  _isValidBarcode(str) {
    const clean = str.replace(/[^0-9]/g, '');
    return clean.startsWith('8') && clean.length >= 13;
  }

  _parsePrice(price) {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    const cleaned = String(price).replace(/[^0-9,.-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  _normalize(str) {
    if (!str) return '';
    return str.toString().toUpperCase().replace(/[\s.]+/g, ' ').trim();
  }

  _resolveImage(url, depotId) {
    if (!url) return null;
    const invalidKeywords = ['yok', 'no-image', 'noimage', 'default', 'c=.png'];
    const lowerUrl = url.toLowerCase();

    if (invalidKeywords.some((kw) => lowerUrl.includes(kw))) {
      return null;
    }

    if (depotId === 'nevzat' && url.startsWith('/Resim')) {
      return 'https://www.nevzatecza.com.tr' + url;
    }

    return url;
  }
}
