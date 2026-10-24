  /* preview helper: modal drawer (APG dialog: focus moves in, Tab trapped, Esc and scrim close, focus returns to the opener) */
  function snDrawer(drawer, openers, onNavigate) {
    var panel = drawer.querySelector(".sn-nav-drawer__panel"), scrim = drawer.querySelector(".sn-nav-drawer__scrim"), last = null;
    var outside = Array.prototype.slice.call(document.querySelectorAll("[data-drawer-inert]"));
    function focusables() { return snVisible(panel.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')); }
    function open(from) {
      last = from || openers[0];
      drawer.setAttribute("data-open", "");
      openers.forEach(function (o) { o.setAttribute("aria-expanded", "true"); });
      outside.forEach(function (el) { el.inert = true; });
      var cur = panel.querySelector('[aria-current="page"]'); (cur || focusables()[0]).focus();
    }
    function close() {
      drawer.removeAttribute("data-open");
      openers.forEach(function (o) { o.setAttribute("aria-expanded", "false"); });
      outside.forEach(function (el) { el.inert = false; });
      (last || openers[0]).focus();
    }
    openers.forEach(function (o) { o.addEventListener("click", function () { open(o); }); });
    scrim.addEventListener("click", close);
    drawer.querySelectorAll("[data-drawer-close]").forEach(function (b) { b.addEventListener("click", close); });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = focusables(), first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    });
    panel.addEventListener("click", function (e) {
      var a = e.target.closest("a.sn-nav-drawer__item"); if (!a) return;
      e.preventDefault();
      panel.querySelectorAll('[aria-current="page"]').forEach(function (x) { x.removeAttribute("aria-current"); });
      a.setAttribute("aria-current", "page");
      if (onNavigate) onNavigate(a);
      close();
    });
    return { open: open, close: close };
  }
  /** Drawer markup. current = module key or "home". counts = {key: [n, label, attention]} */
  function snDrawerHtml(id, current, counts, contained) {
    var S = window.SongNodes; counts = counts || {};
    var groups = [["Make", ["sets", "paths"]], ["Explore", ["graph", "library", "harmony"]], ["Collect", ["sources"]], ["System", ["pipeline", "services"]]];
    function row(key, label, icon, mod) {
      var c = counts[key];
      return '<li><a class="sn-nav-drawer__item' + (mod ? " sn-m-" + key : "") + '" href="#' + key + '" data-key="' + key + '"' + (current === key ? ' aria-current="page"' : "") + ">" + S.icon(icon, { size: 20 }) +
        '<span class="sn-nav-drawer__label">' + S.esc(label) + "</span>" +
        (c ? '<span class="' + (c[2] ? 'sn-pill" data-status="' + c[2] : "sn-nav-drawer__count") + '">' + c[0] + '<span class="sn-sr"> ' + S.esc(c[1]) + "</span></span>" : "") + "</a></li>";
    }
    var h = '<div class="sn-nav-drawer' + (contained ? " sn-nav-drawer--contained" : "") + '" id="' + id + '"><div class="sn-nav-drawer__scrim"></div>' +
      '<div class="sn-nav-drawer__panel" role="dialog" aria-modal="true" aria-label="Site navigation">' +
      '<div class="sn-nav-drawer__head"><span class="sn-nav-drawer__wordmark">SongNodes</span><button class="sn-btn sn-btn--quiet sn-btn--icon" type="button" data-drawer-close aria-label="Close navigation">' + S.icon("x") + "</button></div>" +
      '<nav class="sn-nav-drawer__nav" aria-label="Main"><ul class="sn-nav-drawer__list">' + row("home", "Home", "house", false) + "</ul>";
    groups.forEach(function (g, gi) {
      h += '<div class="sn-nav-drawer__group"><h2 class="sn-nav-drawer__heading" id="' + id + "-g" + gi + '">' + g[0] + '</h2><ul class="sn-nav-drawer__list" aria-labelledby="' + id + "-g" + gi + '">';
      g[1].forEach(function (k) { var m = S.module(k); h += row(k, m.label, m.icon, true); });
      h += "</ul></div>";
    });
    h += '</nav><div class="sn-nav-drawer__foot">' +
      '<a class="sn-nav-drawer__item" href="#preferences" data-key="preferences">' + S.icon("sliders-horizontal", { size: 20 }) + '<span class="sn-nav-drawer__label">Preferences</span></a>' +
      '<button class="sn-nav-drawer__item" type="button" data-drawer-close>' + S.icon("keyboard", { size: 20 }) + '<span class="sn-nav-drawer__label">Keyboard shortcuts</span><kbd>?</kbd></button>' +
      "</div></div></div>";
    return h;
  }
