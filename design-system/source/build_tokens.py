#!/usr/bin/env python3
"""SongNodes design system - token generator.

Regenerates project/tokens.json and project/tokens.css and prints a contrast report.
Edit the INPUTS block (decisions from the 24 Oct 2026 choices page) and rerun:
    python3 build_tokens.py <project-dir>
Colours are authored in OKLCH so the three themes keep hue and step lightness predictably.
"""
import json, math, sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- colour maths
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def hex_to_rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
def rgb_to_hex(r, g, b):
    return '#' + ''.join(f'{round(max(0,min(1,x))*255):02x}' for x in (r, g, b))
def hex_to_oklch(h):
    r, g, b = (srgb_to_lin(x) for x in hex_to_rgb(h))
    l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b
    m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b
    s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b
    l_, m_, s_ = (x ** (1/3) for x in (l, m, s))
    L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_
    a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_
    bb = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360
def oklch_to_rgb_lin(L, C, H):
    a = C * math.cos(math.radians(H)); b = C * math.sin(math.radians(H))
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    return (4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
            -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
            -0.0041960863*l - 0.7034186147*m + 1.7076147010*s)
def oklch(L, C, H):
    # reduce chroma until in gamut
    c = C
    while c > 0:
        r, g, b = oklch_to_rgb_lin(L, c, H)
        if all(-0.0005 <= x <= 1.0005 for x in (r, g, b)): break
        c -= 0.002
    r, g, b = oklch_to_rgb_lin(L, max(c, 0), H)
    return rgb_to_hex(*(lin_to_srgb(x) for x in (r, g, b)))
def lum(h):
    r, g, b = (srgb_to_lin(x) for x in hex_to_rgb(h)); return 0.2126*r + 0.7152*g + 0.0722*b
def cr(a, b):
    la, lb = lum(a), lum(b); return (max(la, lb) + .05) / (min(la, lb) + .05)

# ---------------------------------------------------------------- INPUTS (decisions)
THEMES = [("dark", "Dark"), ("light", "Light"), ("booth", "Booth")]

NEUTRAL = {  # Elektronauts charcoal for dark; warm-neutral light; pure black booth
  "bg":          {"dark": "#222222", "light": "#f4f4f1", "booth": "#000000"},
  "surface-1":   {"dark": "#2d2d2d", "light": "#ffffff", "booth": "#0f0f0f"},
  "surface-2":   {"dark": "#373737", "light": "#ecece8", "booth": "#1c1c1c"},
  "surface-3":   {"dark": "#414141", "light": "#e1e1dc", "booth": "#2a2a2a"},
  "sunk":        {"dark": "#1b1b1b", "light": "#e9e9e5", "booth": "#000000"},
  "line":        {"dark": "#3c3c3c", "light": "#d9d9d4", "booth": "#5e5e5e"},
  "line-strong": {"dark": "#858585", "light": "#86867f", "booth": "#a8a8a8"},
  "fg":          {"dark": "#f9f9f9", "light": "#1c1c1e", "booth": "#ffffff"},
  "fg-2":        {"dark": "#bbbbbb", "light": "#47474b", "booth": "#e8e8e8"},
  "fg-3":        {"dark": "#a3a3a3", "light": "#616166", "booth": "#cfcfcf"},
  "fg-disabled": {"dark": "#6a6a6a", "light": "#a3a3a0", "booth": "#8a8a8a"},
}
BRAND = {  # Elektronauts highlight lavender
  "brand":        {"dark": "#9b85cb", "light": "#6a52a6", "booth": "#c9b9f0"},
  "brand-strong": {"dark": "#b4a2dc", "light": "#56408f", "booth": "#e0d6fa"},
  "brand-soft":   {"dark": "#332b45", "light": "#ebe5f7", "booth": "#271e3d"},
  "on-brand":     {"dark": "#160f26", "light": "#ffffff", "booth": "#000000"},
}
# Studio palette (choice "palette: a"); harmony moved off lavender so it can't be read as the brand.
MODULES = [
  ("graph",    "Graph",       "#6fa8dc", "Explore the track graph: nodes, edges, neighbourhoods."),
  ("library",  "Library",     "#c9a85c", "The crate: every track, filters, rotation, sources."),
  ("sets",     "Set builder", "#e08a5f", "Sets and setlists: running order, energy wave, saved sets."),
  ("paths",    "Pathfinder",  "#d27aa8", "Routes between tracks: start, waypoints, finish."),
  ("harmony",  "Key & mood",  "#5fb8b0", "Camelot keys, mood and energy analysis."),
  ("sources",  "Sources",     "#8fbf6b", "Where tracks come from: tracklists, radio, target tracks, imports."),
  ("pipeline", "Pipeline",    "#7fa1b3", "Scrapers, jobs, enrichment, health and data quality."),
  ("services", "Services",    "#a5a07b", "Connected services and settings: Spotify, TIDAL, API keys."),
]
STATUS = {  # traffic light in every theme (choices "harm: a" and "booth-status: b"); glyph + word always carry the meaning too
  "ok":     {"dark": "#5fd08f", "light": "#1d7a45", "booth": "#6fe0a0"},
  "fair":   {"dark": "#b6d35a", "light": "#5d7414", "booth": "#c6e36a"},
  "warn":   {"dark": "#efb54a", "light": "#8a5a00", "booth": "#f7c35a"},
  "bad":    {"dark": "#ff7469", "light": "#b3261e", "booth": "#ff8a80"},
  "info":   {"dark": "#bbbbbb", "light": "#47474b", "booth": "#e8e8e8"},
}
ENERGY = ["#3b3a8f","#4c3fa6","#6a43b3","#8a47b5","#a94ba9","#c55394","#db6278","#ea795c","#f39a45","#f7c04a"]
CHART = {  # Okabe-Ito based (choice "chart-palette: b"): colour-blind distinguishable; lightened for dark, darkened for light
  "dark":  ["#56b4e9","#e69f00","#3fc29a","#cc79a7","#e8d95a","#5aa0e0","#f08a4b","#999999"],
  "light": ["#0072b2","#b36b00","#007a5a","#b0477f","#8a7d00","#005a8c","#b34700","#6b6b6b"],
}
KEY_NAMES = {"1A":"A♭ minor","1B":"B major","2A":"E♭ minor","2B":"F♯ major","3A":"B♭ minor","3B":"D♭ major",
 "4A":"F minor","4B":"A♭ major","5A":"C minor","5B":"E♭ major","6A":"G minor","6B":"B♭ major","7A":"D minor","7B":"F major",
 "8A":"A minor","8B":"C major","9A":"E minor","9B":"G major","10A":"B minor","10B":"D major","11A":"F♯ minor","11B":"A major",
 "12A":"D♭ minor","12B":"E major"}

# ---------------------------------------------------------------- build colour tokens
tokens = []
def add(name, value, usage):
    tokens.append({"name": name, "value": value, "usage": usage})

U = {
 "bg": "Page background (Elektronauts charcoal in dark). Everything sits on it.",
 "surface-1": "Panels, neutral cards, table body, drawer, dialog.",
 "surface-2": "Raised parts inside a surface-1 panel: table header, hovered row, segmented-control track.",
 "surface-3": "Pressed/selected neutral fills, progress tracks, skeleton shimmer base.",
 "sunk": "Inputs, code wells, the transition strip between set rows.",
 "line": "Dividers and hairlines between rows and sections. Decorative only: never the only edge of a control.",
 "line-strong": "Control borders (inputs, secondary buttons, chips, checkboxes). Holds 3:1 on bg, surface-1 and surface-2.",
 "fg": "Primary text and icons on bg, surface-1, surface-2 and surface-3.",
 "fg-2": "Secondary text: metadata lines, table cells that support the main column. 4.5:1 on bg, surface-1, surface-2.",
 "fg-3": "Tertiary text: the dimmed lead-in of a thin–bold title, captions, column headers. 4.5:1 on bg and surface-1.",
 "fg-disabled": "Disabled labels only (exempt from contrast). Pair with not-allowed cursor and aria-disabled.",
}
for k, v in NEUTRAL.items(): add(k, v, U[k])
add("overlay", {"dark": "rgba(0, 0, 0, 0.55)", "light": "rgba(20, 20, 24, 0.40)", "booth": "rgba(0, 0, 0, 0.80)"}, "Scrim behind drawers and dialogs.")
UB = {"brand": "SongNodes itself: wordmark, the one primary button per view, focus ring, selection outline, the generic link colour where no module applies. Never a status.",
      "brand-strong": "Hover and pressed state of brand fills and brand text.",
      "brand-soft": "Selected row / selected chip background, current item in the drawer.",
      "on-brand": "Text and icons on a brand fill (primary button)."}
for k, v in BRAND.items(): add(k, v, UB[k])
add("link", {"dark": "{brand-strong}", "light": "{brand}", "booth": "{brand}"}, "Generic text link colour where a link leads nowhere module-specific (help, external sites). Dark uses brand-strong so it holds 4.5:1 on surface-1 and surface-2. Always underlined.")
add("focus", "{brand}", "Focus ring: 2px solid, 2px offset, on every interactive element. Brand lavender holds 3:1 on every surface in every theme.")
add("hover-bg", {"dark": "rgba(255, 255, 255, 0.06)", "light": "rgba(0, 0, 0, 0.045)", "booth": "rgba(255, 255, 255, 0.14)"}, "Hover wash on rows, menu items and quiet buttons.")
add("flag-bg", {"dark": "#3a3020", "light": "#fbf0d9", "booth": "#3a2a00"}, "Background for a row or cell flagged for attention (needs an energy check, duplicate, stale). The only tint used for flagging; pair with a warn marker.")

# modules: derive tonal sets from the base hue
for key, label, base, purpose in MODULES:
    L0, C0, H = hex_to_oklch(base)
    mod = {"dark": base, "light": oklch(0.50, min(C0*1.05, 0.14), H), "booth": oklch(0.86, C0*0.8, H)}
    add(f"mod-{key}", mod, f"{label} identity: its menu icon, any text link leading to {label}, chart marks that mean '{label}'. {purpose} Reads 4.5:1 on bg and surface-1.")
    add(f"mod-{key}-bg", {"dark": oklch(0.305, min(C0*0.32, 0.04), H), "light": oklch(0.955, min(C0*0.30, 0.03), H), "booth": oklch(0.20, min(C0*0.35, 0.05), H)},
        f"Tonal card fill for {label} cards and the {label} page header band.")
    add(f"mod-{key}-raised", {"dark": oklch(0.37, min(C0*0.45, 0.055), H), "light": oklch(0.91, min(C0*0.45, 0.045), H), "booth": oklch(0.29, min(C0*0.5, 0.07), H)},
        f"Chips, inner wells and secondary buttons inside a {label} tonal card.")
    add(f"mod-{key}-line", {"dark": oklch(0.45, min(C0*0.55, 0.07), H), "light": oklch(0.83, min(C0*0.55, 0.06), H), "booth": oklch(0.62, min(C0*0.7, 0.10), H)},
        f"Border of a {label} tonal card and dividers inside it.")
    add(f"mod-{key}-ink", {"dark": oklch(0.95, min(C0*0.25, 0.035), H), "light": oklch(0.27, min(C0*0.45, 0.06), H), "booth": oklch(0.99, 0.01, H)},
        f"Titles and primary text inside a {label} tonal card (on mod-{key}-bg and mod-{key}-raised).")
    add(f"mod-{key}-muted", {"dark": oklch(0.82, min(C0*0.5, 0.06), H), "light": oklch(0.40, min(C0*0.6, 0.08), H), "booth": oklch(0.92, min(C0*0.4, 0.05), H)},
        f"Secondary text inside a {label} tonal card.")
    add(f"on-mod-{key}", {"dark": oklch(0.22, min(C0*0.4, 0.05), H), "light": "#ffffff", "booth": "#000000"},
        f"Text on a solid {label} fill (a {label} action button inside its own page, the module chip in the drawer).")

UST = {"ok": "Healthy / passed / perfect transition. Always with the ● glyph or the word.",
       "fair": "Acceptable but not ideal: compatible transition, degraded-but-working. With the ◐ glyph.",
       "warn": "Needs a look: stale data, retrying, needs a check. With the ▲ glyph (compat-possible uses ○).",
       "bad": "Failed / clash / error. With the ✕ glyph. Traffic light in every theme, so the glyph and word are what make it readable without colour.",
       "info": "Neutral information. Deliberately grey: blue belongs to the Graph module."}
for k, v in STATUS.items():
    add(f"status-{k}", v, UST[k] + " Text/icon colour, 4.5:1 on bg, surface-1 and its own -bg.")
    tint = {}
    for t in ("dark", "light", "booth"):
        L, C, H = hex_to_oklch(v[t])
        tint[t] = oklch({"dark": 0.29, "light": 0.95, "booth": 0.18}[t], min(C*0.35, 0.05), H)
    add(f"status-{k}-bg", tint, f"Tinted fill behind a {k} banner, pill or cell.")
add("on-status-bad", {"dark": "#2a0806", "light": "#ffffff", "booth": "#000000"}, "Text on a solid bad fill: the destructive button.")
add("compat-perfect", "{status-ok}", "Transition / harmonic compatibility: perfect (same key, relative major/minor). Glyph ●.")
add("compat-compatible", "{status-fair}", "Compatible (±1 on the Camelot wheel). Glyph ◐.")
add("compat-possible", "{status-warn}", "Possible with care (+2 energy boost, +7 lift, BPM gap 5–8). Glyph ○.")
add("compat-clash", "{status-bad}", "Clash (any other key move, BPM gap > 8, energy jump ≥ +2). Glyph ✕.")
add("progress-fill", "{fg-2}", "Completion bars and rings. Completion is not health, so it is neutral; a health judgement colours the label, never the bar.")
add("progress-track", "{surface-3}", "Unfilled part of progress bars and rings.")

for i, c in enumerate(ENERGY, 1):
    tier = "Low" if i <= 4 else ("Building" if i <= 7 else "High")
    L, C, H = hex_to_oklch(c)
    light = c if i >= 3 else c
    booth = oklch(max(L, 0.45), C, H)
    add(f"energy-{i}", {"dark": c, "light": c, "booth": booth},
        f"Energy {i} of 10 ({tier} tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it.")
for theme in ("dark",):
    pass
for n in range(1, 13):
    H = (165 - (n - 1) * 30) % 360   # wheel hue steps 30° per Camelot position
    for letter, Ld, Ll, Lb in (("A", 0.64, 0.52, 0.72), ("B", 0.80, 0.62, 0.86)):
        code = f"{n}{letter}"
        add(f"key-{code.lower()}", {"dark": oklch(Ld, 0.13, H), "light": oklch(Ll, 0.13, H), "booth": oklch(Lb, 0.14, H)},
            f"Camelot {code} ({KEY_NAMES[code]}). Key dot and wheel segment. {'Minor (A) is the darker ring' if letter=='A' else 'Major (B) is the lighter ring'}; always printed with its code.")
for i in range(8):
    add(f"chart-{i+1}", {"dark": CHART["dark"][i], "light": CHART["light"][i], "booth": CHART["dark"][i]},
        f"Categorical chart series {i+1}. Use in order; more than 8 categories group the tail as 'Other' in chart-8.")
add("chart-grid", {"dark": "#353535", "light": "#e4e4df", "booth": "#3a3a3a"}, "Chart gridlines and the tier band behind the energy wave.")
add("chart-axis", "{fg-3}", "Axis labels and tick text.")
add("chart-ref", {"dark": "#d9d9d9", "light": "#3a3a3d", "booth": "#ffffff"}, "Reference and target lines (target wave, average, threshold): 1.5px dashed 5 4.")
add("on-now", {"dark": "#1f1600", "light": "#ffffff", "booth": "#000000"}, "Text on a solid now fill (the small \"Now\" tag).")
add("now", {"dark": "#f7c04a", "light": "#9a6400", "booth": "#ffd166"}, "The marker for 'now' (choice \"now-marker: c\"): the playing track, the current slot, today's column, the current time on a timeline. Amber, so it never reads as 'selected' (brand lavender). A mark (3:1), not body text.")
add("sim", {"dark": "#8f8f8f", "light": "#76767a", "booth": "#bdbdbd"}, "Simulated or hypothetical data (a proposed set, a preview of a rebuild): hatched with this colour and labelled 'Preview'.")
add("svc-spotify", "#1db954", "Spotify's own green: only on the 'Connect Spotify' button and Spotify source badge, per Spotify's brand rules.")
add("on-svc-spotify", "#000000", "Text on svc-spotify.")
add("svc-tidal", {"dark": "#000000", "light": "#000000", "booth": "#000000"}, "TIDAL's black: only on the 'Connect TIDAL' button (with a 1px white border on dark grounds).")
add("on-svc-tidal", "#ffffff", "Text on svc-tidal.")

# ---------------------------------------------------------------- contrast report
def val(name, theme):
    t = next(x for x in tokens if x["name"] == name)
    v = t["value"]
    if isinstance(v, str):
        if v.startswith("{"): return val(v[1:-1], theme)
        return v
    v = v.get(theme, v["dark"])
    if v.startswith("{"): return val(v[1:-1], theme)
    return v
fails = []
def need(fgn, bgn, minimum, th):
    a, b = val(fgn, th), val(bgn, th)
    if a.startswith("rgba") or b.startswith("rgba"): return
    r = cr(a, b)
    if r < minimum: fails.append(f"{th}: {fgn} on {bgn} = {r:.2f} (< {minimum})")
for th, _ in THEMES:
    T = 7 if th == "booth" else 4.5
    for f in ("fg", "fg-2"):
        for b in ("bg", "surface-1", "surface-2"): need(f, b, T, th)
    for b in ("bg", "surface-1", "surface-2", "sunk"): need("fg-3", b, T if th == "booth" else 4.5, th)
    need("fg", "surface-3", T, th)
    for b in ("bg", "surface-1", "surface-2"): need("line-strong", b, 3, th); need("brand", b, 3, th)
    need("brand", "bg", 4.5, th); need("link", "surface-1", 4.5, th); need("link", "surface-2", 4.5, th); need("on-brand", "brand", 4.5, th)
    need("fg", "brand-soft", T, th)
    for key, *_ in MODULES:
        for b in ("bg", "surface-1"): need(f"mod-{key}", b, T if th=="booth" else 4.5, th)
        for b in (f"mod-{key}-bg", f"mod-{key}-raised"):
            need(f"mod-{key}-ink", b, T, th); need(f"mod-{key}-muted", b, 4.5, th)
        need(f"on-mod-{key}", f"mod-{key}", 4.5, th)
        need(f"mod-{key}-line", f"mod-{key}-bg", 1.4, th)
    for k in STATUS:
        for b in ("bg", "surface-1", f"status-{k}-bg"): need(f"status-{k}", b, 4.5, th)
    need("on-status-bad", "status-bad", 4.5, th)
    for b in ("bg", "surface-1", "surface-2"): need("now", b, 3, th)
    need("on-now", "now", 4.5, th)
    for i in range(1, 9): need(f"chart-{i}", "surface-1", 3, th)
    for n in range(1, 13):
        for l in "ab": need(f"key-{n}{l}", "surface-1", 3, th)
print("CONTRAST FAILS:" if fails else "Contrast: all pairs pass.")
for f in fails: print("  ", f)
# booth ok/bad lightness separation (colour-blind rule)


# ---------------------------------------------------------------- other families
SP = [("space-0","0px","No gap."),("space-0.5","2px","Hairline nudges: energy segment gap, icon-to-badge."),("space-1","4px","Tight: chip padding block, icon-to-label in dense rows."),
      ("space-2","8px","Default gap inside controls and between chips."),("space-3","12px","Gap between form fields in a row; table cell inline padding."),
      ("space-4","16px","Card padding (compact), page side gutter minimum, gap between cards."),("space-5","20px","Card padding (default)."),
      ("space-6","24px","Gap between sections inside a page; drawer padding."),("space-8","32px","Gap between page regions (rail and content)."),
      ("space-10","40px","Space above a section heading."),("space-12","48px","Page top padding below the header on wide screens."),("space-16","64px","Cover and empty-state breathing room.")]
RAD = [("radius-chip","4px","Chips, tags, pills with text, energy segments (2px inside bars), key badges."),("radius-control","8px","Buttons, inputs, selects, segmented controls, menu items, tooltips, table containers."),
       ("radius-card","14px","Cards (tonal and neutral), launcher tiles, figure tiles, popovers."),("radius-sheet","18px","Drawers' inner edge, dialogs, media viewer: the biggest objects."),("radius-pill","999px","Status pills, the toggle switch, progress bars, avatars of services.")]
SH = [("shadow-1",{"dark":"0 1px 2px rgba(0, 0, 0, 0.30)","light":"0 1px 2px rgba(20, 20, 24, 0.08)","booth":"none"},"Resting cards (Ghost style): barely there; the border does the work."),
      ("shadow-2",{"dark":"0 6px 20px rgba(0, 0, 0, 0.45)","light":"0 6px 20px rgba(20, 20, 24, 0.14)","booth":"0 0 0 1px #a8a8a8"},"Popovers, menus, tooltips, the sticky header once scrolled."),
      ("shadow-3",{"dark":"0 18px 48px rgba(0, 0, 0, 0.55)","light":"0 18px 48px rgba(20, 20, 24, 0.22)","booth":"0 0 0 2px #ffffff"},"Drawers and dialogs above the scrim.")]
SIZE = [("control-sm","32px","Small buttons and inputs in dense toolbars and table rows."),("control-md","40px","Default button, input and select height."),("control-lg","48px","Large buttons: empty-state actions, booth mode, touch-first screens."),
        ("touch-min","44px","Minimum hit area for anything tappable on phone and tablet (pad small visuals to reach it)."),("row-compact","32px","Table row height in compact density."),
        ("row-comfortable","40px","Table row height, default density."),("row-two-line","56px","Two-line rows (title + meta) in lists and the running order."),
        ("header-h","56px","App header height."),("drawer-w","300px","Navigation drawer width (max 86vw on phones)."),("rail-w","248px","Filter rail width on desktop."),
        ("content-max","1400px","Max content width; wider screens centre it."),("prose-max","68ch","Max line length for running text and help.")]
Z = [("z-base","0","Page content."),("z-sticky","10","Sticky table headers, sticky filter rail."),("z-header","20","App header."),("z-drawer","40","Navigation drawer and side sheets."),
     ("z-overlay","50","Scrim."),("z-dialog","60","Dialogs and the media viewer."),("z-popover","70","Menus, popovers, context menu, select lists."),("z-toast","80","Toasts."),("z-tooltip","90","Tooltips.")]
DUR = [("duration-instant","0ms","Reduced motion: every duration collapses to this."),("duration-fast","120ms","Hover, press, focus, chip toggle."),("duration-base","200ms","Drawer, dialog, disclosure, tab indicator."),("duration-slow","320ms","Chart transitions and graph camera moves (max).")]
EASE = [("ease-standard","cubic-bezier(0.2, 0, 0, 1)","Everything that moves in or changes size."),("ease-exit","cubic-bezier(0.3, 0, 1, 1)","Elements leaving (drawer close, toast out).")]
BP = [("bp-phone","480px","Below: one column, drawer navigation, tables become cards or scroll in their box."),("bp-tablet","768px","Tablet: rails collapse to a Filters button; two-column cards."),
      ("bp-desktop","1100px","Desktop: filter rail + content; side panels open beside, not over."),("bp-wide","1440px","Wide: three-region layouts (library, graph, panel)."),("bp-wall","1920px","Wall/kiosk: booth theme recommended, type scale steps up one size.")]
OP = [("opacity-disabled","0.45","Disabled controls (with aria-disabled)."),("opacity-faded","0.15","Graph nodes and edges outside the current selection or filter."),("opacity-edge","0.6","Default graph edge opacity; strong edges 0.9.")]

def fam(lst, note=None):
    d = {"tokens": [{"name": n, "value": v, "usage": u} for n, v, u in lst]}
    if note: d["note"] = note
    return d

TYPE = {
 "fonts": [
   {"family": "Sora", "file": "fonts/sora-latin-wght-normal.woff2", "weight": "100 800", "style": "normal"},
   {"family": "Inter", "file": "fonts/inter-latin-wght-normal.woff2", "weight": "100 900", "style": "normal"},
   {"family": "Inter", "file": "fonts/inter-latin-wght-italic.woff2", "weight": "100 900", "style": "italic"},
   {"family": "JetBrains Mono", "file": "fonts/jetbrains-mono-latin-wght-normal.woff2", "weight": "100 800", "style": "normal"}],
 "families": {
   "display": "\"Sora\", \"Inter\", system-ui, sans-serif",
   "body": "\"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif",
   "data": "\"JetBrains Mono\", ui-monospace, Consolas, monospace"},
 "groups": [
  {"name": "Display", "family": "display", "styles": [
    {"name": "display-xl", "fontSize": "2.5rem", "lineHeight": 1.1, "fontWeight": 700, "letterSpacing": "-0.01em", "sample": "Peak time Friday", "usage": "Cover and launcher home title only."},
    {"name": "title-l", "fontSize": "1.75rem", "lineHeight": 1.2, "fontWeight": 700, "sample": "Set builder: Peak time Friday", "usage": "Page title (the bold half of the thin–bold title). One per page."},
    {"name": "title-m", "fontSize": "1.375rem", "lineHeight": 1.25, "fontWeight": 700, "sample": "Running order", "usage": "Section headings inside a page; dialog titles."},
    {"name": "title-s", "fontSize": "1.125rem", "lineHeight": 1.3, "fontWeight": 700, "sample": "Bicep – Glue", "usage": "Card titles, drawer group titles, track title in detail views."},
    {"name": "title-lead", "fontSize": "1em", "lineHeight": 1.2, "fontWeight": 400, "sample": "Set builder:", "usage": "The lead-in of a thin–bold title: same size as the title it precedes, weight 400, colour fg-3 (or mod-*-muted inside a tonal card). Ends with a colon."},
    {"name": "figure", "fontSize": "2rem", "lineHeight": 1.05, "fontWeight": 700, "sample": "1,284", "usage": "Headline figures in figure tiles; tabular numerals."}]},
  {"name": "Text", "family": "body", "styles": [
    {"name": "body-l", "fontSize": "1.0625rem", "lineHeight": 1.55, "fontWeight": 400, "sample": "Energy climbs one point at a time, then drops two or three after a peak.", "usage": "Help text, empty-state explanations, onboarding."},
    {"name": "body", "fontSize": "0.9375rem", "lineHeight": 1.45, "fontWeight": 400, "sample": "Ross From Friends – Talk To Me You'll Drown", "usage": "Default UI and table text (15px, Elektronauts' size)."},
    {"name": "body-strong", "fontSize": "0.9375rem", "lineHeight": 1.45, "fontWeight": 600, "sample": "Bicep – Glue", "usage": "Track titles in rows, button labels, link text."},
    {"name": "body-s", "fontSize": "0.8125rem", "lineHeight": 1.4, "fontWeight": 400, "sample": "Original Mix · Ninja Tune · 6:12", "usage": "Meta lines under titles, helper text under fields, toasts."},
    {"name": "label", "fontSize": "0.75rem", "lineHeight": 1.3, "fontWeight": 600, "letterSpacing": "0.08em", "sample": "ENERGY TIER", "usage": "Column headers, rail group titles, eyebrow labels. Uppercase via CSS only, never typed in caps; keep to 3 words."},
    {"name": "caption", "fontSize": "0.75rem", "lineHeight": 1.35, "fontWeight": 400, "sample": "Library as of 24 Oct 2026, 06:00 AEDT", "usage": "Freshness stamps, chart notes, method text."}]},
  {"name": "Data", "family": "data", "styles": [
    {"name": "data", "fontSize": "0.8125rem", "lineHeight": 1.4, "fontWeight": 400, "sample": "124 BPM · 8A · 6:12", "usage": "BPM, keys, durations, counts and IDs in rows. Tabular by nature."},
    {"name": "data-strong", "fontSize": "0.8125rem", "lineHeight": 1.4, "fontWeight": 600, "sample": "+1 key · +2 BPM", "usage": "Emphasised data: the transition verdict, the current value."},
    {"name": "data-s", "fontSize": "0.6875rem", "lineHeight": 1.35, "fontWeight": 400, "sample": "trk_01HF9Z", "usage": "External IDs (ISRC, Spotify ID), chart tick labels."}]}]}

tok = {
 "name": "SongNodes", "version": "1.4.0",
 "meta": {"source": "Decisions page 24 Oct 2026 + songnodes repo audit + Naarm Set Builder", "generator": "source/build_tokens.py"},
 "color": {"themes": [{"id": t, "name": n} for t, n in THEMES], "tokens": tokens},
 "type": TYPE,
 "spacing": fam(SP, "4px base. Use gap on flex/grid, never margins between siblings."),
 "radius": fam(RAD, "Three-step shape scale: the rounder, the bigger and more 'object' it is."),
 "shadow": fam(SH, "Depth means 'floats above the page'. Cards rest at shadow-1; only floating layers get more."),
 "size": fam(SIZE),
 "zIndex": fam(Z),
 "duration": fam(DUR, "Reduced motion sets every duration to 0ms except progress indication."),
 "easing": fam(EASE),
 "breakpoint": fam(BP),
 "opacity": fam(OP),
}
with open(os.path.join(OUT, "tokens.json"), "w", encoding="utf-8") as f:
    json.dump(tok, f, ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- tokens.css (laid out as the page compiles it)
def cssval(v):
    return f"var(--{v[1:-1]})" if isinstance(v, str) and v.startswith("{") else v
lines = ["/* SongNodes — generated from tokens.json */"]
first = THEMES[0][0]
def block(sel, th, only_diff):
    out = []
    for t in tokens:
        v = t["value"]
        if isinstance(v, dict):
            vv = v.get(th)
            if vv is None: continue
            if only_diff and vv == v.get(first) and not str(vv).startswith("{"): continue
            out.append(f"  --{t['name'].replace('.', '\\.')}: {cssval(vv)};")
        elif not only_diff:
            out.append(f"  --{t['name']}: {cssval(v)};")
        elif str(v).startswith("{"):
            out.append(f"  --{t['name']}: {cssval(v)};")
    for n, v, u in SH:
        vv = v.get(th) if isinstance(v, dict) else v
        out.append(f"  --{n}: {vv};")
    return f"{sel} {{\n" + "\n".join(out) + "\n}"
lines.append(block(f':root, [data-theme="{first}"]', first, False))
for th, _ in THEMES[1:]:
    lines.append(block(f'[data-theme="{th}"]', th, True))
other = []
for famname in ("spacing", "radius", "size", "zIndex", "duration", "easing", "breakpoint", "opacity"):
    for t in tok[famname]["tokens"]:
        other.append(f"  --{t['name'].replace('.', '\\.')}: {t['value']};")
for k, v in TYPE["families"].items(): other.append(f"  --font-{k}: {v};")
lines.append(":root {\n" + "\n".join(other) + "\n}")
for g in TYPE["groups"]:
    for s in g["styles"]:
        fam_ = s.get("family", g["family"])
        decl = [f"font-family: var(--font-{fam_})", f"font-size: {s['fontSize']}", f"line-height: {s['lineHeight']}", f"font-weight: {s['fontWeight']}"]
        if "letterSpacing" in s: decl.append(f"letter-spacing: {s['letterSpacing']}")
        lines.append(f".{s['name']} {{ " + "; ".join(decl) + "; }")
for fnt in TYPE["fonts"]:
    lines.append(f"@font-face {{ font-family: \"{fnt['family']}\"; src: url(\"{fnt['file']}\") format(\"woff2\"); font-weight: {fnt['weight']}; font-style: {fnt['style']}; font-display: swap; }}")
with open(os.path.join(OUT, "tokens.css"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
# system-theme fallback and print: light values when no data-theme is set / on paper
def light_decls():
    out=[]
    for t in tokens:
        v=t["value"]
        if isinstance(v,dict) and "light" in v: out.append(f"  --{t['name']}: {cssval(v['light'])};")
    for n,v,u in SH: out.append(f"  --{n}: {v['light'] if isinstance(v,dict) else v};")
    return "\n".join(out)
media = "/* generated by build_tokens.py: light values for 'system' before JS runs, and for print */\n"
media += "@media (prefers-color-scheme: light) {\n:root:not([data-theme]) {\n" + light_decls() + "\n  color-scheme: light;\n}\n}\n"
media += "@media print {\n:root, [data-theme] {\n" + light_decls() + "\n  color-scheme: light;\n}\n}\n"
open(os.path.join(OUT, "source", "css", "02-theme-media.css"), "w", encoding="utf-8").write(media)
print(len(tokens), "colour tokens written")
