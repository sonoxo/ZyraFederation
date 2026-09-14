import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl, fetchSdmx } from '../connectors/undata.mjs';

test('builds HTTPS SDMX requests and preserves metadata parameters', () => {
  assert.equal(buildUrl('dataflow', ['all', 'all', 'latest'], { references: 'none' }).href,
    'https://data.un.org/ws/rest/dataflow/all/all/latest?references=none');
});
test('rejects unknown endpoints, traversal, external URLs and parameters', () => {
  assert.throws(() => buildUrl('secret'));
  for (const segment of ['..', '.', 'https://example.com', 'a/b', 'a?x=y']) assert.throws(() => buildUrl('data', [segment]));
  assert.throws(() => buildUrl('dataflow', [], { callback: 'x' }));
});
test('returns raw XML and provenance', async () => {
  const result = await fetchSdmx('dataflow', [], {}, async (url, options) => {
    assert.equal(url.hostname, 'data.un.org');
    assert.equal(options.redirect, 'error');
    return new Response('<Structure/>', { headers: { 'content-type': 'application/xml' } });
  });
  assert.equal(result.xml, '<Structure/>');
  assert.equal(result.source, 'United Nations UNdata');
  assert.ok(Number.isFinite(Date.parse(result.retrievedAt)));
});
test('does not turn upstream errors into fabricated success', async () => {
  await assert.rejects(fetchSdmx('dataflow', [], {}, async () => new Response('error', { status: 500 })), /HTTP 500/);
  await assert.rejects(fetchSdmx('dataflow', [], {}, async () => new Response('<html/>', { headers: { 'content-type': 'text/html' } })), /did not return XML/);
  await assert.rejects(fetchSdmx('dataflow', [], {}, async () => { throw new Error('network failure'); }), /network failure/);
});
test('rejects empty and oversized payloads', async () => {
  await assert.rejects(fetchSdmx('dataflow', [], {}, async () => new Response('', { headers: { 'content-type': 'application/xml' } })), /empty XML/);
  await assert.rejects(fetchSdmx('dataflow', [], {}, async () => new Response('x'.repeat(5*1024*1024+1), { headers: { 'content-type': 'application/xml' } })), /exceeds/);
});
