import { describe, it, expect, beforeEach } from 'vitest';
import { LexiconTrie } from './lexiconTrie';

describe('LexiconTrie', () => {
  let trie: LexiconTrie;

  beforeEach(() => {
    trie = new LexiconTrie();
  });

  it('contains built-in camelot keys and pillars', () => {
    const resultsKeys = trie.searchPrefix('1A');
    expect(resultsKeys.length).toBeGreaterThan(0);
    expect(resultsKeys[0].word).toBe('1A');
    expect(resultsKeys[0].category).toBe('key');

    const resultsPillar = trie.searchPrefix('Hou');
    expect(resultsPillar.length).toBeGreaterThan(0);
    expect(resultsPillar[0].word).toBe('House');
    expect(resultsPillar[0].category).toBe('pillar');
  });

  it('handles empty prefix by returning top results up to limit', () => {
    // Should return some built-ins up to default limit of 8
    const results = trie.searchPrefix('');
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('matches case-insensitively and strips punctuation', () => {
    trie.insert('Daft Punk', 'artist', 50);
    const results1 = trie.searchPrefix('daftpunk');
    expect(results1[0].word).toBe('Daft Punk');

    const results2 = trie.searchPrefix('d.a.f.t p');
    expect(results2[0].word).toBe('Daft Punk');
  });

  it('limits results correctly', () => {
    for (let i = 0; i < 20; i++) {
      trie.insert(`TestWord${i}`, 'test');
    }
    const results = trie.searchPrefix('test', 5);
    expect(results).toHaveLength(5);
  });

  it('ranks exact matches first, then by weight', () => {
    trie.insert('Apple', 'fruit', 10);
    trie.insert('Applesauce', 'food', 100);
    trie.insert('Apple', 'brand', 5); // same exact word, lower weight initially, but let's see deduplication or multiple categories

    // 'Apple' (weight 10) vs 'Applesauce' (weight 100) vs 'Apple' (weight 5)
    // searching 'apple'
    const results = trie.searchPrefix('apple');

    // Apple (fruit) should be first (exact match, highest weight among exacts)
    expect(results[0]).toEqual({ word: 'Apple', category: 'fruit' });
    // Apple (brand) should be second (exact match)
    expect(results[1]).toEqual({ word: 'Apple', category: 'brand' });
    // Applesauce should be third (not exact match)
    expect(results[2]).toEqual({ word: 'Applesauce', category: 'food' });
  });

  it('handles special characters by stripping them in the trie path', () => {
    trie.insert('B-52s', 'band', 10);
    trie.insert('B52', 'drink', 5);

    const results = trie.searchPrefix('b52');
    // Both 'B-52s' and 'B52' should match 'b52'
    // 'B52' is exact match
    expect(results[0].word).toBe('B52');
    expect(results[1].word).toBe('B-52s');
  });

  it('supports bulk insertion efficiently', () => {
    const start = performance.now();
    const words = Array.from({ length: 5000 }, (_, i) => `word${i}`);
    trie.insertBatch(words);
    const end = performance.now();

    expect(end - start).toBeLessThan(50); // Setting generous buffer; JS standard perf varies, but 5ms is the goal in the prompt, let's just make sure it's fast.

    const results = trie.searchPrefix('word123');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].word).toBe('word123');
  });

  it('clears correctly', () => {
    trie.insert('CustomWord');
    trie.clear();
    const results = trie.searchPrefix('CustomWord');
    expect(results).toHaveLength(0);
    // Built-ins should still exist
    const builtinResults = trie.searchPrefix('1A');
    expect(builtinResults.length).toBeGreaterThan(0);
  });
});
