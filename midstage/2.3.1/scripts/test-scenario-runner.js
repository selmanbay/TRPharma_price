const { createTestToken } = require('./test-auth');

const BASE_URL = process.env.ECZANE_TEST_BASE_URL || 'http://localhost:3000';

function getArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

async function callApi(path, { method = 'GET', body = null, token } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const options = { method, headers };
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { ok: response.ok, status: response.status, payload };
}

async function runSearchBasicScenario(token) {
  const sessionId = getArg('--session', `search-basic-${Date.now()}`);
  const query = getArg('--query', '8683060010220');
  const depotId = getArg('--depot', 'selcuk');

  const sessionStart = await callApi('/api/test/session/start', {
    method: 'POST',
    body: {
      sessionId,
      scenario: 'search-basic',
      note: `query=${query} depot=${depotId}`,
      relayClientLogs: true,
    },
    token,
  });

  const searchResult = await callApi(`/api/search-depot?q=${encodeURIComponent(query)}&depotId=${encodeURIComponent(depotId)}`, { token });
  const clientLogs = await callApi(`/api/test/client-log?sessionId=${encodeURIComponent(sessionId)}`, { token });

  const summary = {
    ok: sessionStart.ok && searchResult.ok && Array.isArray(searchResult.payload?.results),
    scenario: 'search-basic',
    sessionId,
    depotId,
    query,
    searchStatus: searchResult.status,
    resultCount: Array.isArray(searchResult.payload?.results) ? searchResult.payload.results.length : 0,
    clientLogCount: clientLogs.payload?.count || 0,
    sessionStart: sessionStart.payload,
    search: searchResult.payload,
    clientLogs: clientLogs.payload,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

async function main() {
  const scenario = process.argv[2] || 'search-basic';
  const token = createTestToken(getArg('--display-name', 'Codex Scenario Runner'));

  if (scenario === 'search-basic') {
    await runSearchBasicScenario(token);
    return;
  }

  throw new Error(`Bilinmeyen senaryo: ${scenario}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
