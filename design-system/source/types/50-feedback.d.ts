/* SongNodes design system: feedback & surfaces (documentation types for the React components). */
import type { ReactNode } from "react";

/** Status keys shared with sn-pill. */
export type FeedbackStatus = "ok" | "fair" | "warn" | "bad" | "info";

export interface EmptyStateProps {
  /** Which empty case this is; picks the default icon and wording pattern. */
  kind: "first-use" | "filtered" | "not-connected" | "done";
  /** Lucide icon name shown muted in the circle (e.g. "list-music"). */
  icon: string;
  /** Short title in sentence case: "No sets yet". */
  title: string;
  /** One sentence: what will appear here and why it is empty now. */
  text: ReactNode;
  /** The one action that fills the panel ("Build set", "Clear filters", "Connect TIDAL"); omit for "done". */
  action?: ReactNode;
  /** Optional context under the text, e.g. the active filter tags. */
  meta?: ReactNode;
  /** Smaller padding and icon for panels under 320px tall. */
  compact?: boolean;
}

export interface LoadingStateProps {
  /** first = nothing to show yet (skeleton); refresh = data stays, slim top line shows. */
  mode: "first" | "refresh";
  /** Shape of the skeleton for first loads, matching the content that will arrive. */
  shape?: "rows" | "tiles" | "custom";
  /** Number of skeleton rows or tiles; match the expected first screen (default 5 rows / 3 tiles). */
  count?: number;
  /** What is loading, shown after 1 s: "Loading 1,284 tracks…". */
  message?: string;
  /** Delay before the message appears, in ms (default 1000). */
  messageDelayMs?: number;
  /** Last successful update, shown in the freshness stamp; replaced by "Updating…" while refreshing. */
  updatedAt?: Date | string;
  /** The real content (kept visible during refresh). */
  children?: ReactNode;
}

export interface StagedProgressStep {
  /** Step name, verb first: "Match plays to tracks". */
  name: string;
  /** done ●, running ↻, waiting –, failed ✕, cancelled –, stalled ▲ (1.4.0: the running step sent no progress for `stallSeconds`; status-warn until the person tries again or cancels, never failed by elapsed time). */
  state: "done" | "running" | "waiting" | "failed" | "cancelled" | "stalled";
  /** Current detail: "Matching 312 of 500 tracks", or the failure reason. */
  detail?: string;
  /** Items done and total for the running step; shows a neutral progress bar when both are known. */
  done?: number;
  /** Total items for the running step. */
  total?: number;
  /** Seconds the step took (done/failed). */
  seconds?: number;
  /** Step-level actions after a failure or a stall ("Try again", which resumes from this step; "Skip MixesDB"). */
  actions?: ReactNode;
  /** Seconds since this step last reported progress; the page turns a running step into `stalled` at `stallSeconds`. */
  secondsSinceProgress?: number;
}

export interface StagedProgressProps {
  /** Thin–bold title parts: lead "Weekly build", title "Sat 24 Oct". */
  lead: string;
  /** Bold part of the title. */
  title: string;
  /** Ordered steps. */
  steps: StagedProgressStep[];
  /** Seconds since start; rendered as "Elapsed 4:18". */
  elapsedSeconds: number;
  /** Seconds left, only when the job can estimate honestly; rounded up ("About 3 min left"). */
  remainingSeconds?: number;
  /** Cancels the job; omit when the job cannot be cancelled. */
  onCancel?: () => void;
  /** True when the job runs on the server and survives navigation; shows the "You can leave this page" notice. */
  runsInBackground?: boolean;
  /** Seconds without progress from the current step before it turns `stalled`. Default 60; elapsed time alone never stalls or fails a job. */
  stallSeconds?: number;
  /** Resumes from the stalled step (the step's "Try again"); done steps are kept. */
  onResume?: (stepIndex: number) => void;
}

export interface ErrorStateProps {
  /** Cause; picks icon, status colour and default retry guidance. "stalled" (1.4.0): a staged load whose current step sent no progress for 60 s, warn, Try again resumes from that step. */
  kind: "offline" | "timeout" | "auth-expired" | "not-found" | "server" | "validation" | "stalled";
  /** What happened, in plain words: "TIDAL is slow right now". */
  title: string;
  /** What it affects and what to do next. */
  text: ReactNode;
  /** Whether retrying will help, said in words ("Retrying won't help until you reconnect"). */
  retryHint?: string;
  /** False when retrying cannot help (shows – instead of ↻). */
  retryHelps?: boolean;
  /** Called by the Retry button; omit when retry cannot help. */
  onRetry?: () => void;
  /** Cause-specific action instead of or beside Retry ("Reconnect TIDAL", "Go to saved sets"). */
  action?: ReactNode;
  /** Server reference ID, shown copyable for 5xx errors. */
  referenceId?: string;
  /** Fields to fix for validation errors; each links to its field. */
  fields?: { id: string; label: string; message: string }[];
  /** Last successful data, shown under the error with its time. */
  lastGood?: { at: Date | string; content: ReactNode };
  /** Borderless variant that fills a panel instead of sitting as a card. */
  panel?: boolean;
}

export interface BannerProps {
  /** info / warn / bad / ok. */
  status: "info" | "warn" | "bad" | "ok";
  /** Bold lead sentence: "Sets are shaped on energy alone." */
  title: string;
  /** Supporting sentence with numbers: "Only 611 of 1,284 tracks have a key and BPM so far." */
  text?: ReactNode;
  /** One or two actions (secondary buttons or a module button). */
  actions?: ReactNode;
  /** Dismiss handler; not allowed for status "bad". Dismissal is remembered per person. */
  onDismiss?: () => void;
  /** Full-bleed under the page header (no side borders or radius). */
  page?: boolean;
}

export interface InlineMessageProps {
  /** Status glyph and colour: ● ok, ◐ fair, ▲ warn, ✕ bad, i info. */
  status: FeedbackStatus;
  /** Message text; bold the key part with <strong>. */
  children: ReactNode;
  /** Optional link that jumps to the thing ("Show them"). No dismiss. */
  action?: ReactNode;
  /** Tinted box for card sections; plain under fields and in rows. */
  boxed?: boolean;
  /** id so a field can point aria-describedby at the message. */
  id?: string;
}

export interface ToastOptions {
  /** Past-tense confirmation: "Set saved", "Tracklist copied: 18 tracks". */
  message: ReactNode;
  /** One optional action, usually Undo; must also be available elsewhere (e.g. Ctrl/Cmd+Z, history). */
  action?: { label: string; onAction: () => void };
  /** Visible time in ms: default 4000, 8000 with an action. Pauses on hover and focus. */
  durationMs?: number;
}

export interface ToastProps {
  /** Queue manager: shows one toast at a time, keeps at most 3 waiting (oldest dropped). */
  queueLimit?: 3;
  /** Placement: bottom centre, bottom right from the desktop breakpoint. */
  placement?: "auto";
  /** Push a toast; never for errors that need action (use Banner, ErrorState or InlineMessage). */
  toast?: (options: ToastOptions) => void;
}

export interface DialogProps {
  /** Open state; uses the native <dialog> showModal() for the focus trap and Esc. */
  open: boolean;
  /** Called on Esc, the close button and Cancel. */
  onClose: () => void;
  /** Regular lead of the thin–bold title: "Edit cues". */
  lead?: string;
  /** Bold title: "Bicep – Glue". */
  title: string;
  /** One-line context under the title: "Slot 7 of 18 in “Peak time Friday”". */
  subtitle?: string;
  /** S 400, M 600, L 800. M and L become full-screen sheets below 480px. */
  size?: "s" | "m" | "l";
  /** Body content (scrolls). */
  children: ReactNode;
  /** Footer actions, right-aligned: Cancel then the primary. */
  footer: ReactNode;
  /** Optional quiet action at the left of the footer ("Reset cues"). */
  footerStart?: ReactNode;
  /** Element to focus on open; default the first field, else the primary-adjacent Cancel. */
  initialFocusRef?: { current: HTMLElement | null };
}

export interface ConfirmDialogProps {
  /** Open state (alertdialog, modal). */
  open: boolean;
  /** Question naming the object: "Delete “Peak time Friday”?" */
  title: string;
  /** Consequence and who it affects; say what is kept. */
  text: ReactNode;
  /** Extra facts as a short list ("The 18 tracks stay in the library."). */
  facts?: string[];
  /** Danger button label, verb + object: "Delete set". */
  confirmLabel: string;
  /** Called by the danger button. */
  onConfirm: () => void;
  /** Called by Cancel and Esc. Cancel has initial focus. */
  onCancel: () => void;
  /** High-stakes: the exact text the person must type (usually the set name) before the danger button enables. */
  requireTyping?: string;
}

export interface ArmedButtonProps {
  /** Resting label: "Clear draft". */
  label: string;
  /** Armed question shown for the window: "Clear the current draft?" */
  armedLabel: string;
  /** Window in ms (default 3000); a second press inside it acts. */
  windowMs?: number;
  /** The low-stakes action. */
  onConfirm: () => void;
}

export interface SideSheetProps {
  /** Open state. */
  open: boolean;
  /** Close handler (close button, Esc; also scrim tap on phones). */
  onClose: () => void;
  /** Title; may use the thin–bold lead ("Track:", "Bicep – Glue"). */
  title: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Sticky footer actions. */
  footer?: ReactNode;
  /** Desktop behaviour: push the content aside (default) or overlay it. Phones always get a modal bottom sheet. */
  mode?: "push" | "overlay";
  /** Width on tablet and desktop in px (default 380). */
  width?: number;
}

export interface MediaItem {
  /** Kind of media. */
  kind: "artwork" | "photo" | "waveform";
  /** Image URL or a render function for the waveform. */
  src: string | (() => ReactNode);
  /** Caption title: "Bicep – Glue (cover art)". */
  title: string;
  /** Source line: "Beatport · 1,400 × 1,400". */
  source: string;
  /** Alt text; always shown in the caption and used as the accessible name. */
  alt: string;
}

export interface MediaViewerProps {
  /** Items to page through. */
  items: MediaItem[];
  /** Index shown first. */
  index: number;
  /** Open state (full-screen, modal). */
  open: boolean;
  /** Close handler (close button, Esc); focus returns to the thumbnail that opened it. */
  onClose: () => void;
  /** Called when prev/next or the arrow keys change the item. */
  onIndexChange?: (index: number) => void;
  /** Maximum zoom (default 4 = 400%). */
  maxZoom?: number;
}

export interface TooltipProps {
  /** Short supplementary text: a name, a key name ("A minor"), an absolute time. Never essential or interactive. */
  content: ReactNode;
  /** Optional keyboard shortcut shown as a key cap. */
  shortcut?: string;
  /** The trigger; must be focusable. */
  children: ReactNode;
  /** Hover delay in ms (default 500); hiding is immediate. */
  delayMs?: number;
  /** How the trigger uses it: "describe" sets aria-describedby; "label" for icon buttons whose aria-label already matches. */
  relation?: "describe" | "label";
  /** Preferred side; flips when there is no room. */
  side?: "top" | "bottom";
}

export interface PopoverProps {
  /** Trigger button (gets aria-expanded, aria-controls, aria-haspopup="dialog"). */
  trigger: ReactNode;
  /** Title at the top; focus moves here on open. */
  title: ReactNode;
  /** Interactive content: lists, checkboxes, small actions. */
  children: ReactNode;
  /** Footer actions or a link. */
  footer?: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Open change (click trigger, Esc, outside click, focus leaving). */
  onOpenChange?: (open: boolean) => void;
  /** Align to the trigger's start or end edge. */
  align?: "start" | "end";
  /** Open below (default) or above. */
  side?: "bottom" | "top";
}
