import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Attribution, fetchAttributions } from '../utils/attributions';

const STATIC_PROVIDERS: Attribution[] = [
  { provider: 'musicbrainz', text: 'MusicBrainz (tags CC BY-NC-SA 3.0)', url: 'https://musicbrainz.org' },
  { provider: 'getsongbpm', text: 'GetSongBPM', url: 'https://getsongbpm.com' },
  { provider: 'deezer', text: 'Deezer', url: 'https://www.deezer.com' },
  { provider: 'lastfm', text: 'Last.fm', url: 'https://www.last.fm' },
  { provider: 'discogs', text: 'Discogs', url: 'https://www.discogs.com' },
];

export const CreditsFooter: React.FC = () => {
  const location = useLocation();
  const [items, setItems] = useState<Attribution[]>(STATIC_PROVIDERS);

  useEffect(() => {
    const controller = new AbortController();
    fetchAttributions(controller.signal).then(serverAttributions => {
      if (serverAttributions.length === 0) return;
      setItems(prev => {
        const next = [...prev];
        for (const attr of serverAttributions) {
          const idx = next.findIndex(p => p.provider === attr.provider);
          if (idx >= 0) {
            next[idx] = attr;
          } else {
            next.push(attr);
          }
        }
        return next;
      });
    });
    return () => controller.abort();
  }, []);

  if (location.pathname === '/graph') return null;

  return (
    <footer
      aria-label="Data credits"
      className="body-s"
      style={{
        color: 'var(--fg-3)',
        padding: 'var(--space-6) var(--space-4) var(--space-8)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
        justifyContent: 'center'
      }}
    >
      <span>Track data from</span>
      {items.map((item, index) => (
        <React.Fragment key={item.provider}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener"
            className="sn-link sn-link--ext"
          >
            {item.text}
            <span className="sn-sr">, opens in a new tab</span>
          </a>
          {index < items.length - 1 && <span aria-hidden="true">&middot;</span>}
        </React.Fragment>
      ))}
    </footer>
  );
};
