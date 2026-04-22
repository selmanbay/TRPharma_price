/**
 * storage.js
 * LocalStorage the okuma, yazma ve senkronizasyon operasyonları.
 */

const KEYS = {
  TOKEN: 'eczane.auth.token',
  USER: 'eczane.auth.user',
  ORDER_PLAN: 'eczane.orderPlan.v2',
  ROUTINE_LIST: 'eczane.routineList.v2',
};

export class Storage {
  static read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!raw) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
      } catch {
        return raw;
      }
    } catch {
      return fallback;
    }
  }

  static writeLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static writeSession(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  static clearSession() {
    sessionStorage.removeItem(KEYS.TOKEN);
    sessionStorage.removeItem(KEYS.USER);
  }
}

export const StorageKeys = KEYS;
