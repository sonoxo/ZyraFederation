/** UNdata SDMX transport. Returns raw XML with provenance; never fabricated records. */
export const BASE_URL = 'https://data.un.org/ws/rest/';
const resources = new Set(['dataflow', 'datastructure', 'codelist', 'data']);

export function buildUrl(resource, segments = [], parameters = {}) {
  if (!resources.has(resource)) throw new Error('Unsupported SDMX resource');
  for (const segment of segments) {
    if (typeof segment !== 'string' || !/^[A-Za-z0-9_.,+@*-]+$/.test(segment) || segment === '.' || segment === '..') {
      throw new Error('Invalid SDMX path segment');
    }
  }
  const url = new URL([resource, ...segments].join('/'), BASE_URL);
  for (const [key, value] of Object.entries(parameters)) {
    if (!['startPeriod', 'endPeriod', 'references', 'detail'].includes(key)) throw new Error('Unsupported query parameter');
    url.searchParams.set(key, String(value));
  }
  return url;
}

export async function fetchSdmx(resource, segments = [], parameters = {}, fetchImpl = fetch) {
  const url = buildUrl(resource, segments, parameters);
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/xml, text/xml;q=0.9' },
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('UNdata HTTP ' + response.status + ' — no data loaded');
  if (!/xml/i.test(response.headers.get('content-type') || '')) throw new Error('UNdata did not return XML');
  const limit = 5 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) throw new Error('UNdata response exceeds 5 MiB');
  if (!response.body) throw new Error('UNdata returned an empty response');
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error('UNdata response exceeds 5 MiB'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  const xml = new TextDecoder().decode(joined);
  if (!xml.trim()) throw new Error('UNdata returned empty XML');
  return { source: 'United Nations UNdata', sourceUrl: url.href, retrievedAt: new Date().toISOString(), format: 'SDMX-XML', xml };
}
