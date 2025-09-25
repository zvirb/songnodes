import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import Fuse from 'fuse.js';
import clsx from 'clsx';

export const QuickSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { nodes, selectNode } = useStore();

  // Open with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(nodes, {
      keys: ['title', 'artist', 'genre'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [nodes]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return fuse.search(searchQuery).slice(0, 8);
  }, [searchQuery, fuse]);

  const handleSelect = (nodeId: string) => {
    selectNode(nodeId);
    setIsOpen(false);
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-2xl mx-4 bg-dj-dark border border-dj-gray rounded-lg shadow-2xl">
        <div className="p-4 border-b border-dj-gray">
          <input
            type="text"
            placeholder="Quick search... (Press ESC to close)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-white text-lg placeholder-gray-500 focus:outline-none"
            autoFocus
          />
        </div>

        {searchResults.length > 0 && (
          <div className="max-h-96 overflow-y-auto">
            {searchResults.map(({ item }, index) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={clsx(
                  'w-full text-left p-3 hover:bg-dj-gray transition-colors',
                  index === 0 && 'bg-dj-gray'
                )}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white font-medium">{item.title}</div>
                    <div className="text-sm text-gray-400">{item.artist}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.bpm && <span className="mr-2">{item.bpm} BPM</span>}
                    {item.key && <span>{item.key}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No results found
          </div>
        )}

        <div className="p-2 border-t border-dj-gray flex justify-between text-xs text-gray-500">
          <div>
            <kbd className="px-1.5 py-0.5 bg-dj-gray rounded">↑↓</kbd> Navigate
            <kbd className="px-1.5 py-0.5 bg-dj-gray rounded ml-2">Enter</kbd> Select
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-dj-gray rounded">ESC</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
};