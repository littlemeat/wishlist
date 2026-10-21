const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/wishlist-core.js');

test('sortItems keeps available gifts first, then uses position and creation time', () => {
  const items = [
    { id: 'reserved', reserved: true, position: 1, created_at: '2026-01-01' },
    { id: 'later', reserved: false, position: 20, created_at: '2026-01-03' },
    { id: 'earlier', reserved: false, position: 20, created_at: '2026-01-02' },
    { id: 'first', reserved: false, position: 10, created_at: '2026-01-04' },
  ];

  const sorted = core.sortItems(items);

  assert.deepEqual(sorted.map((item) => item.id), ['first', 'earlier', 'later', 'reserved']);
  assert.deepEqual(items.map((item) => item.id), ['reserved', 'later', 'earlier', 'first']);
});

test('allTags de-duplicates tags and sorts them using Czech collation', () => {
  const tags = core.allTags([
    { tags: ['home', 'beauty'] },
    { tags: ['outdoor', 'home'] },
    { tags: null },
  ]);

  assert.deepEqual(tags, ['beauty', 'home', 'outdoor']);
});

test('filterItems returns every gift for the all filter and only matching gifts otherwise', () => {
  const items = [
    { id: 'home', tags: ['home'] },
    { id: 'both', tags: ['home', 'beauty'] },
    { id: 'none', tags: [] },
  ];

  assert.equal(core.filterItems(items, null), items);
  assert.deepEqual(core.filterItems(items, 'beauty').map((item) => item.id), ['both']);
  assert.deepEqual(core.filterItems(items, 'outdoor'), []);
});

test('pickUnreserved never selects a reserved gift and handles an empty pool', () => {
  const items = [
    { id: 'first', reserved: false },
    { id: 'reserved', reserved: true },
    { id: 'last', reserved: false },
  ];

  assert.equal(core.pickUnreserved(items, () => 0).id, 'first');
  assert.equal(core.pickUnreserved(items, () => 0.99).id, 'last');
  assert.equal(core.pickUnreserved([{ id: 'reserved', reserved: true }], () => 0), null);
});
