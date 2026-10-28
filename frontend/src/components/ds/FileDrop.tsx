/**
 * FileDrop (design system 1.2.0, Inputs).
 *
 * A visible drop zone with a Choose button, the accepted types and size, then one row per file
 * with its parse result or error and a Remove button. Type, size and empty checks run here before
 * anything is added; rejected files get an error row of their own and never reach onAdd.
 * Markup and behaviour: design-system/components/FileDrop/README.md.
 */
import React, { useId, useRef, useState } from 'react';
import { CircleAlert, FileInput, FileJson, FileText, Upload, X } from 'lucide-react';

export interface FileDropFile {
  id: string;
  name: string;
  size: number;
  state: 'reading' | 'read' | 'error';
  progress?: number;
  summary?: string;
  error?: string;
}

export interface FileDropProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrop'> {
  /** Visible label ("Import tracklists"). */
  label: string;
  /** Accepted extensions [".txt", ".csv"]. */
  accept: string[];
  /** Size limit per file in MB. */
  maxMb: number;
  /** Allow several files. */
  multiple?: boolean;
  /** Line under the title: types, contents and limit. */
  hint: string;
  /** Parse a valid file; resolve with a short summary or throw a message. Run here for every added file. */
  parse: (file: File) => Promise<{ summary: string }>;
  /** Files currently selected, with state (owned by the page). */
  files: FileDropFile[];
  /** Files added (already type/size checked). */
  onAdd: (files: File[]) => void;
  /** Remove one file. */
  onRemove: (id: string) => void;
}

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true, className: 'sn-icon' } as const;

/** "18 KB", "3.3 MB" (FileDrop content rules). */
export function fileSize(bytes: number): string {
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

/** The GOV.UK file-upload messages, in the order the preview checks them. */
export function fileDropError(file: { name: string; size: number }, accept: string[], maxMb: number): string | null {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!accept.map((a) => a.toLowerCase()).includes(ext)) return `The selected file must be a ${accept.join(' or ')} file.`;
  if (file.size > maxMb * 1048576) return `The selected file must be smaller than ${maxMb} MB.`;
  if (file.size === 0) return 'The selected file is empty.';
  return null;
}

const keyOf = (f: { name: string; size: number }) => `${f.name}:${f.size}`;

export const FileDrop = React.forwardRef<HTMLDivElement, FileDropProps>(({
  label,
  accept,
  maxMb,
  multiple = false,
  hint,
  parse,
  files,
  onAdd,
  onRemove,
  className = '',
  ...props
}, ref) => {
  const uid = useId();
  const ids = { label: `${uid}-l`, hint: `${uid}-h`, input: `${uid}-in`, button: `${uid}-btn` };
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<FileDropFile[]>([]);
  const [parsed, setParsed] = useState<Record<string, { summary?: string; error?: string }>>({});
  const [said, setSaid] = useState('');

  const add = (list: File[]) => {
    const picked = multiple ? list : list.slice(0, 1);
    if (picked.length === 0) return;
    const valid: File[] = [];
    const bad: FileDropFile[] = [];
    const msgs: string[] = [];
    picked.forEach((f, i) => {
      const err = fileDropError(f, accept, maxMb);
      msgs.push(err ? `${f.name}: ${err}` : `${f.name} added`);
      if (err) bad.push({ id: `${uid}-x${Date.now()}-${i}`, name: f.name, size: f.size, state: 'error', error: err });
      else valid.push(f);
    });
    setRejected((r) => (multiple ? [...r, ...bad] : bad));
    setSaid(msgs.join('. '));
    if (valid.length) onAdd(valid);
    valid.forEach((f) => {
      parse(f).then(
        (res) => setParsed((p) => ({ ...p, [keyOf(f)]: { summary: res.summary } })),
        (e: unknown) => setParsed((p) => ({ ...p, [keyOf(f)]: { error: e instanceof Error ? e.message : typeof e === 'string' ? e : 'This file could not be read.' } })),
      );
    });
  };

  const remove = (row: FileDropFile, index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[data-remove]');
    const next = buttons?.[index + 1] ?? buttons?.[index - 1] ?? null;
    if (rejected.some((r) => r.id === row.id)) setRejected((r) => r.filter((x) => x.id !== row.id));
    else onRemove(row.id);
    setSaid(`${row.name} removed`);
    (next ?? inputRef.current)?.focus();
  };

  // Page rows first (a page-set summary or error wins over the local parse), then rejected files.
  const rows: FileDropFile[] = [
    ...files.map((f) => {
      const p = parsed[keyOf(f)];
      if (f.state !== 'reading' || !p) return f;
      return p.error ? { ...f, state: 'error' as const, error: p.error } : { ...f, state: 'read' as const, summary: p.summary };
    }),
    ...rejected,
  ];

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setOver(true); };
  const onDragLeave = (e: React.DragEvent) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(Array.from(e.dataTransfer?.files ?? []));
  };

  return (
    <div ref={ref} className={['sn-file-drop', className].filter(Boolean).join(' ')} {...props}>
      <span className="sn-file-drop__label" id={ids.label}>{label}</span>
      <div
        className="sn-file-drop__zone"
        data-dragover={over ? '' : undefined}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {over ? <FileInput {...ICON} /> : <Upload {...ICON} />}
        <div className="sn-file-drop__zone-text">
          <strong>
            {over
              ? `Drop to add ${multiple ? 'the files' : 'the file'}`
              : <span className="sn-file-drop__drag">{multiple ? 'Drag files here, or choose them' : 'Drag a file here, or choose one'}</span>}
          </strong>
          <span className="sn-file-drop__accept" id={ids.hint}>{hint}</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="sn-sr sn-file-drop__input"
          id={ids.input}
          accept={accept.join(',')}
          multiple={multiple}
          aria-labelledby={`${ids.label} ${ids.button}`}
          aria-describedby={ids.hint}
          onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        />
        <label htmlFor={ids.input} className="sn-btn sn-btn--sm sn-file-drop__choose" id={ids.button}>
          {multiple ? 'Choose files' : 'Choose file'}
        </label>
      </div>
      <ul className="sn-file-drop__files" aria-label="Selected files" ref={listRef}>
        {rows.map((f, i) => {
          const err = f.state === 'error';
          const Icon = err ? CircleAlert : /json$/i.test(f.name) ? FileJson : FileText;
          return (
            <li key={f.id} className="sn-file-drop__file" data-error={err ? '' : undefined}>
              <Icon {...ICON} />
              <div className="sn-file-drop__name"><b>{f.name}</b><span className="sn-file-drop__size">{fileSize(f.size)}</span></div>
              <button
                type="button"
                className="sn-btn sn-btn--quiet sn-btn--icon sn-btn--sm"
                aria-label={`Remove ${f.name}`}
                title={`Remove ${f.name}`}
                data-remove=""
                onClick={() => remove(f, i)}
              >
                <X {...ICON} />
              </button>
              {f.state === 'reading' && f.progress != null ? (
                <div className="sn-file-drop__progress" role="progressbar" aria-label={`Reading ${f.name}`} aria-valuenow={f.progress} aria-valuemin={0} aria-valuemax={100}>
                  <i style={{ width: `${f.progress}%` }} />
                </div>
              ) : null}
              <div className={`sn-file-drop__result${err ? ' sn-file-drop__result--error' : ''}`}>
                {err ? <span>{f.error}</span>
                  : f.state === 'read'
                    ? <><span className="sn-pill" data-status="ok">Read</span>{f.summary ? <span>{f.summary}</span> : null}</>
                    : <span className="sn-pill" data-status="running">Reading</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="sn-sr" role="status" aria-live="polite">{said}</div>
    </div>
  );
});
FileDrop.displayName = 'FileDrop';
