/**
 * security-guards.js
 * Frontend runtime guards aligned with V2.2 hardening principles.
 */
(function initV23SecurityGuards(globalScope) {
  if (!globalScope) return;

  function isSafeHttpUrl(rawUrl = '') {
    const value = String(rawUrl || '').trim();
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function sanitizeSearchInput(rawValue = '') {
    return String(rawValue || '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim()
      .slice(0, 256);
  }

  globalScope.V23SecurityGuards = {
    isSafeHttpUrl,
    sanitizeSearchInput,
  };
})(typeof window !== 'undefined' ? window : null);
