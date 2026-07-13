const SYNC_KEY = 'pending_sync';

const sync = {
  queue(review) {
    const pending = JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
    pending.push({ ...review, queued_at: new Date().toISOString() });
    localStorage.setItem(SYNC_KEY, JSON.stringify(pending));
  },

  getPending() {
    return JSON.parse(localStorage.getItem(SYNC_KEY) || '[]');
  },

  clear() {
    localStorage.removeItem(SYNC_KEY);
  },

  async flush() {
    const pending = this.getPending();
    if (pending.length === 0) return;

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    for (const review of pending) {
      const { error } = await sb
        .from('vocab_cards')
        .update({
          interval_days: review.intervalDays,
          ease_factor: review.easeFactor,
          due_date: review.dueDate,
          review_count: review.reviewCount,
        })
        .eq('id', review.cardId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Sync failed for card', review.cardId, error);
        return;
      }
    }
    this.clear();
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => sync.flush());
}

if (typeof module !== 'undefined') module.exports = { sync };
