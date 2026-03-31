const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, session, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Prevent Express from opening a browser window
process.env.ECZANE_OPEN_BROWSER = '0';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let updateDownloaded = false;
let updateCheckInFlight = false;
let updateCheckInterval = null;

const UPDATE_CHECK_DELAY_MS = 15 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const CONFIG_PATH = path.join(__dirname, 'config.json');
const ICON_PATH = path.join(__dirname, 'renderer', 'assets', 'icons', 'icon.png');
const TRAY_ICON_PATH = path.join(__dirname, 'renderer', 'assets', 'icons', 'tray-icon.png');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
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
    },
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
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

  autoUpdater.on('checking-for-update', () => {
    updateCheckInFlight = true;
    console.log('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: ${info?.version || 'unknown-version'}`);
  });

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInFlight = false;
    console.log(`[updater] No update available. Current latest: ${info?.version || app.getVersion()}`);
  });

  autoUpdater.on('error', (error) => {
    updateCheckInFlight = false;
    console.error('[updater] Error:', error?.message || error);
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = typeof progress?.percent === 'number' ? progress.percent.toFixed(1) : '0.0';
    console.log(`[updater] Downloading update... ${percent}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    updateCheckInFlight = false;
    updateDownloaded = true;
    console.log(`[updater] Update downloaded: ${info?.version || 'unknown-version'}`);

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

ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('get-depot-cookies', (_event, depotId) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const depot = config.depots?.[depotId];
    if (!depot) return null;
    return {
      cookies: depot.cookies || null,
      token: depot.token || null,
      ciSession: depot.ciSession || null,
    };
  } catch {
    return null;
  }
});

ipcMain.handle('inject-depot-cookies', async (_event, depotId, targetUrl) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
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

// ── App Lifecycle ──

app.whenReady().then(() => {
  setupAutoUpdater();

  // Start Express server in the same process
  require('./src/server.js');

  // Wait a moment for Express to bind to port
  setTimeout(() => {
    createWindow();
    createTray();
    registerShortcuts();
    scheduleUpdateChecks();
  }, 1000);
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
  // On Windows, keep app running in tray
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
