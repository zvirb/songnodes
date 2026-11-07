import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SnIcon } from '../../lib/songnodes';

export type EditableCellType = 'number' | 'select' | 'text';

export interface EditableCellOption {
  value: string;
  label: string;
}

export interface EditableCellProps<T = string | number> {
  type: EditableCellType;
  value: T;
  onSave: (value: T) => void | Promise<void>;
  /** For 'number': min allowed value. */
  min?: number;
  /** For 'number': max allowed value. */
  max?: number;
  /** For 'number': step size (default 1). */
  step?: number;
  /** For 'select': list of options. */
  options?: EditableCellOption[];
  /** Accessible label for the input. */
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export function EditableCell<T extends string | number = string | number>({
  type,
  value,
  onSave,
  min = 1,
  max = 10,
  step = 1,
  options = [],
  ariaLabel,
  className = '',
  disabled = false,
}: EditableCellProps<T>): React.ReactElement {
  const [prevValue, setPrevValue] = useState<T>(value);
  const [committedValue, setCommittedValue] = useState<T>(value);
  const [currentValue, setCurrentValue] = useState<T>(value);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const timerRef = useRef<number | null>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setCommittedValue(value);
    setCurrentValue(value);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const commit = useCallback(async (valToCommit?: T) => {
    const val = valToCommit !== undefined ? valToCommit : currentValue;
    if (val === committedValue) {
      return;
    }

    setIsSaving(true);
    setStatus('idle');

    try {
      await onSave(val);
      setCommittedValue(val);
      setStatus('saved');
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setStatus('idle');
      }, 1500);
    } catch {
      // Rollback on error
      setCurrentValue(committedValue);
      setStatus('error');
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } finally {
      setIsSaving(false);
    }
  }, [committedValue, currentValue, onSave]);

  const rollback = useCallback(() => {
    setCurrentValue(committedValue);
    setStatus('idle');
  }, [committedValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      rollback();
      if (e.target instanceof HTMLElement) {
        e.target.blur();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    }
  };

  const handleNumberStep = (delta: number) => {
    const currentNum = typeof currentValue === 'number' ? currentValue : Number(currentValue) || min;
    const nextVal = (Math.max(min, Math.min(max, currentNum + delta)) as unknown) as T;
    setCurrentValue(nextVal);
    void commit(nextVal);
  };

  const renderStatus = () => {
    if (isSaving) {
      return (
        <span aria-label="Saving">
          <span className="sn-spinner" aria-hidden="true" style={{ width: 12, height: 12, borderWidth: 2 }} />
        </span>
      );
    }
    if (status === 'saved') {
      return (
        <span aria-label="Saved" style={{ color: 'var(--status-ok)', display: 'inline-flex', alignItems: 'center' }}>
          <SnIcon name="check" size={14} />
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span aria-label="Save failed" style={{ color: 'var(--status-bad)', display: 'inline-flex', alignItems: 'center' }}>
          <SnIcon name="alert-triangle" size={14} />
        </span>
      );
    }
    return null;
  };

  if (type === 'number') {
    const num = typeof currentValue === 'number' ? currentValue : Number(currentValue) || min;
    return (
      <div
        className={`sn-editable-cell sn-editable-cell--number ${className}`.trim()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
      >
        <div
          className="sn-number-field__box"
          style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: 0 }}
        >
          <button
            type="button"
            className="sn-number-field__step"
            tabIndex={-1}
            aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
            disabled={disabled || isSaving || num <= min}
            onClick={() => handleNumberStep(-step)}
            style={{ width: 24, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            −
          </button>
          <input
            type="text"
            role="spinbutton"
            inputMode="numeric"
            className="sn-number-field__input"
            value={currentValue}
            aria-label={ariaLabel}
            aria-valuenow={num}
            aria-valuemin={min}
            aria-valuemax={max}
            disabled={disabled || isSaving}
            style={{ width: 32, height: 26, textAlign: 'center', padding: '0 var(--space-1)', border: 0 }}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (val === '') {
                setCurrentValue('' as unknown as T);
              } else {
                const parsed = Number(val);
                if (!Number.isNaN(parsed)) {
                  setCurrentValue(parsed as unknown as T);
                }
              }
            }}
            onBlur={() => {
              const parsed = Number(currentValue);
              if (Number.isNaN(parsed) || parsed < min || parsed > max) {
                rollback();
              } else {
                void commit(parsed as unknown as T);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleNumberStep(step);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleNumberStep(-step);
              } else {
                handleKeyDown(e);
              }
            }}
          />
          <button
            type="button"
            className="sn-number-field__step"
            tabIndex={-1}
            aria-label={`Increase ${ariaLabel.toLowerCase()}`}
            disabled={disabled || isSaving || num >= max}
            onClick={() => handleNumberStep(step)}
            style={{ width: 24, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            +
          </button>
        </div>
        {renderStatus()}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div
        className={`sn-editable-cell sn-editable-cell--select ${className}`.trim()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
      >
        <select
          className="sn-select"
          value={String(currentValue)}
          aria-label={ariaLabel}
          disabled={disabled || isSaving}
          style={{ height: 28, fontSize: '0.8125rem', padding: '0 var(--space-2)' }}
          onChange={(e) => {
            const next = e.target.value as unknown as T;
            setCurrentValue(next);
            void commit(next);
          }}
          onBlur={() => void commit()}
          onKeyDown={handleKeyDown}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {renderStatus()}
      </div>
    );
  }

  return (
    <div
      className={`sn-editable-cell sn-editable-cell--text ${className}`.trim()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
    >
      <input
        type="text"
        className="sn-input"
        value={String(currentValue)}
        aria-label={ariaLabel}
        disabled={disabled || isSaving}
        style={{ height: 28, fontSize: '0.8125rem', padding: '0 var(--space-2)' }}
        onChange={(e) => setCurrentValue(e.target.value as unknown as T)}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
      />
      {renderStatus()}
    </div>
  );
}
