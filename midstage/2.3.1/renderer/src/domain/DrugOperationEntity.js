import { DrugEntity } from './DrugEntity.js';

/**
 * DrugOperationEntity
 * Unified operation model for search, plan and approval flows.
 */
export class DrugOperationEntity extends DrugEntity {
  constructor(rawData = {}, options = {}) {
    super(rawData, rawData?.depotId || options?.depotId || 'unknown');

    this.operationSource = String(options.source || rawData.operationSource || 'search');
    this.key = this._resolveOperationKey(rawData, options);
    this.desiredQty = Math.max(parseInt(rawData.desiredQty ?? options.desiredQty ?? 1, 10) || 1, 1);
    this.orderQty = Math.max(parseInt(rawData.orderQty ?? this.desiredQty, 10) || this.desiredQty, 1);
    this.receiveQty = Math.max(parseInt(rawData.receiveQty ?? this.desiredQty, 10) || this.desiredQty, 1);
    this.unitPrice = this._resolveUnitPrice(rawData);
    this.effectiveUnit = Number(rawData.effectiveUnit) || this.unitPrice;
    this.totalCost = Number(rawData.totalCost) || (this.effectiveUnit * this.desiredQty);
    this.mfString = String(rawData.mfStr || rawData.malFazlasi || rawData.mfString || this.mfString || '').trim();
    this.approvalStatus = String(rawData.approvalStatus || '').trim();
    this.approvedAt = String(rawData.approvedAt || '').trim();
    this.depotUrl = String(rawData.depotUrl || '').trim();
    this.alternatives = Array.isArray(rawData.alternatives) ? rawData.alternatives : [];
    this.sourceQuery = String(options.sourceQuery || rawData.sourceQuery || '').trim();
    this.inPlan = Boolean(options.inPlan || rawData.inPlan);
    this.planQty = Math.max(parseInt(rawData.planQty ?? this.desiredQty, 10) || this.desiredQty, 1);
  }

  _resolveOperationKey(rawData, options) {
    const provided = String(rawData.key || options.key || '').trim();
    if (provided) return provided;
    if (this.barcode) return this.barcode;
    return this.name || this.id;
  }

  _resolveUnitPrice(rawData) {
    if (typeof rawData.fiyatNum === 'number') return rawData.fiyatNum;
    if (typeof rawData.unitPrice === 'number') return rawData.unitPrice;
    if (typeof rawData.price === 'number') return rawData.price;
    const parsed = Number(String(rawData.fiyat || '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  toPlanItem() {
    return {
      key: this.key,
      barcode: this.barcode || '',
      name: this.name,
      depot: this.depotName || this.depotId,
      depotId: this.depotId || '',
      desiredQty: this.desiredQty,
      orderQty: this.orderQty,
      receiveQty: this.receiveQty,
      totalCost: this.totalCost,
      effectiveUnit: this.effectiveUnit,
      unitPrice: this.unitPrice,
      psf: this.psf,
      psfFiyatNum: this.psf,
      psfFiyat: this.psfString || '',
      mfStr: this.mfString,
      depotUrl: this.depotUrl,
      alternatives: this.alternatives,
      approvalStatus: this.approvalStatus,
      approvedAt: this.approvedAt,
      imageUrl: this.imageUrl || '',
      operationSource: this.operationSource,
      entityId: this.id,
    };
  }

  toApprovalItem() {
    return {
      key: this.key,
      barcode: this.barcode || '',
      name: this.name,
      depot: this.depotName || this.depotId,
      depotId: this.depotId || '',
      desiredQty: this.desiredQty,
      totalCost: this.totalCost,
      unitCost: this.effectiveUnit,
      psf: this.psf,
      psfFiyatNum: this.psf,
      depotUrl: this.depotUrl,
      imageUrl: this.imageUrl || '',
      mfStr: this.mfString,
      approvalStatus: this.approvalStatus || 'approved',
      approvedAt: this.approvedAt || new Date().toISOString(),
      entityId: this.id,
    };
  }

  toSearchItem() {
    return {
      key: this.key,
      ad: this.name,
      name: this.name,
      barkod: this.barcode || '',
      barcode: this.barcode || '',
      depot: this.depotName || this.depotId,
      depotId: this.depotId || '',
      fiyatNum: this.unitPrice,
      fiyat: this.priceString || `${this.unitPrice.toFixed(2)} TL`,
      psf: this.psf,
      psfFiyatNum: this.psf,
      psfFiyat: this.psfString || '',
      mfStr: this.mfString,
      malFazlasi: this.mfString,
      stok: this.stockCount,
      stokVar: this.inStock,
      imageUrl: this.imageUrl || '',
      depotUrl: this.depotUrl,
      approvalStatus: this.approvalStatus,
      totalCost: this.totalCost,
      desiredQty: this.desiredQty,
      entityId: this.id,
      inPlan: this.inPlan,
      planQty: this.planQty,
    };
  }
}
