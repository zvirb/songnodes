  /* page shell helpers (Pages A): AppHeader, PageHeader, drawer wiring, toast */
  var NOW = new Date("2026-10-24T21:30:00+11:00");
  var KB = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
  /** AppHeader markup. o: {lead, title, stamp, conn:[state,text,sub], mode, menu} */
  function snHeader(o) {
    var st = o.stamp ? new Date(o.stamp) : null;
    var menu = (o.menu || []).concat([{ sep: 1 }, { id: "prefs", icon: "sliders-horizontal", label: "Preferences" }, { id: "keys", icon: "keyboard", label: "Keyboard shortcuts", kbd: "?" }]);
    if (!o.menu || !o.menu.length) menu = menu.slice(1);
    return '<header class="sn-app-header"><div class="sn-app-header__bar">' +
      '<div class="sn-app-header__start"><button class="sn-btn sn-btn--quiet sn-btn--icon" type="button" data-opener aria-expanded="false" aria-controls="nav" aria-label="Open navigation">' + S.icon("menu") + "</button>" +
      '<span class="sn-app-header__wordmark">SongNodes</span></div>' +
      '<span class="sn-app-header__divider" aria-hidden="true"></span>' +
      '<p class="sn-app-header__title"><span class="sn-lead">' + S.esc(o.lead) + ":</span> " + S.esc(o.title) + "</p>" +
      (o.mode ? '<div class="sn-app-header__mode">' + snSegHtml("Mode", [{ value: "play", label: "Play" }, { value: "plan", label: "Plan" }], o.mode, "sn-segmented-control--sm") + "</div>" : "") +
      '<div class="sn-app-header__end">' +
      (st ? '<span class="sn-app-header__stamp">' + S.icon("clock", { size: 14 }) + '<span class="sn-app-header__stamp-text">Data from </span><time datetime="' + st.toISOString() + '" title="Data from ' + S.format.stamp(st) + '">' + S.format.relative(st, NOW) + "</time></span>" : "") +
      (o.conn ? '<span class="sn-connection-status" data-state="' + o.conn[0] + '" role="status" title="' + S.esc(o.conn[2] || "") + '">' + S.esc(o.conn[1]) + "</span>" : "") +
      '<button class="sn-btn sn-btn--sm sn-app-header__search" type="button" aria-keyshortcuts="Control+K Meta+K /" data-search>' + S.icon("search", { size: 16 }) + '<span class="sn-app-header__search-label">Search</span><kbd aria-hidden="true">' + KB + "</kbd></button>" +
      snMenuButton("hmore", "More actions", menu) + "</div></div></header>";
  }
  /** PageHeader markup. o: {mod, lead, here, title, size, desc, stampVerb, stamp, pill, secondary:[[id,icon,label]], menu, primary:[icon,label]} */
  function snPageHeader(o) {
    var m = o.mod ? S.module(o.mod) : null, st = o.stamp ? new Date(o.stamp) : null;
    var menu = (o.secondary || []).map(function (b) { return { id: b[0], icon: b[1], label: b[2], cls: "sn-page-header__narrow-only" }; }).concat(o.menu || []);
    return '<header class="sn-page-header' + (m ? " sn-m-" + o.mod : "") + '">' +
      (m ? '<div class="sn-page-header__band">' + S.icon(m.icon, { size: 16 }) + '<a class="sn-link" href="#' + o.mod + '">' + S.esc(m.label) + "</a>" +
        (o.here ? '<span class="sn-page-header__band-sep" aria-hidden="true">›</span><span class="sn-page-header__band-here">' + S.esc(o.here) + "</span>" : "") + "</div>" : "") +
      '<div class="sn-page-header__main"><div class="sn-page-header__text">' + S.html.title(o.lead || (m && m.label), o.title, o.size || "title-l") +
      (o.desc ? '<p class="sn-page-header__desc">' + o.desc + "</p>" : "") +
      (st || o.pill || o.meta ? '<p class="sn-page-header__meta">' + (st ? '<span class="sn-page-header__stamp">' + S.icon("clock", { size: 14 }) + S.esc(o.stampVerb) + ' <time datetime="' + st.toISOString() + '">' + S.format.stamp(st) + "</time></span>" : "") + (o.pill || "") + (o.meta || "") + "</p>" : "") + "</div>" +
      (o.primary || menu.length ? '<div class="sn-page-header__actions">' +
        (o.secondary || []).map(function (b) { return '<button class="sn-btn sn-page-header__secondary" type="button" data-act="' + b[0] + '">' + S.icon(b[1]) + S.esc(b[2]) + "</button>"; }).join("") +
        (menu.length ? snMenuButton("pmore", "More actions", menu, { quiet: false }) : "") +
        (o.primary ? '<button class="sn-btn sn-btn--primary" type="button" data-act="primary">' + S.icon(o.primary[0]) + S.esc(o.primary[1]) + "</button>" : "") + "</div>" : "") +
      "</div></header>";
  }
  function snToast(text, icon, action) {
    var r = document.getElementById("toasts"); if (!r) return;
    r.innerHTML = '<div class="sn-toast"><span class="sn-toast__icon">' + S.icon(icon || "circle-check") + '</span><span class="sn-toast__text">' + text + "</span>" +
      (action ? '<button class="sn-btn sn-btn--sm sn-toast__action" type="button">' + S.esc(action) + "</button>" : "") +
      '<button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-toast__close" type="button" aria-label="Dismiss notification" data-toast-close>' + S.icon("x") + "</button></div>";
    clearTimeout(snToast.t); snToast.t = setTimeout(function () { r.innerHTML = ""; }, 8000);
  }
  /** Mount header + drawer and wire every menu, segmented control, the drawer and the search shortcut. */
  function snShell(o) {
    document.getElementById("hdr").innerHTML = snHeader(o);
    document.getElementById("drw").innerHTML = snDrawerHtml("nav", o.current, o.counts || { sources: ["4", "imports to review"], pipeline: ["2", "scrapers paused after errors", "warn"] });
  }
  function snWire(onMenu) {
    document.querySelectorAll('.sn-overflow-menu > button[aria-haspopup="menu"]').forEach(function (b) {
      snMenu(b, document.getElementById(b.getAttribute("aria-controls")), function (it) { if (onMenu) onMenu(it.getAttribute("data-id"), it); else snSay(it.textContent.trim() + " chosen"); });
    });
    document.querySelectorAll('.sn-segmented-control[role="radiogroup"]').forEach(function (g) { if (!g._wired) { g._wired = 1; snSeg(g, function (v, r) { snSay(r.textContent.trim() + " selected"); }); } });
    var openers = Array.prototype.slice.call(document.querySelectorAll("[data-opener]"));
    snDrawer(document.getElementById("nav"), openers, function (a) { snSay("Opened " + a.textContent.trim()); });
    document.addEventListener("keydown", function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) || (e.key === "/" && !typing)) { e.preventDefault(); var s = document.querySelector("[data-search]"); if (s) s.focus(); snSay("Quick search opens here"); }
    });
    document.addEventListener("click", function (e) { if (e.target.closest("[data-toast-close]")) document.getElementById("toasts").innerHTML = ""; });
  }
