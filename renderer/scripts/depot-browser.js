// Depot Browser Panel — WebView-based side panel for depot sites

const DEPOT_URLS = {
  selcuk: 'https://webdepo.selcukecza.com.tr/Siparis/hizlisiparis.aspx',
  nevzat: 'http://webdepo.nevzatecza.com.tr/Siparis/hizlisiparis.aspx',
  'anadolu-pharma': 'https://b2b.anadolupharma.com',
  'anadolu-itriyat': 'https://b4b.anadoluitriyat.com',
  alliance: 'https://esiparisv2.alliance-healthcare.com.tr',
  sentez: 'https://www.sentezb2b.com',
};

const DEPOT_NAMES = {
  selcuk: 'Selçuk Ecza',
  nevzat: 'Nevzat Ecza',
  'anadolu-pharma': 'Anadolu Pharma',
  'anadolu-itriyat': 'Anadolu İtriyat',
  alliance: 'Alliance Healthcare',
  sentez: 'Sentez B2B',
};

const DEPOT_SEARCH_SELECTORS = {
  selcuk: { input: '#txtAra', button: '#btnAra' },
  nevzat: { input: '#txtAra', button: '#btnAra' },
  'anadolu-pharma': { input: 'input[placeholder*="Ara"]', button: 'button[type="submit"]' },
  'anadolu-itriyat': { input: '#SearchText', button: '#SearchButton' },
  alliance: { input: '#txtSearch', button: '#btnSearch' },
  sentez: null,
};

let depotPanelOpen = false;
let currentDepotId = null;

function openDepotPanel(url, depotId, searchQuery) {
  const panel = document.getElementById('depotPanel');
  const overlay = document.getElementById('depotOverlay');
  const title = document.getElementById('depotPanelTitle');
  const webview = document.getElementById('depotWebview');

  currentDepotId = depotId;
  title.textContent = DEPOT_NAMES[depotId] || 'Depo';

  const targetUrl = url || DEPOT_URLS[depotId] || '';
  if (!targetUrl) return;

  injectCookiesAndLoad(webview, depotId, targetUrl, searchQuery);

  requestAnimationFrame(() => {
    panel.classList.add('open');
    overlay.classList.add('open');
    depotPanelOpen = true;
  });
}

function closeDepotPanel() {
  const panel = document.getElementById('depotPanel');
  const overlay = document.getElementById('depotOverlay');
  const webview = document.getElementById('depotWebview');

  panel.classList.remove('open');
  overlay.classList.remove('open');
  depotPanelOpen = false;

  setTimeout(() => {
    webview.src = 'about:blank';
    currentDepotId = null;
  }, 400);
}

async function injectCookiesAndLoad(webview, depotId, url, searchQuery) {
  try {
    // Inject cookies via main process (has access to session.fromPartition)
    if (window.electronAPI && window.electronAPI.injectDepotCookies) {
      const result = await window.electronAPI.injectDepotCookies(depotId, url);
      if (result && result.success && result.injected > 0) {
        console.log(`[depot-browser] ${result.injected} cookie(s) injected for ${depotId}`);
      }
    }
  } catch (err) {
    console.error('Cookie injection error:', err);
  }

  webview.src = url;

  if (searchQuery) {
    webview.addEventListener('did-finish-load', function onLoad() {
      webview.removeEventListener('did-finish-load', onLoad);
      autoSearchInWebview(webview, depotId, searchQuery);
    });
  }
}

function autoSearchInWebview(webview, depotId, query) {
  const selectors = DEPOT_SEARCH_SELECTORS[depotId];
  if (!selectors || !query) return;

  const safeQuery = query.replace(/'/g, "\\'").replace(/"/g, '\\"');
  const script = `
    (function() {
      const input = document.querySelector('${selectors.input}');
      if (input) {
        input.value = '${safeQuery}';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const btn = document.querySelector('${selectors.button}');
        if (btn) {
          setTimeout(() => btn.click(), 200);
        }
      }
    })();
  `;

  try {
    webview.executeJavaScript(script);
  } catch (e) {
    console.error('Auto-search error:', e);
  }
}
