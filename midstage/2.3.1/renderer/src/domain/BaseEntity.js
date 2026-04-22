/**
 * BaseEntity.js
 * Ortak entity davranislari icin taban sinif.
 */
export class BaseEntity {
  constructor(raw = {}) {
    this.raw = raw || {};
    this.createdAt = new Date().toISOString();
  }

  normalizeText(value, fallback = '') {
    if (value == null) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  normalizeInt(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
