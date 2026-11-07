import React, { useMemo, useState, useCallback } from 'react';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  numeric?: boolean;
  sortValue?: (row: T) => string | number | null;
  cell: (row: T) => React.ReactNode;
  defaultVisible?: boolean;
  fixed?: boolean;
  stackLabel?: string;
  title?: string;
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowId: (row: T) => string;
  caption: string;
  sort?: { column: string; direction: 'ascending' | 'descending' };
  onSortChange?: (sort: { column: string; direction: 'ascending' | 'descending' }) => void;
  tiebreak?: (row: T) => string;
  selected?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  groupBy?: (row: T) => string;
  groups?: { key: string; label: string }[];
  isFlagged?: (row: T) => boolean;
  isNow?: (row: T) => boolean;
  rowActions?: (row: T) => React.ReactNode;
  bulkActions?: (ids: Set<string>) => React.ReactNode;
  density?: 'comfortable' | 'compact';
  onDensityChange?: (d: 'comfortable' | 'compact') => void;
  visibleColumns?: string[];
  onVisibleColumnsChange?: (cols: string[]) => void;
  state?: 'data' | 'loading' | 'empty' | 'error';
  emptyMessage?: { title: string; body: string; action?: React.ReactNode };
  errorMessage?: { title: string; body: string; action?: React.ReactNode };
  maxHeight?: string;
  keyboard?: boolean;
  activeRowId?: string;
  onActiveRowChange?: (id: string) => void;
  onRowOpen?: (row: T) => void;
  rowShortcuts?: Record<string, (row: T) => void>;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowId,
  caption,
  sort,
  onSortChange,
  tiebreak,
  selected,
  onSelectionChange,
  density = 'comfortable',
  onDensityChange,
  visibleColumns,
  state = 'data',
  emptyMessage,
  errorMessage,
  maxHeight = '480px',
  keyboard = false,
  activeRowId,
  onActiveRowChange,
  onRowOpen,
  rowActions,
  bulkActions,
  className = '',
}: DataTableProps<T>): React.ReactElement {
  // Local sort state if uncontrolled
  const [internalSort, setInternalSort] = useState<{ column: string; direction: 'ascending' | 'descending' } | undefined>(sort);
  const activeSort = sort !== undefined ? sort : internalSort;

  const handleHeaderClick = useCallback((colId: string) => {
    let nextSort: { column: string; direction: 'ascending' | 'descending' };
    if (activeSort?.column === colId) {
      nextSort = {
        column: colId,
        direction: activeSort.direction === 'ascending' ? 'descending' : 'ascending',
      };
    } else {
      nextSort = { column: colId, direction: 'ascending' };
    }
    if (onSortChange) {
      onSortChange(nextSort);
    } else {
      setInternalSort(nextSort);
    }
  }, [activeSort, onSortChange]);

  const activeCols = useMemo(() => {
    if (!visibleColumns) {
      return columns.filter((c) => c.defaultVisible !== false);
    }
    const set = new Set(visibleColumns);
    return columns.filter((c) => c.fixed || set.has(c.id));
  }, [columns, visibleColumns]);

  const sortedRows = useMemo(() => {
    if (!activeSort) return rows;
    const col = columns.find((c) => c.id === activeSort.column);
    if (!col || !col.sortValue) return rows;

    const mul = activeSort.direction === 'ascending' ? 1 : -1;
    const getSortVal = col.sortValue;

    return [...rows].sort((a, b) => {
      const va = getSortVal(a);
      const vb = getSortVal(b);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (va < vb) return -mul;
      if (va > vb) return mul;
      if (tiebreak) {
        const ta = tiebreak(a);
        const tb = tiebreak(b);
        if (ta < tb) return -1;
        if (ta > tb) return 1;
      }
      return 0;
    });
  }, [rows, columns, activeSort, tiebreak]);

  const allSelected = useMemo(() => {
    if (!selected || rows.length === 0) return false;
    return rows.every((r) => selected.has(rowId(r)));
  }, [selected, rows, rowId]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(new Set(rows.map(rowId)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    onSelectionChange(next);
  };

  const totalCols = (onSelectionChange ? 1 : 0) + activeCols.length + (rowActions ? 1 : 0);

  return (
    <div className={`sn-data-table sn-data-table--stack ${className}`.trim()} data-density={density}>
      <div className="sn-data-table__bar">
        <span className="sn-data-table__count" aria-live="polite">
          {rows.length} {rows.length === 1 ? 'record' : 'records'}
        </span>
        {selected && selected.size > 0 && bulkActions ? (
          <div className="sn-data-table__bulk">{bulkActions(selected)}</div>
        ) : null}
        <div className="sn-data-table__bar-end">
          {onDensityChange ? (
            <div className="sn-seg" role="group" aria-label="Row density">
              <button
                type="button"
                aria-pressed={density === 'comfortable'}
                onClick={() => onDensityChange('comfortable')}
              >
                Comfortable
              </button>
              <button
                type="button"
                aria-pressed={density === 'compact'}
                onClick={() => onDensityChange('compact')}
              >
                Compact
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="sn-tablebox sn-data-table__box"
        style={{ maxHeight }}
        tabIndex={keyboard ? 0 : undefined}
        data-keyboard={keyboard ? '' : undefined}
      >
        <table className="sn-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {onSelectionChange ? (
                <th scope="col" className="sn-data-table__sel">
                  <input
                    type="checkbox"
                    aria-label={`Select all ${rows.length} records`}
                    checked={allSelected}
                    disabled={state !== 'data' || rows.length === 0}
                    onChange={handleSelectAll}
                  />
                </th>
              ) : null}
              {activeCols.map((c) => {
                const isSorted = activeSort?.column === c.id;
                const dir = isSorted ? activeSort.direction : undefined;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    className={c.numeric ? 'num' : undefined}
                    data-sortable={c.sortValue ? '' : undefined}
                    aria-sort={dir}
                    title={c.title}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        data-sort={c.id}
                        onClick={() => handleHeaderClick(c.id)}
                      >
                        {c.header}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions ? (
                <th scope="col" className="sn-data-table__actions">
                  <span className="sn-sr">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' ? (
              <tr className="sn-data-table__state" aria-busy="true">
                <td colSpan={totalCols} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--fg-3)' }}>
                    <span className="sn-spinner" aria-hidden="true" />
                    <span>Loading records…</span>
                  </div>
                </td>
              </tr>
            ) : state === 'empty' ? (
              <tr className="sn-data-table__state">
                <td colSpan={totalCols} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                  <div style={{ color: 'var(--fg-2)' }}>{emptyMessage?.title || 'No records found'}</div>
                  {emptyMessage?.body ? <p style={{ color: 'var(--fg-3)', marginTop: 'var(--space-1)' }}>{emptyMessage.body}</p> : null}
                  {emptyMessage?.action ? <div style={{ marginTop: 'var(--space-3)' }}>{emptyMessage.action}</div> : null}
                </td>
              </tr>
            ) : state === 'error' ? (
              <tr className="sn-data-table__state">
                <td colSpan={totalCols} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                  <div role="alert">
                    <div style={{ color: 'var(--status-bad)', fontWeight: 600 }}>{errorMessage?.title || 'Failed to load records'}</div>
                    {errorMessage?.body ? <p style={{ color: 'var(--fg-3)', marginTop: 'var(--space-1)' }}>{errorMessage.body}</p> : null}
                    {errorMessage?.action ? <div style={{ marginTop: 'var(--space-3)' }}>{errorMessage.action}</div> : null}
                  </div>
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const id = rowId(row);
                const isSel = selected?.has(id);
                const isAct = activeRowId === id;

                return (
                  <tr
                    key={id}
                    data-selected={isSel ? '' : undefined}
                    data-active={isAct ? '' : undefined}
                    onClick={() => {
                      if (onActiveRowChange) onActiveRowChange(id);
                    }}
                    onDoubleClick={() => {
                      if (onRowOpen) onRowOpen(row);
                    }}
                  >
                    {onSelectionChange ? (
                      <td className="sn-data-table__sel">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${id}`}
                          checked={isSel}
                          onChange={(e) => handleSelectRow(id, e.target.checked)}
                        />
                      </td>
                    ) : null}
                    {activeCols.map((c) => (
                      <td
                        key={c.id}
                        className={c.numeric ? 'num' : undefined}
                        data-label={c.stackLabel || c.header}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                    {rowActions ? (
                      <td className="sn-data-table__actions">
                        {rowActions(row)}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
