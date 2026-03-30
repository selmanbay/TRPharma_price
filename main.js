const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Prevent Express from opening a browser window
process.env.ECZANE_OPEN_BROWSER = '0';

let mainWindow = null;
let tray = null;
let isQuitting = false;

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
  // Config updater logging (optional but good for debugging)
  autoUpdater.logger = require('console');
  autoUpdater.logger.transports.file.level = 'info';

  // Start Express server in the same process
  require('./src/server.js');

  // Wait a moment for Express to bind to port
  setTimeout(() => {
    createWindow();
    createTray();
    registerShortcuts();
    
    // Check for OTA Updates in the background
    autoUpdater.checkForUpdatesAndNotify().catch(e => {
        console.error("Update check failed: ", e.message);
    });
  }, 1000);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // On Windows, keep app running in tray
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
