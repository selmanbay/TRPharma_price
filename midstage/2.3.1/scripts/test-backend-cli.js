const { createTestToken, buildAuthHeaders } = require('./test-auth');

const BASE_URL = process.env.ECZANE_TEST_BASE_URL || 'http://localhost:3000';

function getArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseBodyArg() {
  const raw = getArg('--body', '');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`--body JSON parse edilemedi: ${error.message}`);
  }
}

async function callApi(path, { method = 'GET', body = null, token } = {}) {
  const headers = {
    ...buildAuthHeaders(token),
  };

  const options = { method, headers };
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    payload,
  };
}

function printResult(result, meta = {}) {
  const output = {
    ok: result.ok,
    status: result.status,
    elapsedMs: result.elapsedMs,
    ...meta,
    payload: result.payload,
  };

  if (hasFlag('--json')) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const label = result.ok ? '[PASS]' : '[FAIL]';
  console.log(`${label} ${meta.command || 'command'}`);
  if (meta.sessionId) console.log(`session: ${meta.sessionId}`);
  if (meta.query) console.log(`query: ${meta.query}`);
  if (meta.depotId) console.log(`depot: ${meta.depotId}`);
  console.log(`status: ${result.status}`);
  console.log(`elapsedMs: ${result.elapsedMs}`);
  console.log(JSON.stringify(result.payload, null, 2));
}

async function main() {
  const command = process.argv[2] || 'health';
  const token = createTestToken(getArg('--display-name', 'Codex V2.2 Test'));

  if (command === 'health') {
    const result = await callApi('/api/health', { token });
    printResult(result, { command });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'session-start') {
    const sessionId = getArg('--session', `v22-${Date.now()}`);
    const body = {
      sessionId,
      scenario: getArg('--scenario', ''),
      note: getArg('--note', ''),
      relayClientLogs: !hasFlag('--no-relay'),
    };
    const result = await callApi('/api/test/session/start', { method: 'POST', body, token });
    printResult(result, { command, sessionId });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'session-current') {
    const result = await callApi('/api/test/session/current', { token });
    printResult(result, { command });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'client-logs') {
    const sessionId = getArg('--session', '');
    const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    const result = await callApi(`/api/test/client-log${suffix}`, { token });
    printResult(result, { command, sessionId });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'client-log-add') {
    const sessionId = getArg('--session', '');
    if (!sessionId) {
      throw new Error('client-log-add icin --session gerekli');
    }
    const body = {
      sessionId,
      source: getArg('--source', 'cli'),
      type: getArg('--type', 'manual-log'),
      message: getArg('--message', 'manual client log'),
      meta: parseBodyArg() || {},
      timestamp: Date.now(),
    };
    const result = await callApi('/api/test/client-log', { method: 'POST', body, token });
    printResult(result, { command, sessionId });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'client-logs-clear') {
    const sessionId = getArg('--session', '');
    const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    const result = await callApi(`/api/test/client-log${suffix}`, { method: 'DELETE', token });
    printResult(result, { command, sessionId });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'search-depot') {
    const query = getArg('--query', process.argv[3] || '8683060010220');
    const depotId = getArg('--depot', process.argv[4] || 'selcuk');
    const result = await callApi(`/api/search-depot?q=${encodeURIComponent(query)}&depotId=${encodeURIComponent(depotId)}`, { token });
    printResult(result, { command, query, depotId });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'test-login') {
    const depotId = getArg('--depot', process.argv[3] || 'selcuk');
    const body = parseBodyArg() || { depotId, credentials: {} };
    if (!body.depotId) body.depotId = depotId;
    const result = await callApi('/api/test-login', { method: 'POST', body, token });
    printResult(result, { command, depotId: body.depotId });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'quote-option') {
    const body = parseBodyArg();
    if (!body) {
      throw new Error('quote-option icin --body gerekli');
    }
    const result = await callApi('/api/quote-option', { method: 'POST', body, token });
    printResult(result, { command, depotId: body.depotId || '' });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  throw new Error(`Bilinmeyen komut: ${command}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
