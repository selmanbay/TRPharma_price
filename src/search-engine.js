/**
 * search-engine.js — Provider Registry Search Engine (v1.0)
 * ─────────────────────────────────────────────────────────
 *
 * Her depo bir "search provider" olarak kayıt olur.
 * Engine tüm aktif provider'ları paralel başlatır ve sonuçları
 * callback ile stream eder (SSE endpoint tarafından kullanılır).
 *
 * Depo ekleme:
 *   1. adapter dosyası oluştur (search(query) → {results, depot, error})
 *   2. server.js → DEPOT_CLASSES'a ekle
 *   3. initDepots() otomatik olarak engine'e kayıt eder
 *
 * Depo pasif yapma:
 *   searchEngine.deactivate('depotId')
 */

'use strict';

class SearchEngine {
  constructor() {
    /** @type {Map<string, SearchProvider>} */
    this.providers = new Map();
  }

  // ── Provider yönetimi ───────────────────────────────────────────────────────

  /**
   * Yeni search provider kayıt et.
   * @param {string}   id       — benzersiz depo tanımlayıcı (ör: 'selcuk')
   * @param {object}   opts
   * @param {string}   opts.name     — görüntülenen ad ('Selçuk Ecza')
   * @param {Function} opts.searchFn — (query: string) => Promise<{results, depot, error}>
   */
  register(id, { name, searchFn }) {
    if (typeof searchFn !== 'function') {
      throw new Error(`[SearchEngine] register("${id}"): searchFn zorunlu`);
    }
    this.providers.set(id, { id, name, searchFn, active: false });
  }

  /** Provider aktif et — arama sırasında sorgulanır */
  activate(id) {
    const p = this.providers.get(id);
    if (p) p.active = true;
  }

  /** Provider pasif yap — aramadan çıkarılır ama kayıt silinmez */
  deactivate(id) {
    const p = this.providers.get(id);
    if (p) p.active = false;
  }

  /** Tüm provider'ların aktiflik durumunu config'den güncelle */
  syncActiveState(activeIds) {
    for (const [id, provider] of this.providers) {
      provider.active = activeIds.includes(id);
    }
  }

  /** Aktif provider listesi */
  getActiveProviders() {
    return [...this.providers.values()].filter(p => p.active);
  }

  /** Tüm provider listesi (aktif + pasif) — diagnostik amaçlı */
  getAllProviders() {
    return [...this.providers.values()];
  }

  /** Kayıtlı provider var mı? */
  has(id) {
    return this.providers.has(id);
  }

  /** Tüm kayıtları temizle (reinit için) */
  clear() {
    this.providers.clear();
  }

  // ── Arama ───────────────────────────────────────────────────────────────────

  /**
   * Tüm aktif provider'ları PARALEL sorgula.
   * Her biri bittiğinde onResult çağrılır — SSE stream için ideal.
   * Hepsi bittiğinde onDone çağrılır.
   *
   * @param {string}   query
   * @param {object}   callbacks
   * @param {Function} callbacks.onResult  — (providerId, filteredResults, depotUrl)
   * @param {Function} callbacks.onDone    — ()
   * @param {Function} [callbacks.onError] — (providerId, error)
   */
  async search(query, { onResult, onDone, onError }) {
    const active = this.getActiveProviders();

    if (active.length === 0) {
      if (onDone) onDone();
      return;
    }

    const isBarcodeQuery = /^\d{13,}$/.test(query);

    const promises = active.map(provider =>
      provider.searchFn(query)
        .then(result => {
          if (result?.error) {
            if (onError) onError(provider.id, new Error(result.error));
          }
          const raw = result?.results || [];
          const filtered = SearchEngine.filterResults(raw, query, isBarcodeQuery);

          if (filtered.length > 0) {
            onResult(provider.id, filtered, result?.depotUrl || '');
          }
        })
        .catch(err => {
          if (onError) {
            onError(provider.id, err);
          }
        })
    );

    await Promise.allSettled(promises);
    if (onDone) onDone();
  }

  // ── Statik yardımcılar ──────────────────────────────────────────────────────

  /**
   * Stok ve barkod filtresi — eski /api/search-depot mantığı.
   * Her provider'ın raw sonucuna uygulanır.
   */
  static filterResults(results, query, isBarcodeQuery) {
    if (!Array.isArray(results)) return [];

    return results.filter(product => {
      // Stok kontrolü
      if (!product.stokVar) return false;
      if (product.stok === 0 && product.stokGosterilsin) return false;

      // Barkod eşleşme kontrolü
      if (isBarcodeQuery) {
        const code = String(product.kodu || '').trim();
        if (code.startsWith('8') && code.length >= 13) {
          if (code !== query) return false;
        } else {
          // Depot internal ID dönmüşse, kodu sorgulanan barkod ile ez
          product.kodu = query;
        }
      }

      return true;
    });
  }
}

module.exports = SearchEngine;
