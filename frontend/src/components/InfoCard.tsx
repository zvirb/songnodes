import React from 'react';
import { GraphNode, Track, PerformanceMetrics, Setlist } from '../types';
import { getInfoFields, InfoField } from '../utils/infoCardUtils';
import { X, Copy } from 'lucide-react';

type InfoCardType = 'track' | 'node' | 'performance' | 'stats' | 'setlist';
type InfoCardData = Track | GraphNode | PerformanceMetrics | Setlist | Record<string, any> | undefined;

interface InfoCardProps {
  /** The type of data to display, which determines the card's content and title. */
  type: InfoCardType;
  /** The data object to be displayed in the card. */
  data?: InfoCardData;
  /** The absolute position for the card if it's floating. */
  position?: { x: number; y: number };
  /** An HTML element to anchor the card to. If provided, the card will position itself relative to this element. */
  anchorElement?: HTMLElement;
  /** A callback function to be invoked when the card is closed. */
  onClose?: () => void;
  /** Additional CSS classes to apply to the card. */
  className?: string;
}

/**
 * A versatile card component that displays contextual information for different data types
 * like tracks, nodes, performance metrics, or setlists.
 */
export const InfoCard: React.FC<InfoCardProps> = ({
  type,
  data,
  position,
  anchorElement,
  onClose,
  className = '',
}) => {
  const infoFields = getInfoFields(type, data);

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    // In a real app, you'd show a toast notification here.
    console.log('Copied to clipboard:', value);
  };

  const getCardTitle = () => {
    const titles: Record<InfoCardType, string> = {
      track: 'Track Info',
      node: 'Node Info',
      performance: 'Performance Metrics',
      stats: 'Graph Statistics',
      setlist: 'Setlist Info',
    };
    return titles[type] || 'Information';
  };

  const cardStyle: React.CSSProperties = position ? { position: 'fixed', left: position.x, top: position.y } : {};

  return (
    <div
      className={`w-72 bg-gray-900/80 border border-white/10 rounded-xl shadow-2xl backdrop-blur-lg text-white animate-fade-in ${className}`}
      style={cardStyle}
    >
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="font-semibold text-white/90">{getCardTitle()}</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-full transition-colors">
            <X size={18} />
          </button>
        )}
      </header>
      <main className="p-4 space-y-2">
        {infoFields.map((field) => (
          <div key={field.key} className="flex items-center justify-between text-sm p-2 bg-white/5 rounded-md min-h-[36px]">
            <div className="flex items-center gap-2 text-gray-400">
              {field.icon}
              <span>{field.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white/90">
                {field.formatter ? field.formatter(field.value) : String(field.value)}
              </span>
              {field.copyable && field.value && (
                <button onClick={() => handleCopy(String(field.value))} className="text-gray-500 hover:text-white transition-colors" title="Copy">
                  <Copy size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default InfoCard;