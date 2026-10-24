import React, { useEffect, useState } from 'react';
import { Attribution, fetchAttributions } from '../utils/attributions';

/** Renders required provider backlinks; renders nothing when no provider needs one. */
export const Attributions: React.FC = () => {
  const [items, setItems] = useState<Attribution[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAttributions(controller.signal).then(setItems);
    return () => controller.abort();
  }, []);

  if (items.length === 0) return null;

  return (
    <footer
      aria-label="Data provider attributions"
      className="px-3 py-1 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] flex flex-wrap gap-3 items-center"
    >
      {items.map((item) => (
        <a
          key={item.provider}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-link-hover)] transition-colors underline-offset-2 hover:underline"
        >
          {item.text}
        </a>
      ))}
    </footer>
  );
};

export default Attributions;
