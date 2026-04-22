(function initRuntimeCoordinator(global) {
  const scopeControllers = new Map();
  const listeners = new Map();

  function emit(eventName, payload) {
    const handlers = listeners.get(eventName);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (_) {}
    });
  }

  function on(eventName, handler) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    return () => listeners.get(eventName)?.delete(handler);
  }

  function abortScope(scopeName) {
    const controller = scopeControllers.get(scopeName);
    if (!controller) return;
    controller.abort(new Error(`scope-abort:${scopeName}`));
    scopeControllers.delete(scopeName);
    emit('scope:abort', { scopeName });
  }

  function replaceScope(scopeName) {
    abortScope(scopeName);
    const controller = new AbortController();
    scopeControllers.set(scopeName, controller);
    emit('scope:start', { scopeName });
    return controller;
  }

  function clearScope(scopeName, controller) {
    if (!scopeName) return;
    const active = scopeControllers.get(scopeName);
    if (!active || (controller && active !== controller)) return;
    scopeControllers.delete(scopeName);
    emit('scope:clear', { scopeName });
  }

  function isAbortError(error) {
    return error?.type === 'abort'
      || error?.name === 'AbortError'
      || String(error?.message || '').includes('Istek iptal edildi')
      || String(error?.message || '').includes('scope-abort:');
  }

  global.EczaneRuntimeCoordinator = {
    on,
    emit,
    abortScope,
    replaceScope,
    clearScope,
    isAbortError,
  };
})(window);
