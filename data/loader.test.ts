import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DataLoader, type NadacRecord } from './loader.ts';

const FIXTURE_FPL = {
  year: 2026,
  source: { citation: '91 FR 1797' },
  guidelines: {
    '48states_dc': { label: '48 states', base: 15960, increment: 5680, note: '', bySize: { 1: 15960, 2: 21640 } },
  },
};

const FIXTURE_NADAC: NadacRecord[] = [
  {
    ndc: '12345000111',
    description: 'TEST DRUG 10MG',
    pricePerUnit: 1.2345,
    unit: 'EA',
    effectiveDate: '09/01/2026',
    pharmacyTypeIndicator: 'C/I',
    otc: false,
    classificationForRateSetting: 'B',
  },
];

function fixtureFetcher(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    const path = url.split('/').slice(4).join('/'); // strip "http://fixture/base/"
    if (!(path in routes)) throw new Error(`no fixture for ${path}`);
    return routes[path];
  };
  return { fetcher, calls };
}

test('loadFpl returns parsed FPL doc', async () => {
  const { fetcher } = fixtureFetcher({ 'fpl-2026.json': FIXTURE_FPL });
  const loader = new DataLoader('http://fixture/base', fetcher);
  const doc = await loader.loadFpl();
  assert.equal(doc.year, 2026);
  assert.equal(doc.guidelines['48states_dc'].base, 15960);
});

test('ndcShardPrefix takes the first 5 digits of the NDC', () => {
  const loader = new DataLoader('http://fixture/base', async () => ({}));
  assert.equal(loader.ndcShardPrefix('12345000111'), '12345');
});

test('loadNadacForNdc fetches the right shard and finds the record', async () => {
  const { fetcher, calls } = fixtureFetcher({ 'nadac/12345.json': FIXTURE_NADAC });
  const loader = new DataLoader('http://fixture/base', fetcher);
  const rec = await loader.loadNadacForNdc('12345000111');
  assert.equal(rec?.pricePerUnit, 1.2345);
  assert.deepEqual(calls, ['http://fixture/base/nadac/12345.json']);
});

test('loadNadacForNdc returns undefined for an NDC not in its shard', async () => {
  const { fetcher } = fixtureFetcher({ 'nadac/99999.json': [] });
  const loader = new DataLoader('http://fixture/base', fetcher);
  const rec = await loader.loadNadacForNdc('99999000111');
  assert.equal(rec, undefined);
});

test('a shard is only fetched once even when requested twice (cache hit)', async () => {
  const { fetcher, calls } = fixtureFetcher({ 'fpl-2026.json': FIXTURE_FPL });
  const loader = new DataLoader('http://fixture/base', fetcher);
  await loader.loadFpl();
  await loader.loadFpl();
  assert.equal(calls.length, 1);
});
