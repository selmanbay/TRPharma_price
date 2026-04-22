const fs = require('fs');
const path = require('path');
const { getConfigPath, getDataFilePath } = require('./config-store');

const STORE_FILE = () => getDataFilePath('local-accounts.json');

function createDefaultStore() {
  return {
    activeAccountId: null,
    accounts: {},
  };
}

function ensureStoreFile() {
  const storePath = STORE_FILE();
  const storeDir = path.dirname(storePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(createDefaultStore(), null, 2), 'utf-8');
  }
  return storePath;
}

function loadAccountStore() {
  const storePath = ensureStoreFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    return {
      activeAccountId: parsed.activeAccountId || null,
      accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
    };
  } catch {
    return createDefaultStore();
  }
}

function saveAccountStore(store) {
  const storePath = ensureStoreFile();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

function getLegacyConfigCandidates() {
  return Array.from(new Set([
    getConfigPath(),
    path.join(__dirname, '..', 'config.json'),
    path.join(__dirname, '..', '..', 'current-modular', 'config.json'),
    path.join(__dirname, '..', '..', '..', 'config.json'),
    path.join(__dirname, '..', 'config.json'),
    path.join(process.cwd(), 'config.json'),
    path.join(process.env.APPDATA || '', 'eczane-app-v2_2', 'config.json'),
  ].filter(Boolean)));
}

function getLegacyAccountStoreCandidates() {
  return Array.from(new Set([
    path.join(process.env.APPDATA || '', 'eczane-app-v2_2', 'data', 'local-accounts.json'),
  ].filter(Boolean)));
}

function loadLegacyDepotConfig() {
  for (const candidate of getLegacyAccountStoreCandidates()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      const activeId = parsed?.activeAccountId;
      const account = activeId ? parsed?.accounts?.[activeId] : null;
      if (account?.depots && typeof account.depots === 'object' && Object.keys(account.depots).length > 0) {
        return account.depots;
      }
    } catch (_) {}
  }

  for (const candidate of getLegacyConfigCandidates()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      if (parsed?.depots && typeof parsed.depots === 'object' && Object.keys(parsed.depots).length > 0) {
        return parsed.depots;
      }
    } catch (_) {}
  }
  return {};
}

function ensureAccountRecord(store, user) {
  const userId = String(user?.userId || '').trim();
  if (!userId) {
    throw new Error('userId gerekli');
  }

  if (!store.accounts[userId]) {
    store.accounts[userId] = {
      user: {
        userId,
        displayName: user?.displayName || 'Eczane',
        role: user?.role || 'admin',
      },
      depots: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const account = store.accounts[userId];
  account.user = {
    ...account.user,
    userId,
    displayName: user?.displayName || account.user?.displayName || 'Eczane',
    role: user?.role || account.user?.role || 'admin',
  };
  account.updatedAt = new Date().toISOString();

  if (!account.depots || typeof account.depots !== 'object') {
    account.depots = {};
  }

  if (Object.keys(account.depots).length === 0) {
    const legacyDepots = loadLegacyDepotConfig();
    if (Object.keys(legacyDepots).length > 0) {
      account.depots = legacyDepots;
    }
  }

  return account;
}

function activateAccount(user) {
  const store = loadAccountStore();
  const account = ensureAccountRecord(store, user);
  store.activeAccountId = account.user.userId;
  saveAccountStore(store);
  return account;
}

function getAccountById(userId) {
  const store = loadAccountStore();
  return store.accounts[userId] || null;
}

function listAccounts() {
  const store = loadAccountStore();
  return Object.values(store.accounts || {});
}

function getActiveAccount() {
  const store = loadAccountStore();
  if (!store.activeAccountId) return null;
  return store.accounts[store.activeAccountId] || null;
}

function getDepotConfigForUser(userId) {
  return getAccountById(userId)?.depots || {};
}

function getActiveDepotConfig() {
  return getActiveAccount()?.depots || {};
}

function saveDepotConnection(userId, depotId, payload) {
  const store = loadAccountStore();
  const account = ensureAccountRecord(store, {
    userId,
    displayName: store.accounts[userId]?.user?.displayName || 'Eczane',
    role: store.accounts[userId]?.user?.role || 'admin',
  });
  account.depots[depotId] = payload;
  account.updatedAt = new Date().toISOString();
  store.activeAccountId = userId;
  saveAccountStore(store);
}

function replaceDepotConfigForUser(userId, depots) {
  const store = loadAccountStore();
  const account = ensureAccountRecord(store, {
    userId,
    displayName: store.accounts[userId]?.user?.displayName || 'Eczane',
    role: store.accounts[userId]?.user?.role || 'admin',
  });
  account.depots = depots && typeof depots === 'object' ? depots : {};
  account.updatedAt = new Date().toISOString();
  store.activeAccountId = userId;
  saveAccountStore(store);
}

function deleteDepotConnection(userId, depotId) {
  const store = loadAccountStore();
  const account = store.accounts[userId];
  if (!account?.depots) return;
  delete account.depots[depotId];
  account.updatedAt = new Date().toISOString();
  saveAccountStore(store);
}

module.exports = {
  activateAccount,
  loadAccountStore,
  saveAccountStore,
  getAccountById,
  listAccounts,
  getActiveAccount,
  getDepotConfigForUser,
  getActiveDepotConfig,
  saveDepotConnection,
  replaceDepotConfigForUser,
  deleteDepotConnection,
};
