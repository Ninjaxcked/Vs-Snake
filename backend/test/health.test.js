const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { startTestServer } = require('../test-utils/server');

test('GET /api/health responde ok', async () => {
  const server = await startTestServer(createApp());
  try {
    const res = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  } finally {
    await server.close();
  }
});
