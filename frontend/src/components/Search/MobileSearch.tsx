import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSearch: React.FC<MobileSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: '100vh' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100vh' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#0f172a', // dark-bg-primary
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #1e293b' }}>
            <button onClick={onClose} style={{ color: 'white', marginRight: '0.75rem', background: 'none', border: 'none', fontSize: '1.5rem' }}>
              ←
            </button>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists, tracks, venues..."
              autoFocus
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '1.125rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Search Content (Suggestions, Filters, etc.) */}
          <div style={{ padding: '1rem', color: 'gray' }}>
            <p>Search suggestions and filters will appear here.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
