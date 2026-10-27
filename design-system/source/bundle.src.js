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
  function icon(name, opts) {
    opts = opts || {};
    var inner = ICONS[name];
    if (!inner) { inner = ICONS["circle-help"]; }
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
    dateOnly: function (s) { var p = dateOnly(s); return p ? p.d + " " + MONTHS[p.m - 1] + " " + p.y : ""; }
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
    version: "1.1.2", DOMAIN_MAP: DOMAIN_MAP,
    locale: LOCALE, timeZone: TZ,
    modules: MODULES, module: function (k) { for (var i = 0; i < MODULES.length; i++) if (MODULES[i].key === k) return MODULES[i]; return null; },
    icons: ICONS, icon: icon,
    camelot: camelot, keyName: keyName, compat: compat, KEY_NAMES: KEY_NAMES,
    tier: tier, TIER_LABEL: TIER_LABEL, energyStep: energyStep, bpmStep: bpmStep,
    format: format, status: status, GLYPH: GLYPH,
    html: html, prefs: prefs, esc: esc
  };
})();
