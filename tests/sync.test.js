const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage before requiring sync.js
const store = {};
global.localStorage = {
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: k => { delete store[k]; },
};

const { sync } = require('../js/sync.js');

test('queue adds a review to localStorage', () => {
  sync.clear();
  sync.queue({ cardId: 'abc', intervalDays: 6, easeFactor: 2.5, dueDate: '2026-07-20', reviewCount: 1 });
  const pending = sync.getPending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].cardId, 'abc');
});

test('queue appends without overwriting existing entries', () => {
  sync.clear();
  sync.queue({ cardId: 'abc', intervalDays: 1, easeFactor: 2.5, dueDate: '2026-07-14', reviewCount: 1 });
  sync.queue({ cardId: 'def', intervalDays: 6, easeFactor: 2.6, dueDate: '2026-07-20', reviewCount: 2 });
  assert.equal(sync.getPending().length, 2);
});

test('clear empties the queue', () => {
  sync.queue({ cardId: 'xyz', intervalDays: 1, easeFactor: 2.5, dueDate: '2026-07-14', reviewCount: 1 });
  sync.clear();
  assert.equal(sync.getPending().length, 0);
});

test('getPending returns empty array when nothing queued', () => {
  sync.clear();
  assert.deepEqual(sync.getPending(), []);
});
