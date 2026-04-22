/**
 * state.js
 * Frontend arayüzünde kullanılan global, değişken ve reaktif durumları tutar.
 * Observer pattern vb. kullanılabilir ama şimdilik sadece merkezi config objesidir.
 */

export const AppState = {
  search: {
    query: '',
    items: [],       // Arama sonuncunda bulunan DrugEntity matrisi
    selectedKey: '', // Seçili barkod/id
    status: 'idle',  // 'idle' | 'loading' | 'success' | 'error'
    errorInfo: null
  },
  planEditor: {
    isOpen: false,
    itemKey: null,
  },
  diagnostics: {
    buffer: [],
    sequence: 0,
    LIMIT: 120
  }
};

export function pushDiagnostic(type, message, meta = {}) {
  AppState.diagnostics.sequence++;
  AppState.diagnostics.buffer.unshift({
    id: AppState.diagnostics.sequence,
    type, message, meta, timestamp: Date.now()
  });
  if (AppState.diagnostics.buffer.length > AppState.diagnostics.LIMIT) {
    AppState.diagnostics.buffer.length = AppState.diagnostics.LIMIT;
  }
}
