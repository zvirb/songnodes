/* SongNodes helpers: one classic script, no imports, no network. Assigns window.SongNodes.
   Build: source/build_bundle.py inlines the icon map (__ICONS__) and writes components/bundle.js. */
(function () {
  "use strict";
  var ICONS = __ICONS__;
  var TZ = "Australia/Melbourne";
  var LOCALE = "en-AU";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- modules (identity colours) ---------- */
  var MODULES = [
    { key: "graph", label: "Graph", icon: "share-2", summary: "Explore how tracks connect" },
    { key: "library", label: "Library", icon: "library-big", summary: "Every track, filtered and sorted" },
    { key: "sets", label: "Set builder", icon: "list-music", summary: "Running order, energy wave, saved sets" },
    { key: "paths", label: "Pathfinder", icon: "route", summary: "Routes from one track to another" },
    { key: "harmony", label: "Key & mood", icon: "piano", summary: "Camelot keys, mood and energy" },
    { key: "sources", label: "Sources", icon: "radio-tower", summary: "Tracklists, radio, targets and imports" },
    { key: "pipeline", label: "Pipeline", icon: "activity", summary: "Scrapers, jobs, health and data quality" },
    { key: "services", label: "Services", icon: "plug", summary: "Spotify, TIDAL, API keys and settings" }
  ];

  /* ---------- icons ---------- */
  var WARNED = {};
  function icon(name, opts) {
    opts = opts || {};
    var inner = ICONS[name];
    if (!inner) { if (window.console && !WARNED[name]) { WARNED[name] = 1; console.warn("SongNodes.icon: \"" + name + "\" is not in the icon set; drawing circle-help. Add the icon to assets/Icons or use one of SongNodes.iconNames."); } inner = ICONS["circle-help"]; }
    var size = opts.size || 18;
    var a11y = opts.label ? ' role="img" aria-label="' + esc(opts.label) + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="sn-icon' + (opts.cls ? " " + esc(opts.cls) : "") + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' + a11y + '>' + inner + "</svg>";
  }

  /* ---------- Camelot ---------- */
  var KEY_NAMES = { "1A": "A♭ minor", "1B": "B major", "2A": "E♭ minor", "2B": "F♯ major", "3A": "B♭ minor", "3B": "D♭ major", "4A": "F minor", "4B": "A♭ major", "5A": "C minor", "5B": "E♭ major", "6A": "G minor", "6B": "B♭ major", "7A": "D minor", "7B": "F major", "8A": "A minor", "8B": "C major", "9A": "E minor", "9B": "G major", "10A": "B minor", "10B": "D major", "11A": "F♯ minor", "11B": "A major", "12A": "D♭ minor", "12B": "E major" };
  var NOTE = { "C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6, "GB": 6, "G": 7, "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11 };
  var MINOR_BY_PC = { 8: "1A", 3: "2A", 10: "3A", 5: "4A", 0: "5A", 7: "6A", 2: "7A", 9: "8A", 4: "9A", 11: "10A", 6: "11A", 1: "12A" };
  var MAJOR_BY_PC = { 11: "1B", 6: "2B", 1: "3B", 8: "4B", 3: "5B", 10: "6B", 5: "7B", 0: "8B", 7: "9B", 2: "10B", 9: "11B", 4: "12B" };
  /** Normalise "8a", "Am", "A minor", "F#m", "Eb" to a Camelot code, or null. */
  function camelot(input) {
    if (input == null) return null;
    var s = String(input).trim().replace("♯", "#").replace("♭", "b");
    var m = /^(1[0-2]|[1-9])\s*([AaBb])$/.exec(s);
    if (m) return m[1] + m[2].toUpperCase();
    m = /^([A-Ga-g])([#b]?)\s*(m|min|minor|maj|major)?$/.exec(s);
    if (!m) return null;
    var pc = NOTE[(m[1] + m[2]).toUpperCase()];
    if (pc == null) return null;
    var minor = m[3] && /^m(in(or)?)?$/i.test(m[3]) && !/^maj/i.test(m[3]);
    return minor ? MINOR_BY_PC[pc] : MAJOR_BY_PC[pc];
  }
  function keyName(code) { code = camelot(code); return code ? KEY_NAMES[code] : null; }
  /** Harmonic compatibility of a move from key a to key b: perfect | compatible | possible | clash | unknown. */
  function compat(a, b) {
    a = camelot(a); b = camelot(b);
    if (!a || !b) return { level: "unknown", label: "key ?" };
    var na = parseInt(a, 10), nb = parseInt(b, 10), la = a.slice(-1), lb = b.slice(-1);
    var d = ((nb - na) % 12 + 12) % 12;
    if (la === lb) {
      if (d === 0) return { level: "perfect", label: "same key" };
      if (d === 1) return { level: "compatible", label: "+1 key" };
      if (d === 11) return { level: "compatible", label: "−1 key" };
      if (d === 2) return { level: "possible", label: "+2 energy boost" };
      if (d === 10) return { level: "possible", label: "−2 energy drop" };
      if (d === 7) return { level: "possible", label: "+7 lift" };
      return { level: "clash", label: "key clash" };
    }
    if (d === 0) return { level: "perfect", label: "relative " + la + "↔" + lb };
    return { level: "clash", label: "key clash" };
  }

  /* ---------- energy ---------- */
  function tier(e) { e = Number(e); if (!e) return null; return e <= 4 ? "low" : e <= 7 ? "building" : "high"; }
  var TIER_LABEL = { low: "Low 1–4", building: "Building 5–7", high: "High 8–10" };
  /** Judge an energy step between consecutive set tracks (Naarm rules). */
  function energyStep(prev, next, before) {
    if (!prev || !next) return { level: "unknown", label: "energy ?" };
    var d = next - prev;
    if (d >= 2) return { level: "clash", label: "energy +" + d + ": too steep, step up one at a time" };
    if (d === 1) return { level: "perfect", label: "energy +1" };
    if (d <= -2) return { level: "perfect", label: "drop −" + Math.abs(d) + ": trough reset" };
    if (d === -1) return before && prev - before === -1 ? { level: "possible", label: "second −1 in a row: drop 2–3 at once instead" } : { level: "compatible", label: "energy −1" };
    return { level: "perfect", label: "energy hold" };
  }
  function bpmStep(a, b) {
    if (!a || !b) return { level: "unknown", label: "BPM ?" };
    var d = Math.round(b - a), ad = Math.abs(d), sign = d >= 0 ? "+" : "−";
    var lvl = ad <= 2 ? "perfect" : ad <= 4 ? "compatible" : ad <= 8 ? "possible" : "clash";
    return { level: lvl, label: d === 0 ? "same BPM" : sign + Math.abs(d) + " BPM" };
  }

  /* ---------- formatting (en-AU, Melbourne time, 24-hour) ---------- */
  function toDate(d) { return d instanceof Date ? d : new Date(d); }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  /** Calendar parts of an instant in Melbourne time. */
  function parts(d) {
    try {
      var p = {}; new Intl.DateTimeFormat("en-AU", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(toDate(d)).forEach(function (x) { p[x.type] = x.value; });
      var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[String(p.weekday).slice(0, 3)];
      return { y: +p.year, m: +p.month, d: +p.day, wd: wd, hh: p.hour === "24" ? "00" : p.hour, mm: p.minute };
    } catch (e) { return null; }
  }
  /** Date-only values ("2026-10-24") are calendar dates, never shifted by time zone. */
  function dateOnly(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); return m ? { y: +m[1], m: +m[2], d: +m[3], wd: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() } : null; }
  function fmt(d, o) { try { return new Intl.DateTimeFormat(LOCALE, Object.assign({ timeZone: TZ }, o)).format(toDate(d)); } catch (e) { return ""; } }
  var format = {
    date: function (d) { var p = dateOnly(d) || parts(d); return p ? p.d + " " + MONTHS[p.m - 1] + " " + p.y : ""; },   // 24 Oct 2026
    day: function (d) { var p = dateOnly(d) || parts(d); return p ? WDAYS[p.wd] + " " + p.d + " " + MONTHS[p.m - 1] : ""; },  // Sat 24 Oct
    month: function (d) { var p = dateOnly(d) || parts(d); return p ? MONTHS[p.m - 1] + " " + p.y : ""; },              // Oct 2026
    time: function (d) { var p = parts(d); return p ? p.hh + ":" + p.mm : ""; },                                       // 21:30
    dateTime: function (d) { return format.date(d) + ", " + format.time(d); },                                 // 24 Oct 2026, 21:30
    zone: function (d) { var p = ""; try { p = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, timeZoneName: "short" }).formatToParts(toDate(d)).filter(function (x) { return x.type === "timeZoneName"; })[0].value; } catch (e) {} return p; },
    stamp: function (d) { return format.dateTime(d) + " " + format.zone(d); },                                // 24 Oct 2026, 21:30 AEDT
    relative: function (d, now) {
      var s = Math.round(((now ? toDate(now) : new Date()) - toDate(d)) / 1000);
      if (s < 45) return "just now";
      if (s < 3600) return Math.round(s / 60) + " min ago";
      if (s < 86400) return Math.round(s / 3600) + " h ago";
      if (s < 7 * 86400) return Math.round(s / 86400) + " d ago";
      return format.date(d);
    },
    /** Duration from SECONDS (convert ms first): 6:12, or 1:32:05 when over an hour. */
    duration: function (sec) {
      if (sec == null || isNaN(sec)) return "–";
      sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
      return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
    },
    /** Long duration for set lengths: "1 h 32 min", "45 min". */
    span: function (sec) { var m = Math.round(sec / 60), h = Math.floor(m / 60); return h ? h + " h" + (m % 60 ? " " + (m % 60) + " min" : "") : m + " min"; },
    count: function (n) { return n == null ? "–" : Number(n).toLocaleString(LOCALE); },
    bpm: function (b) { return b == null ? "–" : (Math.round(b * 10) / 10).toLocaleString(LOCALE, { maximumFractionDigits: 1 }); },
    percent: function (x, digits) { return x == null ? "–" : (x * 100).toFixed(digits || 0) + "%"; },   // 65% (no space)
    dateOnly: function (s) { var p = dateOnly(s); return p ? p.d + " " + MONTHS[p.m - 1] + " " + p.y : ""; },
    /** "Tuesday 3 November 2026" (date-only ISO or an instant in Melbourne time). */
    dayLong: function (d) { var p = dateOnly(d) || parts(d); return p ? WDAYS_LONG[p.wd] + " " + p.d + " " + MONTHS_LONG[p.m - 1] + " " + p.y : ""; },
    /** Date-only span in words: "Mon 9 – Fri 13 Nov 2026", "Mon 30 Nov – Fri 4 Dec 2026", "Mon 28 Dec 2026 – Fri 8 Jan 2027", one day "Mon 9 Nov 2026". */
    range: function (a, b) {
      var p = dateOnly(a), q = dateOnly(b);
      if (!p && !q) return "";
      if (!p || !q) { p = p || q; return WDAYS[p.wd] + " " + p.d + " " + MONTHS[p.m - 1] + " " + p.y; }
      if (a > b) { var t = p; p = q; q = t; }
      var end = WDAYS[q.wd] + " " + q.d + " " + MONTHS[q.m - 1] + " " + q.y;
      if (p.y === q.y && p.m === q.m && p.d === q.d) return end;
      if (p.y === q.y && p.m === q.m) return WDAYS[p.wd] + " " + p.d + " – " + end;
      if (p.y === q.y) return WDAYS[p.wd] + " " + p.d + " " + MONTHS[p.m - 1] + " – " + end;
      return WDAYS[p.wd] + " " + p.d + " " + MONTHS[p.m - 1] + " " + p.y + " – " + end;
    }
  };

  /* ---------- calendar (date-only ISO strings, Monday-first weeks, Melbourne "today") ---------- */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function isoOf(y, m, d) { var t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() + "-" + pad2(t.getUTCMonth() + 1) + "-" + pad2(t.getUTCDate()); }
  function utc(iso) { var p = dateOnly(iso); return p ? Date.UTC(p.y, p.m - 1, p.d) : NaN; }
  var calendar = {
    /** Today's date in Melbourne as "2026-10-28" (never the device's UTC date). */
    today: function (now) { var p = parts(now || new Date()); return p ? isoOf(p.y, p.m, p.d) : null; },
    iso: isoOf,
    /** Weeks of month m (1–12) of year y, Monday first; each week is 7 entries of {iso, y, m, d, wd} or null padding. */
    month: function (y, m) {
      var first = new Date(Date.UTC(y, m - 1, 1)), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
      var lead = (first.getUTCDay() + 6) % 7, weeks = [], week = [], i;
      for (i = 0; i < lead; i++) week.push(null);
      for (i = 1; i <= n; i++) {
        week.push({ iso: isoOf(y, m, i), y: y, m: m, d: i, wd: (first.getUTCDay() + i - 1) % 7 });
        if (week.length === 7) { weeks.push(week); week = []; }
      }
      if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
      return weeks;
    },
    addDays: function (iso, n) { var t = utc(iso); if (isNaN(t)) return null; t = new Date(t + n * 86400000); return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); },
    /** Same day number n months on, clamped to the month's last day (31 Jan + 1 → 28 Feb). */
    addMonths: function (iso, n) {
      var p = dateOnly(iso); if (!p) return null;
      var k = p.y * 12 + (p.m - 1) + n, y = Math.floor(k / 12), m = k - y * 12 + 1, last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return isoOf(y, m, Math.min(p.d, last));
    },
    /** -1, 0 or 1. */
    compare: function (a, b) { return a === b ? 0 : (a < b ? -1 : 1); },
    /** Days from a to b inclusive (order-free): days("2026-11-09", "2026-11-13") = 5. */
    days: function (a, b) { var x = utc(a), y = utc(b); return isNaN(x) || isNaN(y) ? 0 : Math.abs(Math.round((y - x) / 86400000)) + 1; },
    /** Monday of the week holding iso. */
    weekStart: function (iso) { var p = dateOnly(iso); return p ? calendar.addDays(iso, -((p.wd + 6) % 7)) : null; },
    /** Built-in preset spans as [from, to]; ids: last-7-days, last-30-days, this-year, last-week, this-week, next-week. */
    preset: function (id, today) {
      var t = today || calendar.today(), mon = calendar.weekStart(t);
      switch (id) {
        case "last-7-days": return [calendar.addDays(t, -6), t];
        case "last-30-days": return [calendar.addDays(t, -29), t];
        case "this-year": return [t.slice(0, 4) + "-01-01", t];
        case "last-week": return [calendar.addDays(mon, -7), calendar.addDays(mon, -1)];
        case "this-week": return [mon, calendar.addDays(mon, 6)];
        case "next-week": return [calendar.addDays(mon, 7), calendar.addDays(mon, 13)];
      }
      return null;
    },
    PRESET_LABELS: { "last-7-days": "Last 7 days", "last-30-days": "Last 30 days", "this-year": "This year", "last-week": "Last week", "this-week": "This week", "next-week": "Next week" },
    MONTHS_LONG: MONTHS_LONG, WDAYS_LONG: WDAYS_LONG
  };

  /* ---------- status vocabulary: backend enums -> one design status ---------- */
  var STATUS_MAP = {
    // scraper / task / processing
    pending: ["idle", "Queued"], queued: ["idle", "Queued"], running: ["running", "Running"], processing: ["running", "Processing"], in_progress: ["running", "In progress"], validating: ["running", "Validating"],
    completed: ["ok", "Done"], success: ["ok", "Done"], skipped: ["idle", "Skipped"], partial: ["warn", "Partly done"], cancelled: ["idle", "Cancelled"], timeout: ["bad", "Timed out"], failed: ["bad", "Failed"], error: ["bad", "Error"],
    idle: ["idle", "Idle"], disabled: ["idle", "Off"], circuit_open: ["bad", "Paused after errors"], cooldown: ["warn", "Cooling down"],
    // health
    healthy: ["ok", "Healthy"], ok: ["ok", "OK"], degraded: ["warn", "Degraded"], unhealthy: ["bad", "Down"], critical: ["bad", "Critical"], untested: ["idle", "Not tested"], not_configured: ["idle", "Not set up"], not_initialized: ["idle", "Starting"],
    // circuit breaker
    closed: ["ok", "Normal"], half_open: ["warn", "Testing"], open: ["bad", "Paused after errors"],
    // validation severity
    warning: ["warn", "Warning"], info: ["info", "Note"],
    // save
    saving: ["running", "Saving…"], saved: ["ok", "Saved"]
  };
  var GLYPH = { ok: "●", fair: "◐", warn: "▲", bad: "✕", info: "i", running: "↻", idle: "–", perfect: "●", compatible: "◐", possible: "○", clash: "✕", unknown: "?" };
  /* domain-specific vocabularies that reuse the words low/medium/high */
  var DOMAIN_MAP = {
    confidence: { high: ["ok", "High confidence"], medium: ["fair", "Medium confidence"], low: ["warn", "Low confidence"] },
    priority: { critical: ["bad", "Critical"], high: ["info", "High priority"], medium: ["idle", "Medium priority"], low: ["idle", "Low priority"] }
  };
  /** status(rawEnum, domain?) -> {status, label, glyph}. Pass domain "confidence" or "priority" for low/medium/high. */
  function status(raw, domain) { var k = String(raw || "").toLowerCase(); var v = (domain && DOMAIN_MAP[domain] && DOMAIN_MAP[domain][k]) || STATUS_MAP[k]; return v ? { status: v[0], label: v[1], glyph: GLYPH[v[0]] } : { status: "info", label: String(raw == null ? "–" : raw), glyph: GLYPH.info }; }

  /* ---------- HTML string helpers (for artifacts and previews; React apps mirror the markup) ---------- */
  var html = {
    energy: function (e) {
      if (!e) return '<span class="sn-none">–</span>';
      var segs = ""; for (var i = 1; i <= 10; i++) segs += '<i class="' + (i <= e ? "on" : "") + '"></i>';
      return '<span class="sn-energy" title="Energy ' + e + " · " + TIER_LABEL[tier(e)] + '"><span class="sn-energy__bar" aria-hidden="true">' + segs + '</span><span class="sn-energy__n">' + e + '</span><span class="sn-sr"> of 10, ' + tier(e) + " tier</span></span>";
    },
    key: function (k, withName) {
      var c = camelot(k);
      if (!c) return '<span class="sn-key" data-unknown><span aria-hidden="true">–</span><span class="sn-sr">Key unknown</span></span>';
      return '<span class="sn-key" data-key="' + c + '" title="' + esc(KEY_NAMES[c]) + '">' + c + (withName ? ' <span class="sn-key__name">' + esc(KEY_NAMES[c]) + "</span>" : "") + "</span>";
    },
    pill: function (raw, label) { var s = status(raw); return '<span class="sn-pill" data-status="' + s.status + '">' + esc(label || s.label) + "</span>"; },
    compat: function (level, label) { return '<span class="sn-pill" data-compat="' + esc(level) + '">' + esc(label || level) + "</span>"; },
    link: function (mod, href, text) { return '<a class="sn-link sn-m-' + esc(mod) + '" href="' + esc(href) + '">' + esc(text) + "</a>"; },
    title: function (lead, title, size) { return '<h1 class="sn-title ' + (size || "title-l") + '"><span class="sn-lead">' + esc(lead) + ":</span> " + esc(title) + "</h1>"; }
  };

  /* ---------- DateRange: the calendar popover body (components/DateRange/README.md) ----------
     dateRange(el, opts) renders into el (div.sn-date-range) and returns {set, get, focus, show, el}.
     opts: from, to (ISO or null), today (ISO; default Melbourne today), title (popover title), outcome
     (button label, default "Use these dates"), presets (ids from calendar.PRESET_LABELS or
     {id, label, range:[from, to]}), marks ([{date, code?, name, kind}]; no code = a data dot),
     onChange(from, to, presetId), onApply(from, to), onClear(), onClose(). */
  function dateRange(el, opts) {
    opts = opts || {};
    var C = calendar, today = opts.today || C.today(), uid = "sn-dr-" + (++dateRange.n);
    var from = opts.from || null, to = opts.to || null, pressed = opts.preset || null;
    var marks = {}, key = [], seen = {};
    (opts.marks || []).forEach(function (mk) {
      (marks[mk.date] = marks[mk.date] || []).push(mk);
      var k = (mk.code || "·") + "|" + mk.kind;
      if (!seen[k]) { seen[k] = 1; key.push(mk); }
    });
    var presets = (opts.presets || ["last-7-days", "last-30-days", "this-year"]).map(function (p) {
      return typeof p === "string" ? { id: p, label: C.PRESET_LABELS[p], range: function () { return C.preset(p, today); } } : { id: p.id, label: p.label, range: typeof p.range === "function" ? p.range : function () { return p.range; } };
    });
    var focusIso = from || today, view = (from || today).slice(0, 8) + "01";

    el.classList.add("sn-date-range");
    el.innerHTML =
      '<div class="sn-popover__head"><h3 class="sn-popover__title" id="' + uid + '-t" tabindex="-1">' + esc(opts.title || "Pick the dates") + "</h3>" +
      '<button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" type="button" aria-label="Close" title="Close" data-dr="close">' + icon("x") + "</button></div>" +
      '<div class="sn-date-range__body"><div class="sn-date-range__months"></div>' +
      (presets.length ? '<div class="sn-date-range__presets" role="group" aria-label="Preset dates">' + presets.map(function (p) { return '<button type="button" class="sn-chip" aria-pressed="false" data-preset="' + esc(p.id) + '">' + esc(p.label) + "</button>"; }).join("") + "</div>" : "") +
      "</div>" +
      (key.length ? '<ul class="sn-date-range__key" aria-label="Key">' + key.map(function (mk) { return "<li>" + (mk.code ? '<span class="sn-date-range__code">' + esc(mk.code) + "</span>" : '<span class="sn-date-range__dot" aria-hidden="true"></span>') + " " + esc(mk.kind) + "</li>"; }).join("") + '<li><span class="sn-date-range__now-bar" aria-hidden="true"></span> Today</li></ul>' : "") +
      '<div class="sn-date-range__foot"><p class="sn-date-range__sum"></p>' +
      '<button type="button" class="sn-btn sn-btn--quiet" data-dr="clear">Clear</button>' +
      '<button type="button" class="sn-btn" data-dr="apply">' + esc(opts.outcome || "Use these dates") + "</button></div>" +
      '<p class="sn-sr" role="status" aria-live="polite" id="' + uid + '-live"></p>';
    el.setAttribute("role", el.getAttribute("role") || "dialog");
    el.setAttribute("aria-labelledby", uid + "-t");
    var monthsEl = el.querySelector(".sn-date-range__months"), live = el.querySelector("#" + uid + "-live"), sumEl = el.querySelector(".sn-date-range__sum");

    function rangeOf(iso) {
      if (!from) return null;
      var b = to || from;
      if (iso === from && iso === b) return "single";
      if (iso === from) return "start";
      if (iso === b) return "end";
      return iso > from && iso < b ? "in" : null;
    }
    function nameOf(iso, r) {
      var s = format.dayLong(iso);
      (marks[iso] || []).forEach(function (mk) { s += ", " + mk.name + (mk.kind && mk.kind.toLowerCase() !== mk.name.toLowerCase() ? ", " + mk.kind.toLowerCase() : ""); });
      if (iso === today) s += ", today";
      if (r === "start") s += ", start of range"; else if (r === "end") s += ", end of range"; else if (r === "in") s += ", in range"; else if (r === "single") s += ", start and end of range";
      return s;
    }
    function monthHtml(first, idx) {
      var y = +first.slice(0, 4), m = +first.slice(5, 7), id = uid + "-m" + idx;
      var head = '<div class="sn-date-range__head">' +
        (idx === 0 ? '<button type="button" class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" data-dr="prev" aria-label="Previous month" title="Previous month">' + icon("chevron-left") + "</button>" : '<span class="sn-date-range__spacer"></span>') +
        '<h4 class="sn-date-range__title" id="' + id + '">' + MONTHS_LONG[m - 1] + " " + y + "</h4>" +
        '<button type="button" class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet' + (idx === 0 ? " sn-date-range__next" : "") + '" data-dr="next" aria-label="Next month" title="Next month">' + icon("chevron-right") + "</button></div>";
      var rows = C.month(y, m).map(function (w) {
        return "<tr>" + w.map(function (c) {
          if (!c) return '<td role="gridcell" class="sn-date-range__blank"></td>';
          var r = rangeOf(c.iso), mk = marks[c.iso] || [], code = mk.filter(function (x) { return x.code; })[0], dot = mk.filter(function (x) { return !x.code; })[0];
          var tip = mk.map(function (x) { return x.name; }).concat(c.iso === today ? ["Today"] : []).join(" · ");
          return '<td role="gridcell"' + (r ? ' aria-selected="true"' : "") + ">" +
            '<button type="button" class="sn-date-range__day" data-iso="' + c.iso + '" tabindex="' + (c.iso === focusIso ? 0 : -1) + '"' +
            (r ? ' data-range="' + r + '"' : "") + (c.iso === today ? ' data-today aria-current="date"' : "") + (code ? ' data-mark' : "") +
            (tip ? ' title="' + esc(tip) + '"' : "") + ' aria-label="' + esc(nameOf(c.iso, r)) + '">' +
            '<span class="sn-date-range__n">' + c.d + "</span>" +
            (code ? '<span class="sn-date-range__mark" aria-hidden="true">' + esc(code.code) + "</span>" : "") +
            (dot ? '<span class="sn-date-range__dot" aria-hidden="true"></span>' : "") + "</button></td>";
        }).join("") + "</tr>";
      }).join("");
      var dow = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(function (d) { return '<th scope="col" abbr="' + d + '" class="sn-date-range__dow"><span aria-hidden="true">' + d.slice(0, 2) + '</span><span class="sn-sr">' + d + "</span></th>"; }).join("");
      return '<div class="sn-date-range__month">' + head + '<table class="sn-date-range__grid" role="grid" aria-labelledby="' + id + '"><thead><tr>' + dow + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    }
    function render(keepFocus) {
      var had = keepFocus && el.contains(document.activeElement) && document.activeElement.classList.contains("sn-date-range__day");
      monthsEl.innerHTML = monthHtml(view, 0) + monthHtml(C.addMonths(view, 1), 1);
      // the roving tab stop must be on a rendered day
      if (!monthsEl.querySelector('[tabindex="0"]')) { var b = monthsEl.querySelector(".sn-date-range__day"); if (b) { b.tabIndex = 0; focusIso = b.getAttribute("data-iso"); } }
      el.querySelectorAll("[data-preset]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-preset") === pressed)); });
      sumEl.innerHTML = from ? "<b>" + esc(format.range(from, to || from)) + "</b>" + (to ? " · " + C.days(from, to) + (C.days(from, to) === 1 ? " day" : " days") : " · pick the end date") : "No dates picked";
      el.querySelector('[data-dr="apply"]').setAttribute("aria-disabled", String(!from));
      if (had) focusDay(focusIso);
    }
    function visible(iso) { var b = monthsEl.querySelector('[data-iso="' + iso + '"]'); return b && b.offsetParent !== null ? b : null; }
    function moveTo(iso) {
      focusIso = iso;
      if (!visible(iso)) {
        var first = iso.slice(0, 8) + "01", one = !monthsEl.children[1] || monthsEl.children[1].offsetParent === null;
        view = !one && first > view ? C.addMonths(first, -1) : first;
        render(false);
      }
      monthsEl.querySelectorAll('.sn-date-range__day[tabindex="0"]').forEach(function (b) { b.tabIndex = -1; });
      focusDay(iso);
    }
    function focusDay(iso) { var b = visible(iso); if (b) { b.tabIndex = 0; b.focus(); } }
    function say(s) { live.textContent = ""; setTimeout(function () { live.textContent = s; }, 30); }
    function changed(announce) {
      render(true);
      if (announce) say(from && to ? format.range(from, to) + ", " + C.days(from, to) + (C.days(from, to) === 1 ? " day" : " days") + " picked." : from ? "From " + format.dayLong(from) + ". Now pick the end date." : "Dates cleared.");
      if (opts.onChange) opts.onChange(from, to, pressed);
    }
    function pick(iso) {
      pressed = null; focusIso = iso;
      if (!from || to) { from = iso; to = null; }
      else if (iso < from) { to = from; from = iso; }
      else { to = iso; }
      changed(true);
    }
    function showRange() {
      if (!from) return;
      var a = from.slice(0, 8) + "01", b = (to || from).slice(0, 8) + "01", one = monthsEl.children[1] && monthsEl.children[1].offsetParent === null;
      view = one || a === b || C.addMonths(a, 1) === b ? a : C.addMonths(b, -1);
      focusIso = a === view ? from : (to || from);
    }

    el.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t || !el.contains(t)) return;
      var a = t.getAttribute("data-dr");
      if (t.classList.contains("sn-date-range__day")) { pick(t.getAttribute("data-iso")); return; }
      if (t.hasAttribute("data-preset")) {
        var p = presets.filter(function (x) { return x.id === t.getAttribute("data-preset"); })[0], r = p.range();
        from = r[0]; to = r[1]; pressed = p.id; showRange(); render(false);
        say(p.label + ": " + format.range(from, to) + ", " + C.days(from, to) + " days.");
        if (opts.onChange) opts.onChange(from, to, pressed);
        return;
      }
      if (a === "prev" || a === "next") { view = C.addMonths(view, a === "prev" ? -1 : 1); focusIso = view; render(false); say(el.querySelector(".sn-date-range__title").textContent); return; }
      if (a === "clear") { from = to = null; pressed = null; changed(true); if (opts.onClear) opts.onClear(); return; }
      if (a === "apply") { if (!from) return; if (!to) to = from; if (opts.onApply) opts.onApply(from, to); return; }
      if (a === "close" && opts.onClose) opts.onClose();
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (opts.onClose) opts.onClose(); return; }
      var t = e.target; if (!t.classList || !t.classList.contains("sn-date-range__day")) return;
      var iso = t.getAttribute("data-iso"), wd = (dateOnly(iso).wd + 6) % 7, n = null;
      switch (e.key) {
        case "ArrowLeft": n = C.addDays(iso, -1); break;
        case "ArrowRight": n = C.addDays(iso, 1); break;
        case "ArrowUp": n = C.addDays(iso, -7); break;
        case "ArrowDown": n = C.addDays(iso, 7); break;
        case "Home": n = C.addDays(iso, -wd); break;
        case "End": n = C.addDays(iso, 6 - wd); break;
        case "PageUp": n = C.addMonths(iso, e.shiftKey ? -12 : -1); break;
        case "PageDown": n = C.addMonths(iso, e.shiftKey ? 12 : 1); break;
        case "Enter": case " ": e.preventDefault(); pick(iso); return;
        default: return;
      }
      e.preventDefault(); moveTo(n);
    });

    render(false); showRange(); render(false);
    var api = {
      el: el,
      get: function () { return { from: from, to: to, preset: pressed }; },
      /** Set from typed dates (unpresses any preset) and show them in the months. */
      set: function (a, b, presetId) { from = a || null; to = b || null; if (from && to && to < from) { var x = from; from = to; to = x; } pressed = presetId || null; showRange(); render(false); },
      /** Move keyboard focus into the grid: the From day, else today. */
      focus: function () { var iso = from || today; if (!visible(iso)) { view = iso.slice(0, 8) + "01"; render(false); } focusIso = iso; monthsEl.querySelectorAll('.sn-date-range__day[tabindex="0"]').forEach(function (b) { b.tabIndex = -1; }); focusDay(iso); },
      show: function (iso) { view = iso.slice(0, 8) + "01"; render(false); }
    };
    return api;
  }
  dateRange.n = 0;

  /* ---------- CSV (15-print-export: UTF-8 with BOM, CRLF, RFC 4180 quoting, formula guard) ---------- */
  /* Formula-injection guard (OWASP CSV injection, imported from BeanAlliance v4.17.1 in 1.4.0): a text cell that
     starts with = + - @, a tab or a carriage return gets a leading apostrophe, so a spreadsheet shows it as text.
     The guard runs before quoting. Numbers the export writes itself (a JS number, or a string passed with
     {numeric: true} that really is a plain number: BPM "124.5", key shift "-1") are never guarded. */
  var CSV_GUARD = /^[=+\-@\t\r]/;
  var CSV_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)$/;
  var csv = {
    BOM: "﻿", EOL: "\r\n",
    /** True when a text cell would be guarded. */
    guarded: function (s) { return CSV_GUARD.test(String(s)); },
    /** One field: guard, then quote when it holds a comma, a quote or a line break. null/undefined/NaN → empty. */
    cell: function (value, opts) {
      if (value == null || (typeof value === "number" && !isFinite(value))) return "";
      var s = String(value), numeric = typeof value === "number" || !!(opts && opts.numeric && CSV_NUMBER.test(s));
      if (!numeric && CSV_GUARD.test(s)) s = "'" + s;
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    },
    /** One record: values (or {value, numeric} objects) joined by commas, no line end. */
    row: function (values) {
      return values.map(function (v) { return v !== null && typeof v === "object" && "value" in v ? csv.cell(v.value, v) : csv.cell(v); }).join(",");
    },
    /** A whole file: BOM, the sentence-case header row, then each row, every record ending in CRLF. */
    file: function (header, rows) {
      return csv.BOM + [csv.row(header)].concat((rows || []).map(csv.row)).join(csv.EOL) + csv.EOL;
    }
  };

  /* ---------- preferences (theme, text size, density) ---------- */
  var PREF_KEYS = { theme: "sn-theme", textSize: "sn-text-size", density: "sn-density" };
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var prefs = {
    /** theme: "dark" | "light" | "booth" | "system" (null) */
    setTheme: function (t) { var root = document.documentElement; if (!t || t === "system") { store(PREF_KEYS.theme, null); prefs.applySystem(); } else { store(PREF_KEYS.theme, t); root.setAttribute("data-theme", t); } },
    applySystem: function () { var light = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches; document.documentElement.setAttribute("data-theme", light ? "light" : "dark"); },
    setTextSize: function (s) { store(PREF_KEYS.textSize, s); if (s && s !== "m") document.documentElement.setAttribute("data-text-size", s); else document.documentElement.removeAttribute("data-text-size"); },
    /** motion: "system" | "reduce" | "full" */
    setMotion: function (m) { store("sn-motion", m === "system" ? null : m); if (m && m !== "system") document.documentElement.setAttribute("data-motion", m); else document.documentElement.removeAttribute("data-motion"); },
    setDensity: function (d) { store(PREF_KEYS.density, d); document.documentElement.setAttribute("data-density", d === "compact" ? "compact" : "comfortable"); },
    /** Call once, as early as possible (inline in <head>), to avoid a flash of the wrong theme. */
    init: function () { var t = read(PREF_KEYS.theme); if (t) document.documentElement.setAttribute("data-theme", t); else prefs.applySystem(); var s = read(PREF_KEYS.textSize); if (s) prefs.setTextSize(s); prefs.setDensity(read(PREF_KEYS.density) || "comfortable"); var mo = read("sn-motion"); if (mo) document.documentElement.setAttribute("data-motion", mo); },
    get: function () { return { theme: read(PREF_KEYS.theme) || "system", textSize: read(PREF_KEYS.textSize) || "m", density: read(PREF_KEYS.density) || "comfortable", motion: read("sn-motion") || "system" }; }
  };

  window.SongNodes = {
    version: "1.4.0", DOMAIN_MAP: DOMAIN_MAP,
    locale: LOCALE, timeZone: TZ,
    modules: MODULES, module: function (k) { for (var i = 0; i < MODULES.length; i++) if (MODULES[i].key === k) return MODULES[i]; return null; },
    icons: ICONS, icon: icon, iconNames: Object.keys(ICONS),
    camelot: camelot, keyName: keyName, compat: compat, KEY_NAMES: KEY_NAMES,
    tier: tier, TIER_LABEL: TIER_LABEL, energyStep: energyStep, bpmStep: bpmStep,
    format: format, calendar: calendar, dateRange: dateRange, csv: csv, status: status, GLYPH: GLYPH,
    html: html, prefs: prefs, esc: esc
  };
})();
