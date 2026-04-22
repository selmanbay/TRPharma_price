/**
 * app-v231.js
 * Retired legacy entrypoint kept only as a reference marker.
 * Latest runtime entrypoint is renderer/scripts/app.js.
 */
(function notifyRetiredV231Entrypoint(globalScope) {
  if (!globalScope?.console) return;
  globalScope.console.warn('[v2.3.1] app-v231.js retired. Use renderer/scripts/app.js instead.');
})(typeof window !== 'undefined' ? window : null);
