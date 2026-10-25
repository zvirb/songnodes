import React, { useState, useEffect } from 'react';
import { SnIcon } from '../../../lib/songnodes';
import { Button } from '../../../components/ds';

export const InlineMessage: React.FC<{ status: 'ok' | 'fair' | 'warn' | 'bad' | 'info'; children: React.ReactNode; boxed?: boolean; id?: string }> = ({ status, children, boxed, id }) => {
  const icons: Record<string, string> = { ok: 'check-circle', fair: 'adjustments-horizontal', warn: 'alert-triangle', bad: 'x-circle', info: 'info' };
  return (
    <div id={id} className={`sn-inline-msg sn-inline-msg--${status} ${boxed ? 'sn-inline-msg--boxed' : ''}`} role="status">
       <span className="sn-inline-msg__icon" aria-hidden="true">
         <SnIcon name={icons[status] as any} size={16} />
       </span>
       <span className="sn-inline-msg__text body">{children}</span>
    </div>
  );
};

export const CopyButton: React.FC<{ label: string; what: string; value: string; size?: 'sm' | 'md' }> = ({ label, what, value, size = 'md' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Button size={size} onClick={handleCopy} aria-label={`Copy ${what}`}>
      <SnIcon name={copied ? "check" : "copy"} size={16} className="sn-mr-2" />
      {copied ? "Copied" : label}
    </Button>
  );
};

// Simplified DataTable for this feature
export interface DataTableColumn<T> {
  id: string;
  header: string;
  numeric?: boolean;
  cell: (row: T) => React.ReactNode;
  defaultVisible?: boolean;
  fixed?: boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowId: (row: T) => string;
  caption: string;
  density?: 'compact' | 'comfortable';
}

export function DataTable<T>({ rows, columns, rowId, caption, density = 'comfortable' }: DataTableProps<T>) {
  return (
    <div className="sn-tablebox sn-data-table__box" style={{ maxHeight: '300px', overflowY: 'auto' }}>
      <table className={`sn-table sn-table--${density}`}>
        <caption className="sn-sr">{caption}</caption>
        <thead>
          <tr>
            {columns.map(c => (
               <th key={c.id} scope="col" className={c.numeric ? 'num' : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowId(r)}>
              {columns.map(c => (
                 <td key={c.id} className={c.numeric ? 'num' : undefined}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
