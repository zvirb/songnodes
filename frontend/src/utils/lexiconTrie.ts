// The task says "Include built-in Camelot key vocabulary (1A-12B) and standard Melbourne music pillars."
const PILLARS = ['House', 'Techno', 'UK garage', 'UKG'];

const CAMELOT_KEYS: string[] = [];
for (let i = 1; i <= 12; i++) {
  CAMELOT_KEYS.push(`${i}A`);
  CAMELOT_KEYS.push(`${i}B`);
}

export interface LexiconWord {
  word: string;
  category?: string;
  weight: number;
}

export class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord = false;
  words: LexiconWord[] = [];
}

export class LexiconTrie {
  root: TrieNode = new TrieNode();

  constructor() {
    this.insertBuiltins();
  }

  private insertBuiltins() {
    for (const k of CAMELOT_KEYS) {
      this.insert(k, 'key', 100);
    }
    for (const p of PILLARS) {
      this.insert(p, 'pillar', 100);
    }
  }

  private normalize(str: string): string {
    return str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  }

  insert(word: string, category?: string, weight: number = 0) {
    const normalized = this.normalize(word);
    if (!normalized) return;

    let node = this.root;
    for (const char of normalized) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;

    const existingIdx = node.words.findIndex(w => w.word === word && w.category === category);
    if (existingIdx >= 0) {
      if (weight > node.words[existingIdx].weight) {
        node.words[existingIdx].weight = weight;
      }
    } else {
      node.words.push({ word, category, weight });
    }
  }

  insertBatch(words: string[]) {
    for (const word of words) {
      this.insert(word);
    }
  }

  searchPrefix(prefix: string, limit: number = 8): { word: string; category?: string }[] {
    const normalizedPrefix = this.normalize(prefix);

    // If empty prefix, just return top items from root.
    let node = this.root;
    if (normalizedPrefix) {
      for (const char of normalizedPrefix) {
        if (!node.children.has(char)) {
          return [];
        }
        node = node.children.get(char)!;
      }
    }

    // Collect all words in the subtree
    const results: LexiconWord[] = [];
    const stack: TrieNode[] = [node];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr.isEndOfWord) {
        results.push(...curr.words);
      }
      for (const child of curr.children.values()) {
        stack.push(child);
      }
    }

    // Rank exact prefix matches first (ignoring case/punctuation), then by weight descending
    results.sort((a, b) => {
      const aNorm = this.normalize(a.word);
      const bNorm = this.normalize(b.word);

      const aExact = aNorm === normalizedPrefix ? 1 : 0;
      const bExact = bNorm === normalizedPrefix ? 1 : 0;

      if (aExact !== bExact) {
        return bExact - aExact; // exact match comes first
      }

      // Then by weight descending
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }

      // Then alphabetical
      return a.word.localeCompare(b.word);
    });

    // Deduplicate
    const uniqueResults: { word: string; category?: string }[] = [];
    const seen = new Set<string>();

    for (const res of results) {
      if (uniqueResults.length >= limit) break;
      const key = `${res.word}|${res.category || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push({ word: res.word, category: res.category });
      }
    }

    return uniqueResults;
  }

  clear() {
    this.root = new TrieNode();
    this.insertBuiltins();
  }
}
