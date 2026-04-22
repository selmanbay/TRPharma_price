const fs = require('fs');
const path = require('path');

// In-memory config cache: disk IO'yu azaltir
let _configCache = null;

const PROJECT_ROOT_CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const PROJECT_ROOT_DATA_DIR = path.join(__dirname, '..', 'data');
const LEGACY_V22_USERDATA_DIR = path.join(process.env.APPDATA || '', 'eczane-app-v2_2');

function getElectronConfigPath() {
  try {
    const { app } = require('electron');
    if (app) {
      return path.join(app.getPath('userData'), 'config.json');
    }
  } catch {}
  return null;
}

function getConfigPath() {
  return process.env.ECZANE_CONFIG_PATH || getElectronConfigPath() || PROJECT_ROOT_CONFIG_PATH;
}

function getUserDataDir() {
  const configPath = getConfigPath();
  return path.dirname(configPath);
}

function getDataFilePath(fileName) {
  const userDataDir = path.join(getUserDataDir(), 'data');
  return path.join(userDataDir, fileName);
}

function ensureDataFile(fileName, fallbackData) {
  const dataPath = getDataFilePath(fileName);
  const dataDir = path.dirname(dataPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dataPath)) {
    return dataPath;
  }

  const legacyCandidates = [
    path.join(PROJECT_ROOT_DATA_DIR, fileName),
    path.join(process.cwd(), 'data', fileName),
    path.join(LEGACY_V22_USERDATA_DIR, 'data', fileName),
  ];

  for (const candidate of legacyCandidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      fs.copyFileSync(candidate, dataPath);
      return dataPath;
    } catch {}
  }

  fs.writeFileSync(dataPath, JSON.stringify(fallbackData, null, 2), 'utf-8');
  return dataPath;
}

function getLegacyConfigCandidates(targetPath) {
  const candidates = [
    PROJECT_ROOT_CONFIG_PATH,
    path.join(process.cwd(), 'config.json'),
    path.join(LEGACY_V22_USERDATA_DIR, 'config.json'),
  ];

  return Array.from(new Set(candidates.filter((candidate) => candidate && candidate !== targetPath)));
}

function ensureConfigFile() {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  for (const candidate of getLegacyConfigCandidates(configPath)) {
    if (!fs.existsSync(candidate)) continue;
    try {
      fs.copyFileSync(candidate, configPath);
      return configPath;
    } catch {}
  }

  fs.writeFileSync(configPath, JSON.stringify({ depots: {} }, null, 2), 'utf-8');
  return configPath;
}

function loadConfig() {
  if (_configCache) return _configCache;
  const configPath = ensureConfigFile();
  try {
    _configCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return _configCache;
  } catch (e) {
    console.error('Config okuma hatasi:', e.message);
    return { depots: {} };
  }
}

function saveConfig(config) {
  _configCache = config; // Once cache'i guncelle
  const configPath = ensureConfigFile();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/** Cache'i gecersiz kilar — bir sonraki loadConfig() disk'ten okuyacak */
function invalidateConfigCache() {
  _configCache = null;
}

module.exports = {
  ensureConfigFile,
  ensureDataFile,
  getConfigPath,
  getDataFilePath,
  loadConfig,
  saveConfig,
  invalidateConfigCache,
};
