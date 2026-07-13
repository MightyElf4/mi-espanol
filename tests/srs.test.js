const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateNextReview } = require('../js/srs.js');

test('rating 1 (blackout) resets interval to 1', () => {
  const result = calculateNextReview(1, 10, 2.5);
  assert.equal(result.intervalDays, 1);
});

test('rating 2 (hard) resets interval to 1', () => {
  const result = calculateNextReview(2, 10, 2.5);
  assert.equal(result.intervalDays, 1);
});

test('first correct review (interval=0) sets interval to 1', () => {
  const result = calculateNextReview(3, 0, 2.5);
  assert.equal(result.intervalDays, 1);
});

test('second correct review (interval=1) sets interval to 6', () => {
  const result = calculateNextReview(3, 1, 2.5);
  assert.equal(result.intervalDays, 6);
});

test('subsequent correct review multiplies by ease factor', () => {
  const result = calculateNextReview(3, 6, 2.5);
  assert.equal(result.intervalDays, 15);
});

test('rating 4 (easy) increases ease factor above 2.5', () => {
  const result = calculateNextReview(4, 6, 2.5);
  assert.ok(result.easeFactor > 2.5);
});

test('ease factor never drops below 1.3', () => {
  const result = calculateNextReview(1, 6, 1.3);
  assert.ok(result.easeFactor >= 1.3);
});

test('dueDate is a valid YYYY-MM-DD string', () => {
  const result = calculateNextReview(3, 6, 2.5);
  assert.match(result.dueDate, /^\d{4}-\d{2}-\d{2}$/);
});
