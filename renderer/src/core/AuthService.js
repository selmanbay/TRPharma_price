import { UserEntity } from '../domain/UserEntity.js';
import { Storage, StorageKeys } from './storage.js';

/**
 * AuthService.js
 * Sisteme giriş, çıkış ve session idaresinden sorumlu servis.
 */
export class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.API_BASE = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://127.0.0.1:3000';
  }

  init() {
    const rawUser = Storage.read(StorageKeys.USER);
    const token = Storage.read(StorageKeys.TOKEN);
    if (rawUser && token) {
      this.currentUser = new UserEntity(rawUser);
      this.token = token;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.token && !!this.currentUser;
  }

  async login(password) {
    const res = await fetch(`${this.API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Giriş başarısız');
    
    Storage.writeSession(StorageKeys.TOKEN, data.token);
    Storage.writeSession(StorageKeys.USER, data.user);
    
    this.token = data.token;
    this.currentUser = new UserEntity(data.user);
    return this.currentUser;
  }

  logout() {
    Storage.clearSession();
    this.currentUser = null;
    this.token = null;
    window.location.reload();
  }

  /**
   * Sistem genelinde backend ile güvenli istekleri atacak wrapper.
   */
  async authFetch(endpoint, options = {}) {
    const headers = { ...options.headers };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000); // 15s Global Timeout

    try {
      const res = await fetch(`${this.API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        const tErr = new Error('İstek zaman aşımına uğradı');
        tErr.type = 'timeout';
        throw tErr;
      }
      err.type = 'network';
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const authService = new AuthService();
