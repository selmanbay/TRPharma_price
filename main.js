const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, session, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { ensureConfigFile, getConfigPath, loadConfig } = require('./src/config-store');

// Prevent Express from opening a browser window
process.env.ECZANE_OPEN_BROWSER = '0';

function isBrokenPipeError(error) {
  return error && (error.code === 'EPIPE' || String(error.message || '').includes('broken pipe'));
}

if (process.stdout) {
  process.stdout.on('error', (error) => {
    if (!isBrokenPipeError(error)) throw error;
  });
}

if (process.stderr) {
  process.stderr.on('error', (error) => {
    if (!isBrokenPipeError(error)) throw error;
  });
}

process.on('uncaughtException', (error) => {
  if (isBrokenPipeError(error)) {
    return;
  }

  try {
    dialog.showErrorBox(
      'Error',
      `A JavaScript error occurred in the main process\n\nUncaught Exception:\n${error?.stack || error?.message || String(error)}`
    );
  } catch (_) {}
});

let mainWindow = null;
let tray = null;
let isQuitting = false;
let updateDownloaded = false;
let updateCheckInFlight = false;
let updateCheckInterval = null;

function findChromeExecutable() {
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const UPDATE_CHECK_DELAY_MS = 15 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SERVER_HOST = '127.0.0.1';

const ICON_PATH = path.join(__dirname, 'renderer', 'assets', 'icons', 'icon.png');
const TRAY_ICON_PATH = path.join(__dirname, 'renderer', 'assets', 'icons', 'tray-icon.png');
const isDevMode = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Single instance lock
const gotTheLock = isDevMode ? true : app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else if (!isDevMode) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#FFFFFF',
    show: false,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:eczane-main',
    },
  });

  mainWindow.loadURL(`http://${SERVER_HOST}:3000/index.html`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('maximize-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('maximize-change', false);
  });
}

function createTray() {
  let trayIcon;
  if (fs.existsSync(TRAY_ICON_PATH)) {
    trayIcon = nativeImage.createFromPath(TRAY_ICON_PATH);
  } else if (fs.existsSync(ICON_PATH)) {
    trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Eczane App', enabled: false },
    { type: 'separator' },
    { label: 'Aç', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Kapat', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Eczane İlaç Fiyat Karşılaştırma');

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function setupAutoUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const sendStatus = (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', payload);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    updateCheckInFlight = true;
    console.log('[updater] Checking for updates...');
    sendStatus({ phase: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: ${info?.version || 'unknown-version'}`);
    sendStatus({ phase: 'available', version: info?.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInFlight = false;
    console.log(`[updater] No update available. Current latest: ${info?.version || app.getVersion()}`);
    sendStatus({ phase: 'up-to-date', version: info?.version || app.getVersion() });
  });

  autoUpdater.on('error', (error) => {
    updateCheckInFlight = false;
    console.error('[updater] Error:', error?.message || error);
    sendStatus({ phase: 'error', message: error?.message || String(error) });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = typeof progress?.percent === 'number' ? progress.percent.toFixed(1) : '0.0';
    console.log(`[updater] Downloading update... ${percent}%`);
    sendStatus({ phase: 'downloading', percent: parseFloat(percent) });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    updateCheckInFlight = false;
    updateDownloaded = true;
    console.log(`[updater] Update downloaded: ${info?.version || 'unknown-version'}`);
    sendStatus({ phase: 'downloaded', version: info?.version });

    const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const result = await dialog.showMessageBox(targetWindow, {
      type: 'info',
      buttons: ['Simdi Yeniden Baslat', 'Daha Sonra'],
      defaultId: 0,
      cancelId: 1,
      title: 'Guncelleme Hazir',
      message: `Yeni surum indirildi: ${info?.version || 'yeni surum'}`,
      detail: 'Guncellemeyi uygulamak icin uygulama yeniden baslatilacak.',
    });

    if (result.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

function scheduleUpdateChecks() {
  if (!app.isPackaged) {
    console.log('[updater] Skipping update schedule in development mode.');
    return;
  }

  const runCheck = () => {
    if (updateCheckInFlight || updateDownloaded) {
      return;
    }

    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      updateCheckInFlight = false;
      console.error('[updater] Scheduled update check failed:', error?.message || error);
    });
  };

  setTimeout(runCheck, UPDATE_CHECK_DELAY_MS);
  updateCheckInterval = setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
}

// ── IPC Handlers ──

ipcMain.on('minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('quit-app', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('check-for-updates', () => {
  if (!app.isPackaged) return { status: 'dev-mode' };
  if (updateDownloaded)    return { status: 'already-downloaded' };
  if (updateCheckInFlight) return { status: 'already-checking' };
  updateCheckInFlight = true;
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    updateCheckInFlight = false;
    console.error('[updater] Manuel kontrol hatası:', err?.message || err);
  });
  return { status: 'checking' };
});

const DEPOT_ALLOWED_HOSTS = {
  selcuk: ['webdepo.selcukecza.com.tr'],
  nevzat: ['webdepo.nevzatecza.com.tr'],
  'anadolu-pharma': ['b2b.anadolupharma.com'],
  'anadolu-itriyat': ['b4b.anadoluitriyat.com'],
  alliance: ['esiparisv2.alliance-healthcare.com.tr'],
  sentez: ['www.sentezb2b.com', 'sentezb2b.com'],
};

function isAllowedDepotTarget(depotId, targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
    const allowedHosts = DEPOT_ALLOWED_HOSTS[depotId] || [];
    return allowedHosts.some((host) => parsedUrl.hostname === host);
  } catch {
    return false;
  }
}

ipcMain.handle('inject-depot-cookies', async (_event, depotId, targetUrl) => {
  try {
    if (!isAllowedDepotTarget(depotId, targetUrl)) {
      return { success: false, reason: 'target-not-allowed' };
    }
    const config = loadConfig();
    const depot = config.depots?.[depotId];
    if (!depot) return { success: false, reason: 'no-depot' };

    const depotSession = session.fromPartition('persist:depot');
    const parsedUrl = new URL(targetUrl);
    let injected = 0;

    if (depot.cookies) {
      const cookieParts = depot.cookies.split(';').map(c => c.trim()).filter(Boolean);
      for (const part of cookieParts) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const name = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        try {
          await depotSession.cookies.set({
            url: parsedUrl.origin,
            name,
            value,
            domain: parsedUrl.hostname,
            path: '/',
          });
          injected++;
        } catch (e) {
          // Some cookies may fail — domain mismatch etc.
        }
      }
    }

    if (depot.token) {
      try {
        await depotSession.cookies.set({
          url: parsedUrl.origin,
          name: 'auth_token',
          value: depot.token,
          domain: parsedUrl.hostname,
          path: '/',
        });
        injected++;
      } catch (e) {}
    }

    if (depot.ciSession) {
      try {
        await depotSession.cookies.set({
          url: parsedUrl.origin,
          name: 'ci_session',
          value: depot.ciSession,
          domain: parsedUrl.hostname,
          path: '/',
        });
        injected++;
      } catch (e) {}
    }

    return { success: true, injected };
  } catch (e) {
    return { success: false, reason: e.message };
  }
});

ipcMain.handle('open-url-in-chrome', async (_event, targetUrl) => {
  try {
    if (!targetUrl) {
      return { success: false, reason: 'missing-url' };
    }

    const parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { success: false, reason: 'invalid-protocol' };
    }
    const safeUrl = parsedUrl.toString();

    const chromePath = findChromeExecutable();
    if (chromePath) {
      const child = spawn(chromePath, [safeUrl], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { success: true, mode: 'chrome', path: chromePath };
    }

    await shell.openExternal(safeUrl);
    return { success: true, mode: 'default-browser' };
  } catch (error) {
    return { success: false, reason: error?.message || String(error) };
  }
});

// ── App Lifecycle ──



/**
 * Express server'in localhost:3000'de hazir olmasini bekler.
 * 200ms arayla polling yapar, max maxWaitMs kadar dener.
 * Timeout olursa false doner ama yine de pencere acilir.
 */
function waitForServer(maxWaitMs, intervalMs) {
  maxWaitMs = maxWaitMs || 15000;
  intervalMs = intervalMs || 200;
  const http = require('http');
  const start = Date.now();
  return new Promise(function(resolve) {
    function tryOnce() {
      const req = http.get(`http://${SERVER_HOST}:3000`, function(res) {
        res.resume();
        console.log('[startup] Express hazir, pencere aciliyor.');
        resolve(true);
      });
      req.on('error', function() {
        const elapsed = Date.now() - start;
        if (elapsed < maxWaitMs) {
          setTimeout(tryOnce, intervalMs);
        } else {
          console.warn('[startup] Express ' + maxWaitMs + 'ms icinde hazir olmadi, yine de devam ediliyor.');
          resolve(false);
        }
      });
      req.setTimeout(500, function() { req.destroy(); });
    }
    tryOnce();
  });
}
app.whenReady().then(() => {
  process.env.ECZANE_CONFIG_PATH = getConfigPath();
  ensureConfigFile();
  console.log(`[config] Electron config: ${process.env.ECZANE_CONFIG_PATH}`);

  setupAutoUpdater();

  // Start Express server in the same process
  require('./src/server.js');

  // Sabit 1000ms beklemek yerine server'in gercekten hazir olmasini bekle
  waitForServer().then(function() {
    createWindow();
    createTray();
    registerShortcuts();
    scheduleUpdateChecks();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('web-contents-created', (event, contents) => {
  contents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Kes', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Kopyala', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Yapıştır', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: 'Tümünü Seç', role: 'selectAll' },
    ]);
    menu.popup();
  });
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
