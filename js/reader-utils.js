// Pure helpers for the tap-a-word reader. No DOM, no Supabase — unit tested.

const READER_WORD = /[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+/g;

function normalizeWord(raw) {
  const stripped = (raw || '')
    .toLowerCase()
    .replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/g, '');
  return /^[a-záéíóúüñ]+$/.test(stripped) ? stripped : '';
}

// → [{ s: string, w: isWord, i: charOffset }], concatenation of s reproduces text
function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  let last = 0;
  for (const m of text.matchAll(READER_WORD)) {
    if (m.index > last) tokens.push({ s: text.slice(last, m.index), w: false, i: last });
    tokens.push({ s: m[0], w: true, i: m.index });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ s: text.slice(last), w: false, i: last });
  return tokens;
}

function sentenceAt(text, offset) {
  const parts = text.split(/(?<=[.!?…])\s+/);
  let pos = 0;
  for (const part of parts) {
    const start = text.indexOf(part, pos);
    if (offset >= start && offset < start + part.length) return part.trim();
    pos = start + part.length;
  }
  return text.trim();
}

function escapeHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (typeof module !== 'undefined') module.exports = { normalizeWord, tokenize, sentenceAt, escapeHtml };
