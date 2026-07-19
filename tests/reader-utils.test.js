const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWord, tokenize, sentenceAt, escapeHtml } = require('../js/reader-utils.js');

test('normalizeWord lowercases and strips edge punctuation, keeps accents/ñ/ü', () => {
  assert.equal(normalizeWord('¿Tuviera,'), 'tuviera');
  assert.equal(normalizeWord('"Ñoño!"'), 'ñoño');
  assert.equal(normalizeWord('pingüino.'), 'pingüino');
  assert.equal(normalizeWord('Él'), 'él');
});

test('normalizeWord returns empty string when nothing letter-like remains', () => {
  assert.equal(normalizeWord('123'), '');
  assert.equal(normalizeWord('—'), '');
  assert.equal(normalizeWord(''), '');
  assert.equal(normalizeWord(null), '');
});

test('normalizeWord does not strip interior punctuation-adjacent letters', () => {
  assert.equal(normalizeWord('¡¿"día?!»'), 'día');
});

test('tokenize splits words and non-words preserving the full text', () => {
  const tokens = tokenize('Hola, ¿qué tal?');
  assert.equal(tokens.map(t => t.s).join(''), 'Hola, ¿qué tal?');
  assert.deepEqual(tokens.filter(t => t.w).map(t => t.s), ['Hola', 'qué', 'tal']);
});

test('tokenize records char offsets', () => {
  const tokens = tokenize('Yo canto.');
  const canto = tokens.find(t => t.s === 'canto');
  assert.equal(canto.i, 3);
  assert.equal(canto.w, true);
});

test('tokenize handles empty and word-free strings', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('… 123 —').filter(t => t.w), []);
});

test('sentenceAt returns the sentence containing the offset', () => {
  const text = 'Fui al mercado. Compré arroz y frijoles. Volví a casa.';
  assert.equal(sentenceAt(text, text.indexOf('arroz')), 'Compré arroz y frijoles.');
  assert.equal(sentenceAt(text, 0), 'Fui al mercado.');
  assert.equal(sentenceAt(text, text.indexOf('Volví')), 'Volví a casa.');
});

test('sentenceAt returns whole text when there are no terminators', () => {
  assert.equal(sentenceAt('sin puntuación final', 5), 'sin puntuación final');
});

test('escapeHtml escapes angle brackets, quotes, ampersands', () => {
  assert.equal(escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
  assert.equal(escapeHtml('normal ñ'), 'normal ñ');
});
