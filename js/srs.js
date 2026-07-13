function calculateNextReview(rating, intervalDays, easeFactor) {
  const quality = { 1: 0, 2: 2, 3: 4, 4: 5 }[rating];
  let newInterval;
  if (quality < 3) {
    newInterval = 1;
  } else if (intervalDays === 0) {
    newInterval = 1;
  } else if (intervalDays === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(intervalDays * easeFactor);
  }
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  const due = new Date();
  due.setDate(due.getDate() + newInterval);
  return {
    intervalDays: newInterval,
    easeFactor: parseFloat(newEaseFactor.toFixed(4)),
    dueDate: due.toISOString().split('T')[0],
  };
}

if (typeof module !== 'undefined') module.exports = { calculateNextReview };
