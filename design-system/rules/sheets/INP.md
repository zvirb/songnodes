# INP rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| INP-001 | Every control shall say what it does. | judgement | Pass if each control has a visible or accessible name describing its action. |
| INP-002 | Every control shall show its state without relying on colour alone. | judgement | Pass if each state differs by more than colour. |
| INP-003 | Every control shall be reachable and operable by keyboard. | dom | Pass if every control can be focused and activated with keyboard only. |
| INP-004 | Native elements (button, input, select, a) shall be used first and ARIA only to fill gaps. | lint | Fail if role=button or role=link is set on a div or span where a native element exists. |
| INP-005 | TextLink shall use .sn-link in the destination module colour and always be underlined. | lint | Pass if .sn-link text-decoration is underline and colour is var(--m) of the target module. |
| INP-006 | FilterChip shall be .sn-chip and toggle one filter value using aria-pressed. | dom | Pass if each .sn-chip has aria-pressed true or false. |
| INP-007 | The primary Button (.sn-btn--primary) shall be the single main action of the view, at most one per view, with a dialog counting as its own view. | dom | Pass if each view or dialog contains at most one .sn-btn--primary. |
| INP-008 | Default Buttons (.sn-btn) shall number at most two beside the primary. | dom | Pass if a view with a primary has at most 2 default buttons beside it. |
| INP-009 | The module Button (.sn-btn--mod) shall be used in .sn-m-<key> for going to or acting in that module, and only inside tonal cards and launcher areas. | dom | Pass if .sn-btn--mod appears only inside tonal cards or launcher areas. |
| INP-010 | The quiet Button (.sn-btn--quiet) shall be used for toolbar and row actions and "Cancel". | judgement | Pass if toolbar, row and Cancel buttons are quiet. |
| INP-011 | The danger Button (.sn-btn--danger) shall be used only as the confirm button of a destructive ConfirmDialog, one per dialog. | dom | Pass if .sn-btn--danger appears only in ConfirmDialog and at most once. |
| INP-012 | The danger-quiet Button (.sn-btn--danger-quiet) shall be used for "Delete set" in settings or detail pages, one per section. | dom | Pass if each section has at most one .sn-btn--danger-quiet. |
| INP-013 | Button sizes shall be --sm 32px for tables and dense toolbars, default 40px, and --lg 48px for empty states, booth and touch-first. | lint | Pass if button heights are 32, 40 or 48px matching the context. |
| INP-014 | Buttons on coarse pointers shall be at least touch-min. | lint | Pass if button min-height is var(--touch-min) under pointer coarse. |
| INP-015 | Button labels shall begin with a verb, use sentence case and name the object. | judgement | Pass if labels match verb + object form such as "Save set". |
| INP-016 | Button labels shall not be "OK", "Submit" or "Yes". | lint | Fail if a button label equals OK, Submit or Yes. |
| INP-017 | A Button icon shall precede the label, be 18px and be aria-hidden. | dom | Pass if the icon is first child, 18px and aria-hidden true. |
| INP-018 | Icons shall not replace words on primary or destructive actions. | dom | Fail if .sn-btn--primary or danger buttons are icon-only. |
| INP-019 | Icon-only Buttons (.sn-btn--icon) shall be used only for close x, overflow ellipsis, drawer menu, move arrow-up/arrow-down and lock. | dom | Pass if each .sn-btn--icon uses one of those icons. |
| INP-020 | Icon-only Buttons shall have an aria-label naming the action and the object. | dom | Pass if each .sn-btn--icon has aria-label of the form action + object. |
| INP-021 | Icon-only Buttons shall have a Tooltip with the same text and shortcut. | dom | Pass if tooltip text equals aria-label plus shortcut. |
| INP-022 | A loading Button shall set aria-busy="true". | dom | Pass if loading buttons have aria-busy true. |
| INP-023 | A loading Button shall swap its icon for .sn-spinner, keep its label and keep its width. | visual | Pass if the spinner replaces the icon and width is unchanged. |
| INP-024 | Loading shall disable repeat clicks and not the whole form. | dom | Pass if only the busy button ignores clicks. |
| INP-025 | Controls should be enabled with an explanation in preference to being disabled. | judgement | Pass if blocked actions explain why rather than disappearing. |
| INP-026 | A disabled Button shall use aria-disabled="true" so it stays focusable, with a Tooltip stating why. | dom | Pass if disabled buttons lack the disabled attribute, have aria-disabled true and a tooltip. |
| INP-027 | To show rows matching one of several values, a FilterChip group with aria-pressed shall be used. | judgement | Pass if multi-value filters are FilterChip groups. |
| INP-028 | To include rows matching a condition, a Checkbox shall be used. | judgement | Pass if condition filters are checkboxes. |
| INP-029 | For a setting that applies at once, a Switch with role="switch" shall be used. | dom | Pass if instant settings use role switch. |
| INP-030 | To pick one mode or view of the same content, a SegmentedControl shall be used. | judgement | Pass if mode pickers are SegmentedControl. |
| INP-031 | To pick one of more than four options, a SelectField shall be used. | dom | Pass if pickers with more than 4 options are select. |
| INP-032 | To agree or confirm in a form, a Checkbox shall be used. | judgement | Pass if form agreements are checkboxes. |
| INP-033 | A Switch shall not be used inside a form that has a Save button. | dom | Fail if a form with a Save button contains role switch. |
| INP-034 | A Checkbox shall not be used for a setting that applies instantly outside a filter. | judgement | Fail if a checkbox outside a filter triggers an immediate save. |
| INP-035 | Filters shall apply live as they change, with no "Apply" button except the phone filter sheet. | dom | Pass if there is no Apply button on desktop filter bars. |
| INP-036 | The phone filter sheet button shall show the result count, for example "Show 214 tracks". | dom | Pass if the phone sheet button reads "Show N tracks". |
| INP-037 | The filter result count shall update with every change and be announced with aria-live="polite" in the form "214 of 1,284 tracks". | dom | Pass if the count element has aria-live polite and the N of M form. |
| INP-038 | "Clear filters" shall be shown as a quiet button whenever any filter differs from the default. | dom | Pass if the button is present exactly when filters are non-default. |
| INP-039 | "Clear filters" shall reset filters only, not search text, sort or selection. | dom | Pass if search, sort and selection survive Clear filters. |
| INP-040 | Active filters on phones and tablets shall appear as removable chips above the table. | visual | Pass if chips render above the table below desktop width. |
| INP-041 | Filters shall persist per person in local storage key sn-filters-<page> and in the URL. | lint | Pass if filters are written to localStorage key sn-filters-<page> and the query string. |
| INP-042 | A shared URL shall win over stored filters. | dom | Pass if URL filters override local storage on load. |
| INP-043 | SearchField shall show the search icon and a placeholder naming what is searched. | dom | Pass if the placeholder names the searched entities. |
| INP-044 | SearchField shall show an x clear button when not empty. | dom | Pass if the clear button exists only when value is non-empty. |
| INP-045 | SearchField shall debounce input by 150 ms and clear on Escape. | lint | Pass if debounce delay is 150 and Escape clears. |
| INP-046 | Placeholders shall not contain emoji. | lint | Fail if any placeholder attribute matches an emoji character. |
| INP-047 | FilterRail order in the music library shall be Search, Pillar, Energy tier, Rotation, Heard on, Tags, then the condition checkboxes. | dom | Pass if rail sections follow that order. |
| INP-048 | FilterRail shall stay visible from 1024px up. | visual | Pass if the rail is visible at 1024px and wider. |
| INP-049 | Below 1024px FilterRail shall become a "Filters (n)" button with the list-filter icon and the count in the label, opening a side sheet. | dom | Pass if below 1024px a button "Filters (n)" opens a SideSheet. |
| INP-050 | Energy tier chips shall carry a mini 3-segment bar of the tier range: Low energy-1 energy-3 energy-4, Building energy-5 energy-6 energy-7, High energy-8 energy-9 energy-10. | lint | Pass if each chip bar uses those tokens. |
| INP-051 | The energy tier chip bar shall be aria-hidden and the label shall carry the meaning. | dom | Pass if the bar has aria-hidden true and the label has the range text. |
| INP-052 | Rotation chip counts shall come from the weekly run and a threshold shall never be written into a chip label or help text. | lint | Fail if rotation chip text contains a numeric threshold. |
| INP-053 | Form labels shall sit above the field in .sn-field > label, always visible, in sentence case with no colon. | dom | Pass if every field has a visible label above it without trailing colon. |
| INP-054 | Placeholders shall show only an example format and never the label. | lint | Fail if placeholder equals label text. |
| INP-055 | Form fields shall mark the minority: if most fields are required, optional ones are marked "(optional)" after the label. | judgement | Pass if the minority group carries the marker. |
| INP-056 | Required marking shall not use asterisks alone. | lint | Fail if a label ends with an asterisk and no other indicator. |
| INP-057 | Help text shall sit under the label in .sn-field__help and be linked to the input with aria-describedby. | dom | Pass if the input aria-describedby references the help element id. |
| INP-058 | Validation shall run on blur and on submit and not on every keystroke. | lint | Pass if validators bind to blur and submit, not input events. |
| INP-059 | A field error shall clear as soon as the value becomes valid. | dom | Pass if the error is removed on the first valid value. |
| INP-060 | Field errors shall be in .sn-field__error with a ✕ glyph and text. | dom | Pass if error elements contain ✕ and text. |
| INP-061 | Field errors shall say what is wrong and how to fix it. | judgement | Pass if the message states the problem and the correction. |
| INP-062 | An invalid field shall set aria-invalid="true". | dom | Pass if fields with errors have aria-invalid true. |
| INP-063 | Forms with more than five fields shall show an error summary InlineMessage (bad) at the top on submit. | dom | Pass if a failed submit of a 6+ field form shows the summary. |
| INP-064 | The error summary shall list each error as a link to its field and receive focus. | dom | Pass if summary links target field ids and the summary is focused. |
| INP-065 | Field width shall match the expected value. | judgement | Pass if BPM fields are 6ch and set length 8ch, and the set name full width. |
| INP-066 | NumberField shall set inputmode to numeric or decimal. | dom | Pass if inputmode is numeric or decimal. |
| INP-067 | NumberField shall place its unit outside the input. | dom | Pass if the unit text is a sibling and not in the value. |
| INP-068 | NumberField arrow keys shall step the value and Shift+arrow shall step by 10. | dom | Pass if ArrowUp adds 1 and Shift+ArrowUp adds 10. |
| INP-069 | NumberField shall accept both "124.0" and "124". | dom | Pass if both inputs parse to 124. |
| INP-070 | DateField shall display dates as "D Mon YYYY". | lint | Pass if displayed value matches ^\d{1,2} [A-Z][a-z]{2} \d{4}$. |
| INP-071 | DateField shall accept typed day-first dd/mm/yyyy (en-AU) and ISO input. | dom | Pass if "24/10/2026" and "2026-10-24" parse to the same date. |
| INP-072 | DateField shall open a picker from a calendar icon. | dom | Pass if the calendar icon opens a picker. |
| INP-073 | SelectField shall use a native select (.sn-select) for up to about 15 options and a searchable list above that. | dom | Pass if selects with more than 15 options render as searchable lists. |
| INP-074 | SelectField options shall be in a meaningful order and not alphabetical by default. | judgement | Pass if order follows meaning such as energy shape. |
| INP-075 | Checkbox shall use .sn-check and the whole label shall be clickable. | dom | Pass if clicking the label toggles the input. |
| INP-076 | Checkbox groups shall be wrapped in fieldset with legend. | dom | Pass if each checkbox group has fieldset and legend. |
| INP-077 | SecretField shall mask its value by default. | dom | Pass if the input type is password by default. |
| INP-078 | SecretField shall have an eye/eye-off reveal toggle with aria-pressed. | dom | Pass if the toggle uses aria-pressed and eye icons. |
| INP-079 | SecretField shall include a CopyButton. | dom | Pass if a CopyButton is present. |
| INP-080 | SecretField after saving shall show only the last four characters in the form "•••• 3f9a". | dom | Pass if saved display matches ^•••• .{4}$. |
| INP-081 | A secret shall never be prefilled into the DOM after save. | dom | Fail if the full secret appears in DOM attributes or text after save. |
| INP-082 | ChipInput shall add on Enter or comma, remove the last chip on Backspace when empty, and split pasted lists on commas and new lines. | dom | Pass if each of the three behaviours works. |
| INP-083 | RangeSlider shall have two thumbs with visible values and each value typeable. | dom | Pass if two thumbs show values and accept typing. |
| INP-084 | RangeSlider shall set aria-valuetext such as "122 to 128 BPM". | dom | Pass if aria-valuetext has the "A to B unit" form. |
| INP-085 | KeyPicker selected keys shall use KeyBadge. | dom | Pass if selected keys render as .sn-key. |
| INP-086 | KeyPicker shall default to the accessible 12×2 grid with the wheel optional. | dom | Pass if the default view is a 12×2 grid. |
| INP-087 | FileDrop shall be a dashed line-strong box reading "Drop a JSON or CSV file, or choose a file". | dom | Pass if the box has a dashed var(--line-strong) border and that text. |
| INP-088 | FileDrop shall state accepted types and the size limit. | dom | Pass if the type and size limit text is present. |
| INP-089 | FileDrop shall use the "Choose a file" button as the keyboard control. | dom | Pass if the button is focusable and opens the file picker. |
| INP-090 | After a file is chosen the UI shall show file name, size and a parsed preview before anything is written. | dom | Pass if no write occurs before preview confirmation. |
| INP-091 | The import button shall name the count, for example "Import 39 tracks". | lint | Pass if the label matches "Import N tracks". |
| INP-092 | PhotoCapture shall offer "Take photo" with the camera icon on devices with a camera and "Choose photo" always. | dom | Pass if Choose photo always exists and Take photo only with a camera. |
| INP-093 | PhotoCapture shall show the image in MediaViewer before upload. | dom | Pass if preview precedes upload. |
| INP-094 | PhotoCapture shall strip location metadata before upload and say so. | dom | Pass if uploaded image has no EXIF GPS and a notice is shown. |
| INP-095 | TracklistPaste shall use a textarea in the data font. | dom | Pass if textarea font is the data token. |
| INP-096 | TracklistPaste shall parse live and show each line's match result with a StatusPill (matched, possible match, not found). | dom | Pass if each line has one of three pills. |
| INP-097 | Unmatched TracklistPaste lines shall stay editable. | dom | Pass if not-found lines can be edited. |
| INP-098 | Upload progress shall use ProgressBar with bytes in the form "2.1 of 4.8 MB". | dom | Pass if text matches N of M MB. |
| INP-099 | A failed upload shall keep the file chosen and offer "Try again". | dom | Pass if failure retains the file and shows Try again. |
| INP-100 | CopyButton shall use the copy icon with the label "Copy tracklist" or an icon-only variant such as "Copy Spotify ID". | dom | Pass if CopyButton has copy icon and a label or aria-label. |
| INP-101 | On copy success CopyButton shall change its icon to check and its label to "Copied" for 2 s. | dom | Pass if the swap lasts about 2000 ms. |
| INP-102 | CopyButton success shall be announced via aria-live and shall not use a toast. | dom | Pass if aria-live region updates and no Toast opens. |
| INP-103 | On copy failure the value shall be selected in a read-only field with the message "Press Ctrl+C to copy". | dom | Pass if failure shows a readonly selected field and that text. |
| INP-104 | Copy shall never fail silently. | dom | Pass if every failure path produces visible feedback. |
| INP-105 | A Dialog shall be modal with focus trapped, Escape to cancel, title in title-m, radius-sheet and z-dialog. | dom | Pass if the dialog meets all listed properties. |
| INP-106 | A ConfirmDialog shall name the object and consequence, use the verb as the confirm label with --danger, and focus Cancel first. | dom | Pass if confirm label is a verb on .sn-btn--danger and Cancel has initial focus. |
| INP-107 | A SideSheet shall open at the right on z-drawer, non-modal at bp-desktop and above, modal and full height on phones, with the URL carrying ?track=. | dom | Pass if modality changes at bp-desktop and the URL has track. |
| INP-108 | Popover, OverflowMenu and ContextMenu shall use z-popover, light dismiss, arrow-key navigation and return focus. | dom | Pass if outside click dismisses, arrows move and focus returns. |
| INP-109 | MediaViewer shall use z-dialog, full screen, arrows, Escape and a counter such as "3 of 12". | dom | Pass if the viewer has those features. |
| INP-110 | Tooltip shall use z-tooltip, open on hover and focus, and never hold actions. | dom | Pass if tooltip contains no interactive element. |
| INP-111 | Toast shall use z-toast, last 5 s, pause on hover and focus, and hold at most one action such as "Undo". | dom | Pass if timeout is 5000 ms with pause and at most one action. |
| INP-112 | Dialogs shall never be stacked and a dialog may open a Popover but not another Dialog. | dom | Fail if two dialog elements are open at once. |
| INP-113 | window.alert and window.confirm shall not be used; ConfirmDialog or Toast shall be used instead. | lint | Fail if source contains window.alert or window.confirm calls. |
| INP-114 | Set drafts shall autosave locally on every change, debounced 1 s, to sn-set-draft-<id>. | lint | Pass if drafts write to localStorage key sn-set-draft-<id> with 1000 ms debounce. |
| INP-115 | Draft autosave shall show a status such as "Draft saved on this device 21:30" in fg-3. | dom | Pass if the status text and var(--fg-3) are present. |
| INP-116 | A saved draft shall be restored on reload with a Banner "Restored your unsaved draft from HH:MM. Discard draft". | dom | Pass if reload shows the Banner with a discard action. |
| INP-117 | Shared sets, target tracks and attribution fixes shall use an explicit save with a primary "Save set" Button. | dom | Pass if these surfaces have a primary Save button. |
| INP-118 | Explicit saves shall show a StatusPill going saving then saved. | dom | Pass if the pill transitions saving to saved. |
| INP-119 | Unsaved changes shall mark the title with "· Unsaved" and the browser shall ask before leaving. | dom | Pass if the title shows the marker and beforeunload is registered. |
| INP-120 | Preferences (theme, density, text size) shall apply and persist immediately with no save button. | dom | Pass if no Save button exists and values persist on change. |
| INP-121 | Settings touching other services shall save explicitly per section, test the connection and show ServiceStatus. | dom | Pass if each section has Save and a ServiceStatus. |
| INP-122 | Review queue decisions shall save at once and offer "Undo" in a Toast for 10 s. | dom | Pass if the Undo Toast lasts 10000 ms. |
| INP-123 | Autosave and a Save button shall not be mixed on one surface. | dom | Fail if a surface has both autosave and a Save button. |
| INP-124 | Ctrl/Cmd+S shall trigger the explicit save where one exists and do nothing elsewhere, with no browser save dialog. | dom | Pass if the default is prevented and save fires only on explicit-save surfaces. |
