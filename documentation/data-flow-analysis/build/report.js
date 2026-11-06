/* Data-flow report behaviour. Classic script, no network, runs after the design-system bundle (window.SongNodes).
   Sorting (APG sortable table), filter chips, search, tabs (APG tabs), drawer, segmented controls, figure zoom/pan,
   enlarge (MediaViewer), node neighbour highlight, node click filters its table, Built/Projected toggle, TOC current section. */
(function () {
  "use strict";
  var S = window.SongNodes;
  var live = document.getElementById("sn-live");
  function say(msg) { if (!live) return; live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 30); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- tables: sort, filter, search ---------- */
  function cellValue(tr, col, idx) {
    var sv = tr.getAttribute("data-sort-values");
    if (sv) { try { var o = JSON.parse(sv); if (o[col] !== undefined) return o[col]; } catch (e) { /* fall through */ } }
    var td = tr.children[idx]; var t = td ? td.textContent.trim() : "";
    var n = parseFloat(t.replace(/[,\s]/g, "")); return isNaN(n) || !/^[−\-]?[\d,.\s]+$/.test(t) ? t.toLowerCase() : n;
  }
  $all(".sn-data-table").forEach(function (dt) {
    var table = dt.querySelector("table"); if (!table) return;
    var tbody = table.tBodies[0];
    $all("th[data-sortable] button", table).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var th = btn.closest("th"), ths = $all("th", th.parentNode), idx = ths.indexOf(th);
        var dir = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
        ths.forEach(function (x) { x.removeAttribute("aria-sort"); }); th.setAttribute("aria-sort", dir);
        var rows = $all("tr", tbody), col = btn.getAttribute("data-sort");
        rows.sort(function (a, b) {
          var x = cellValue(a, col, idx), y = cellValue(b, col, idx);
          var r = (typeof x === "number" && typeof y === "number") ? x - y : String(x).localeCompare(String(y), "en-AU");
          if (r === 0) r = a.getAttribute("data-id").localeCompare(b.getAttribute("data-id"));
          return dir === "ascending" ? r : -r;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
        say("Sorted by " + btn.textContent + ", " + dir);
      });
    });
  });
  var tableState = {};
  function applyFilters(tid) {
    var dt = document.getElementById(tid); if (!dt) return;
    var st = tableState[tid] || { q: "", f: {}, node: null };
    var rows = $all("tbody tr", dt), shown = 0;
    rows.forEach(function (tr) {
      var ok = true;
      if (st.q) ok = tr.textContent.toLowerCase().indexOf(st.q) >= 0;
      Object.keys(st.f).forEach(function (k) { var vals = st.f[k]; if (ok && vals.length) ok = vals.indexOf(tr.getAttribute("data-f-" + k)) >= 0; });
      if (ok && st.node) ok = (" " + (tr.getAttribute("data-f-node") || tr.getAttribute("data-id")) + " ").indexOf(" " + st.node + " ") >= 0;
      tr.hidden = !ok; if (ok) shown++;
    });
    var c = dt.querySelector("[data-count]"); if (c) c.textContent = shown + " of " + rows.length + " rows" + (st.node ? " · linked to " + st.node : "");
    var qc = dt.querySelector(".sn-search-field__count"); if (qc) qc.innerHTML = "<b>" + shown + "</b> of " + rows.length;
  }
  $all(".sn-search-field[data-table]").forEach(function (form) {
    var tid = form.getAttribute("data-table"), input = form.querySelector("input"), clear = form.querySelector(".sn-search-field__clear");
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    input.addEventListener("input", function () { (tableState[tid] = tableState[tid] || { q: "", f: {}, node: null }).q = input.value.trim().toLowerCase(); form.toggleAttribute("data-empty", !input.value); applyFilters(tid); });
    clear.addEventListener("click", function () { input.value = ""; input.dispatchEvent(new Event("input")); input.focus(); });
  });
  $all(".sn-filter-chip-group[data-table]").forEach(function (g) {
    var tid = g.getAttribute("data-table"), key = g.getAttribute("data-filter"), clear = g.querySelector(".sn-filter-chip-group__clear");
    function sync() {
      var vals = $all('.sn-filter-chip[aria-pressed="true"]', g).map(function (b) { return b.getAttribute("data-value"); });
      (tableState[tid] = tableState[tid] || { q: "", f: {}, node: null }).f[key] = vals;
      clear.hidden = !vals.length; clear.textContent = "Clear (" + vals.length + ")"; applyFilters(tid);
    }
    $all(".sn-filter-chip", g).forEach(function (b) { b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); sync(); }); });
    clear.addEventListener("click", function () { $all(".sn-filter-chip", g).forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); sync(); });
  });

  /* ---------- tabs (APG: automatic activation) ---------- */
  $all('.sn-tabs[role="tablist"]').forEach(function (list) {
    var tabs = $all('[role="tab"]', list);
    function pick(t, focus) {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1; var p = document.getElementById(x.getAttribute("aria-controls")); if (p) p.hidden = !on; });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t, false); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length], true); }
        else if (e.key === "Home") { e.preventDefault(); pick(tabs[0], true); }
        else if (e.key === "End") { e.preventDefault(); pick(tabs[tabs.length - 1], true); }
      });
    });
  });

  /* ---------- segmented controls (APG radio group) + Built/Projected toggle ---------- */
  $all('.sn-segmented-control[role="radiogroup"]').forEach(function (g) {
    var rs = $all('[role="radio"]', g);
    function pick(r, focus) {
      rs.forEach(function (x) { var on = x === r; x.setAttribute("aria-checked", on ? "true" : "false"); x.tabIndex = on ? 0 : -1; });
      if (focus) r.focus();
      if (g.hasAttribute("data-state-toggle")) {
        var fig = g.closest(".sn-figure"), v = r.getAttribute("data-value");
        $all("[data-state-view]", fig).forEach(function (el) { el.hidden = el.getAttribute("data-state-view") !== v; });
        say(fig.getAttribute("data-figure") + " shows " + r.textContent);
      }
      if (g.hasAttribute("data-theme-choice")) { S.prefs.setTheme(r.getAttribute("data-value")); say("Theme: " + r.textContent); }
    }
    rs.forEach(function (r, i) {
      r.addEventListener("click", function () { pick(r, true); });
      r.addEventListener("keydown", function (e) {
        var d = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? -1 : 0;
        if (d) { e.preventDefault(); pick(rs[(i + d + rs.length) % rs.length], true); }
      });
    });
    if (g.hasAttribute("data-theme-choice")) { var cur = S.prefs.get().theme; rs.forEach(function (r) { var on = r.getAttribute("data-value") === cur; r.setAttribute("aria-checked", on ? "true" : "false"); r.tabIndex = on ? 0 : -1; }); }
  });

  /* ---------- navigation drawer (focus trap, Esc, scrim) ---------- */
  var drawer = document.getElementById("nav"), opener = document.querySelector("[data-opener]");
  if (drawer && opener) {
    var panel = drawer.querySelector(".sn-nav-drawer__panel"), outside = $all("[data-drawer-inert]");
    function focusables() { return $all('a[href], button:not([disabled])', panel); }
    function openD() { drawer.setAttribute("data-open", ""); opener.setAttribute("aria-expanded", "true"); outside.forEach(function (el) { el.inert = true; }); focusables()[0].focus(); }
    function closeD() { drawer.removeAttribute("data-open"); opener.setAttribute("aria-expanded", "false"); outside.forEach(function (el) { el.inert = false; }); opener.focus(); }
    opener.addEventListener("click", openD);
    drawer.querySelector(".sn-nav-drawer__scrim").addEventListener("click", closeD);
    $all("[data-drawer-close]", drawer).forEach(function (b) { b.addEventListener("click", closeD); });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closeD(); return; }
      if (e.key !== "Tab") return;
      var f = focusables(), first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- figures: zoom, pan, enlarge, neighbours, node filter ---------- */
  function setZoom(canvas, z, x, y) {
    var svg = canvas.querySelector("svg:not([hidden])") || canvas.querySelector("svg");
    canvas._z = Math.max(1, Math.min(4, z)); canvas._x = x || 0; canvas._y = y || 0;
    if (canvas._z === 1) { canvas._x = 0; canvas._y = 0; canvas.removeAttribute("data-zoomed"); } else canvas.setAttribute("data-zoomed", "");
    $all("svg", canvas).forEach(function (s) { s.style.transform = "translate(" + canvas._x + "px," + canvas._y + "px) scale(" + canvas._z + ")"; });
  }
  $all(".sn-figure").forEach(function (fig) {
    var canvas = fig.querySelector(".sn-figure__canvas"); if (!canvas) return;
    canvas._z = 1; canvas._x = 0; canvas._y = 0;
    $all("[data-zoom]", fig).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-zoom");
        setZoom(canvas, k === "in" ? canvas._z * 1.25 : k === "out" ? canvas._z / 1.25 : 1, k === "fit" ? 0 : canvas._x, k === "fit" ? 0 : canvas._y);
        say(fig.getAttribute("data-figure") + " zoom " + Math.round(canvas._z * 100) + "%");
      });
    });
    canvas.addEventListener("keydown", function (e) {
      var step = 40;
      if (e.key === "+" || e.key === "=") setZoom(canvas, canvas._z * 1.25, canvas._x, canvas._y);
      else if (e.key === "-") setZoom(canvas, canvas._z / 1.25, canvas._x, canvas._y);
      else if (e.key === "0") setZoom(canvas, 1);
      else if (e.key === "ArrowLeft") setZoom(canvas, canvas._z, canvas._x + step, canvas._y);
      else if (e.key === "ArrowRight") setZoom(canvas, canvas._z, canvas._x - step, canvas._y);
      else if (e.key === "ArrowUp") setZoom(canvas, canvas._z, canvas._x, canvas._y + step);
      else if (e.key === "ArrowDown") setZoom(canvas, canvas._z, canvas._x, canvas._y - step);
      else return;
      e.preventDefault();
    });
    var drag = null;
    canvas.addEventListener("pointerdown", function (e) { if (canvas._z <= 1 || e.target.closest("[data-node]")) return; drag = [e.clientX - canvas._x, e.clientY - canvas._y]; canvas.setAttribute("data-dragging", ""); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) { if (drag) setZoom(canvas, canvas._z, e.clientX - drag[0], e.clientY - drag[1]); });
    canvas.addEventListener("pointerup", function () { drag = null; canvas.removeAttribute("data-dragging"); });
    canvas.addEventListener("wheel", function (e) { if (!e.ctrlKey) return; e.preventDefault(); setZoom(canvas, canvas._z * (e.deltaY < 0 ? 1.1 : 0.9), canvas._x, canvas._y); }, { passive: false });

    /* neighbour highlight: nodes carry data-node; edges data-from/data-to */
    function light(id, on) {
      var svg = canvas; var nb = {};
      $all("[data-from],[data-to]", svg).forEach(function (ed) {
        var hit = ed.getAttribute("data-from") === id || ed.getAttribute("data-to") === id;
        if (hit) { nb[ed.getAttribute("data-from")] = 1; nb[ed.getAttribute("data-to")] = 1; }
        if (on) ed.setAttribute(hit ? "data-hl" : "data-dim", ""); else { ed.removeAttribute("data-hl"); ed.removeAttribute("data-dim"); }
      });
      $all("[data-node]", svg).forEach(function (n) {
        var k = n.getAttribute("data-node");
        if (on) n.setAttribute(k === id || nb[k] ? "data-hl" : "data-dim", ""); else { n.removeAttribute("data-hl"); n.removeAttribute("data-dim"); }
      });
    }
    $all("[data-node]", canvas).forEach(function (n) {
      n.setAttribute("tabindex", "0"); n.setAttribute("role", "button");
      var id = n.getAttribute("data-node");
      n.addEventListener("pointerenter", function () { light(id, true); });
      n.addEventListener("pointerleave", function () { light(id, false); });
      n.addEventListener("focus", function () { light(id, true); });
      n.addEventListener("blur", function () { light(id, false); });
      function act() {
        var tid = fig.getAttribute("data-filter-table"); if (!tid) return;
        var st = (tableState[tid] = tableState[tid] || { q: "", f: {}, node: null });
        st.node = st.node === id ? null : id; applyFilters(tid);
        var dt = document.getElementById(tid);
        say(st.node ? "Table filtered to rows linked to " + id : "Table filter cleared");
        if (st.node && dt) dt.scrollIntoView({ block: "nearest" });
      }
      n.addEventListener("click", act);
      n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
    });

    var enl = fig.querySelector("[data-enlarge]");
    if (enl) enl.addEventListener("click", function () { openViewer(fig, enl); });
  });

  /* ---------- MediaViewer (full-screen, zoom, Esc returns focus) ---------- */
  var mv = document.getElementById("mv");
  function openViewer(fig, from) {
    if (!mv) return;
    var stage = mv.querySelector(".sn-media-viewer__stage"), svg = (fig.querySelector(".sn-figure__canvas [data-state-view]:not([hidden]) svg") || fig.querySelector(".sn-figure__canvas svg")).cloneNode(true);
    svg.style.transform = ""; svg.classList.add("sn-media-viewer__media");
    stage.innerHTML = ""; stage.appendChild(svg);
    mv.querySelector(".sn-media-viewer__name").textContent = fig.querySelector("h3").textContent;
    mv.querySelector(".sn-media-viewer__title").textContent = fig.querySelector("h3").textContent;
    mv.querySelector(".sn-media-viewer__alt").textContent = fig.querySelector(".sn-figure__caption").textContent;
    mv.hidden = false; mv._from = from; mv._z = 1; mv.querySelector(".sn-media-viewer__zoom").textContent = "100%"; mv.focus();
    $all("[data-drawer-inert]").forEach(function (el) { el.inert = true; });
  }
  function closeViewer() { mv.hidden = true; $all("[data-drawer-inert]").forEach(function (el) { el.inert = false; }); if (mv._from) mv._from.focus(); }
  if (mv) {
    mv.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeViewer(); } });
    mv.querySelector("[data-mv-close]").addEventListener("click", closeViewer);
    $all("[data-mv-zoom]", mv).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-mv-zoom"); mv._z = k === "fit" ? 1 : Math.max(1, Math.min(4, mv._z * (k === "in" ? 1.25 : 0.8)));
        var s = mv.querySelector(".sn-media-viewer__stage svg"); if (s) s.style.transform = "scale(" + mv._z + ")";
        mv.querySelector(".sn-media-viewer__zoom").textContent = Math.round(mv._z * 100) + "%";
      });
    });
  }

  /* ---------- TOC: mark the section in view ---------- */
  var tocLinks = $all(".sn-report-toc a[href^='#']");
  if ("IntersectionObserver" in window && tocLinks.length) {
    var map = {}; tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && map[en.target.id]) { tocLinks.forEach(function (a) { a.removeAttribute("aria-current"); }); map[en.target.id].setAttribute("aria-current", "true"); } });
    }, { rootMargin: "0px 0px -70% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- quick search shortcut moves to the page catalogue search ---------- */
  document.addEventListener("keydown", function (e) {
    var typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    if (((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { var q = document.getElementById("t-pages-q"); if (q) { e.preventDefault(); q.focus(); } }
  });
})();
