  var S = window.SongNodes;
  /* preview helper: APG menu keyboard model (arrows wrap, Home/End, typeahead, Esc, Tab) */
  function snVisible(list) { return Array.prototype.filter.call(list, function (el) { return el.offsetParent !== null || el.getClientRects().length > 0; }); }
  function snMenuKeys(menu, close) {
    var buf = "", timer = 0;
    function items() { return snVisible(menu.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]')); }
    menu.addEventListener("keydown", function (e) {
      var it = items(), i = it.indexOf(document.activeElement), n = it.length;
      if (!n) return;
      if (e.key === "ArrowDown") { e.preventDefault(); it[(i + 1) % n].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); it[(i - 1 + n) % n].focus(); }
      else if (e.key === "Home" || e.key === "PageUp") { e.preventDefault(); it[0].focus(); }
      else if (e.key === "End" || e.key === "PageDown") { e.preventDefault(); it[n - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === "Tab") { close(false); }
      else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        clearTimeout(timer); buf += e.key.toLowerCase(); timer = setTimeout(function () { buf = ""; }, 600);
        for (var k = 1; k <= n; k++) { var c = it[(i + k) % n], t = (c.querySelector(".sn-overflow-menu__text") || c).textContent.trim().toLowerCase(); if (t.indexOf(buf) === 0) { c.focus(); break; } }
      }
    });
    return items;
  }
  /** Wire a menu button: btn[aria-haspopup=menu][aria-expanded][aria-controls] + .sn-overflow-menu__menu[role=menu]. */
  function snMenu(btn, menu, onSelect) {
    function open(last) { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); var it = items(); var t = last ? it[it.length - 1] : it[0]; if (t) t.focus(); }
    function close(back) { if (menu.hidden) return; menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (back) btn.focus(); }
    var items = snMenuKeys(menu, close);
    btn.addEventListener("click", function () { if (menu.hidden) open(false); else close(true); });
    btn.addEventListener("keydown", function (e) { if (e.key === "ArrowDown") { e.preventDefault(); open(false); } else if (e.key === "ArrowUp") { e.preventDefault(); open(true); } });
    menu.addEventListener("click", function (e) {
      var it = e.target.closest('[role^="menuitem"]'); if (!it) return;
      if (it.getAttribute("aria-disabled") === "true") { return; }
      if (it.hasAttribute("aria-checked")) it.setAttribute("aria-checked", it.getAttribute("aria-checked") === "true" ? "false" : "true");
      close(true); if (onSelect) onSelect(it);
    });
    document.addEventListener("pointerdown", function (e) { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) close(false); });
    return { open: open, close: close };
  }
  function snSay(msg) { var l = document.getElementById("sn-live"); if (l) { l.textContent = ""; setTimeout(function () { l.textContent = msg; }, 30); } }
  /** Menu markup. items: {h:"Heading"} | {sep:1} | {id,icon,label,kbd,reason,danger,checked,cls}. Groups follow each heading. */
  function snMenuHtml(id, labelledby, items, cls, title) {
    var S = window.SongNodes, h = '<div class="sn-overflow-menu__menu' + (cls ? " " + cls : "") + '" role="menu" id="' + id + '" ' + (labelledby ? 'aria-labelledby="' + labelledby + '"' : 'aria-label="' + S.esc(title ? "Actions for " + title[0] : "Actions") + '"') + ' hidden>', open = false, n = 0;
    if (title) h += '<div class="sn-overflow-menu__title" role="presentation">' + S.esc(title[0]) + (title[1] ? "<small>" + S.esc(title[1]) + "</small>" : "") + "</div>";
    items.forEach(function (it) {
      if (it.h) { if (open) h += "</div>"; n++; h += '<div role="group" aria-labelledby="' + id + "-h" + n + '"><div class="sn-overflow-menu__heading" id="' + id + "-h" + n + '" role="presentation">' + S.esc(it.h) + "</div>"; open = true; return; }
      if (it.sep) { if (open) { h += "</div>"; open = false; } h += '<div class="sn-overflow-menu__sep" role="separator"></div>'; return; }
      var rid = it.reason ? id + "-r" + (++n) : "";
      h += '<button type="button" tabindex="-1" class="sn-overflow-menu__item' + (it.danger ? " sn-overflow-menu__item--danger" : "") + (it.cls ? " " + it.cls : "") + '" role="' + (it.checked != null ? "menuitemcheckbox" : "menuitem") + '"' +
        (it.checked != null ? ' aria-checked="' + it.checked + '"' : "") + (it.id ? ' data-id="' + it.id + '"' : "") + (it.reason ? ' aria-disabled="true" aria-describedby="' + rid + '"' : "") + ">" +
        S.icon(it.checked != null ? "check" : (it.icon || "circle-dot"), { size: 16 }) + '<span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">' + S.esc(it.label) + "</span>" +
        (it.reason ? '<span class="sn-overflow-menu__reason" id="' + rid + '">' + S.esc(it.reason) + "</span>" : "") + "</span>" + (it.kbd ? "<kbd>" + S.esc(it.kbd) + "</kbd>" : "") + "</button>";
    });
    if (open) h += "</div>";
    return h + "</div>";
  }
  function snMenuButton(id, label, items, opts) {
    var S = window.SongNodes; opts = opts || {};
    return '<div class="sn-overflow-menu"><button class="sn-btn sn-btn--icon' + (opts.quiet === false ? "" : " sn-btn--quiet") + (opts.sm ? " sn-btn--sm" : "") + '" type="button" id="' + id + '-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="' + id + '" aria-label="' + S.esc(label) + '">' + S.icon(opts.icon || "ellipsis") + "</button>" + snMenuHtml(id, id + "-btn", items, opts.cls) + "</div>";
  }

  /* preview helper: radiogroup with roving tabindex (APG radio group: arrows move and check, wrap, skip disabled) */
  function snSeg(group, onChange) {
    function radios() { return Array.prototype.slice.call(group.querySelectorAll('[role="radio"]')); }
    function pick(r, focus) {
      if (!r || r.getAttribute("aria-disabled") === "true") return;
      radios().forEach(function (x) { var on = x === r; x.setAttribute("aria-checked", on ? "true" : "false"); x.tabIndex = on ? 0 : -1; });
      if (focus) r.focus();
      if (onChange) onChange(r.getAttribute("data-value"), r);
    }
    radios().forEach(function (x) { x.tabIndex = x.getAttribute("aria-checked") === "true" ? 0 : -1; });
    group.addEventListener("click", function (e) { var r = e.target.closest('[role="radio"]'); if (r) pick(r, true); });
    group.addEventListener("keydown", function (e) {
      var rs = radios().filter(function (x) { return x.getAttribute("aria-disabled") !== "true"; }), i = rs.indexOf(document.activeElement);
      if (i < 0) return;
      var d = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? -1 : 0;
      if (d) { e.preventDefault(); pick(rs[(i + d + rs.length) % rs.length], true); }
      else if (e.key === "Home") { e.preventDefault(); pick(rs[0], true); }
      else if (e.key === "End") { e.preventDefault(); pick(rs[rs.length - 1], true); }
      else if (e.key === " ") { e.preventDefault(); pick(document.activeElement, true); }
    });
    return { set: function (v) { pick(group.querySelector('[data-value="' + v + '"]'), false); } };
  }
  /** Build the markup for a segmented control. opts: [{value,label,icon,disabled,reason}] */
  function snSegHtml(label, opts, value, cls) {
    var S = window.SongNodes;
    return '<div class="sn-seg sn-segmented-control' + (cls ? " " + cls : "") + '" role="radiogroup" aria-label="' + S.esc(label) + '">' + opts.map(function (o) {
      return '<button type="button" role="radio" data-value="' + o.value + '" aria-checked="' + (o.value === value) + '"' + (o.disabled ? ' aria-disabled="true" title="' + S.esc(o.reason || "") + '"' : "") + (o.aria ? ' aria-label="' + S.esc(o.aria) + '"' : "") + ">" + (o.icon ? S.icon(o.icon, { size: 16 }) : "") + (o.label ? S.esc(o.label) : "") + "</button>";
    }).join("") + "</div>";
  }

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

