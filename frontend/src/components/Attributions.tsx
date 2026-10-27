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
    <footer aria-label="Data provider attributions" style={{ padding: '4px 12px', fontSize: 12, opacity: 0.8 }}>
      {items.map((item) => (
        <a key={item.provider} href={item.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 12 }}>
          {item.text}
        </a>
      ))}
    </footer>
  );
};

export default Attributions;
