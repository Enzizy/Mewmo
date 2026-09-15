import assert from 'node:assert/strict';
import test from 'node:test';

process.env.VERCEL = '1';
const { handleRequest } = await import('./index.mjs');

test('protected endpoints fail closed when the server token is missing', async () => {
  await withTokens(undefined, undefined, async () => {
    const response = await request('/not-found');
    assert.equal(response.status, 503);
    assert.equal(response.body.error, 'API access is not configured on the server.');
  });
});

test('protected endpoints reject a wrong bearer token', async () => {
  await withTokens('correct-token', undefined, async () => {
    const response = await request('/ready', 'wrong-token');
    assert.equal(response.status, 401);
  });
});

test('protected endpoints accept the configured bearer token', async () => {
  await withTokens('correct-token', undefined, async () => {
    const response = await request('/ready', 'correct-token');
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
  });
});

test('voice transcription and chat reject unauthenticated requests before processing', async () => {
  await withTokens('correct-token', undefined, async () => {
    for (const path of ['/transcribe', '/chat']) {
      const response = await request(path, undefined, 'POST');
      assert.equal(response.status, 401);
    }
  });
});

test('health reports whether API access protection is configured', async () => {
  await withTokens('correct-token', undefined, async () => {
    const response = await request('/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.authConfigured, true);
  });
});

async function withTokens(serverToken, publicToken, run) {
  const previousLifeDeskServer = process.env.LIFEDESK_CLIENT_TOKEN;
  const previousLifeDeskPublic = process.env.EXPO_PUBLIC_LIFEDESK_CLIENT_TOKEN;
  const previousServer = process.env.MEWMO_CLIENT_TOKEN;
  const previousPublic = process.env.EXPO_PUBLIC_MEWMO_CLIENT_TOKEN;
  setOrDelete('LIFEDESK_CLIENT_TOKEN', serverToken);
  setOrDelete('EXPO_PUBLIC_LIFEDESK_CLIENT_TOKEN', publicToken);
  setOrDelete('MEWMO_CLIENT_TOKEN', undefined);
  setOrDelete('EXPO_PUBLIC_MEWMO_CLIENT_TOKEN', undefined);
  try { await run(); }
  finally {
    setOrDelete('LIFEDESK_CLIENT_TOKEN', previousLifeDeskServer);
    setOrDelete('EXPO_PUBLIC_LIFEDESK_CLIENT_TOKEN', previousLifeDeskPublic);
    setOrDelete('MEWMO_CLIENT_TOKEN', previousServer);
    setOrDelete('EXPO_PUBLIC_MEWMO_CLIENT_TOKEN', previousPublic);
  }
}

function request(url, token, method = 'GET') {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const request = { method, url, headers, socket: { remoteAddress: '127.0.0.1' } };
  return new Promise((resolve) => {
    const response = {
      headers: {},
      statusCode: 0,
      setHeader(name, value) { this.headers[name] = value; },
      end(value) { resolve({ status: this.statusCode, body: value ? JSON.parse(value) : null, headers: this.headers }); },
    };
    void handleRequest(request, response);
  });
}

function setOrDelete(key, value) {
  if (value == null) delete process.env[key];
  else process.env[key] = value;
}
