import { BaseEntity } from './BaseEntity.js';

/**
 * UserEntity.js
 * Sisteme login olan kullanıcının rol ve temel izinlerini yöneten entity sınıfıdır.
 * İleride Backend üzerinde çok oyunculu rollere geçildiğinde, JSON mappingi buradan gerçekleşecek.
 */

export class UserEntity extends BaseEntity {
  static ROLES = {
    ADMIN: 'admin',                // Sistem yöneticisi (Tüm configleri görebilir)
    PHARMACIST: 'pharmacist',      // Eczacı (Genel ayarlara hakim)
    STAFF: 'staff',                // Çalışan (Sadece geçmiş görebilir/arama yapabilir vb.)
  };

  constructor(rawData) {
    super(rawData);
    this.id = rawData?.id || 'local_user';
    this.name = rawData?.displayName || rawData?.name || 'Bilinmeyen Kullanıcı';
    this.role = this._resolveRole(rawData?.role);
    this.isActive = rawData?.isActive !== false;
    // Özel yetki atamaları ileride veritabanından gelecek
    this.permissions = rawData?.permissions || [];
  }

  hasRole(roleName) {
    return this.role === roleName || this.role === UserEntity.ROLES.ADMIN;
  }

  canEditSettings() {
    return this.hasRole(UserEntity.ROLES.ADMIN) || this.hasRole(UserEntity.ROLES.PHARMACIST);
  }

  _resolveRole(role) {
    const validRoles = Object.values(UserEntity.ROLES);
    return validRoles.includes(role) ? role : UserEntity.ROLES.PHARMACIST; // Default Eczacı
  }
}
