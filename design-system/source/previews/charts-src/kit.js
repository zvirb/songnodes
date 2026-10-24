/* chart kit (inlined into each chart preview by build.py; React apps use d3-scale/recharts instead) */
var K = (function () {
  var NS = "http://www.w3.org/2000/svg", n = 0;
  function el(tag, a, parent) {
    var e = document.createElementNS(NS, tag);
    if (a) for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, a) { var t = el("text", Object.assign({ x: x, y: y }, a || {}), parent); t.textContent = s; return t; }
  function h(tag, cls, s) { var e = document.createElement(tag); if (cls) e.className = cls; if (s != null) e.textContent = s; return e; }
  function uid(p) { n += 1; return (p || "k") + n; }
  /** one linear scale per axis: domain -> range, with nice ticks */
  function linear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
    f.invert = function (px) { return d0 + (px - r0) / (r1 - r0) * (d1 - d0); };
    f.ticks = function (step) { var o = []; for (var v = Math.ceil(d0 / step) * step; v <= d1 + 1e-9; v += step) o.push(+v.toFixed(6)); return o; };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }
  /** band scale for categories: index -> left edge of the mark, with a capped mark width */
  function band(count, r0, r1, pad, cap) {
    var step = (r1 - r0) / count, bw = Math.min(step * (1 - pad), cap || Infinity);
    var f = function (i) { return r0 + i * step + (step - bw) / 2; };
    f.mid = function (i) { return r0 + i * step + step / 2; };
    f.index = function (px) { return Math.max(0, Math.min(count - 1, Math.floor((px - r0) / step))); };
    f.bw = bw; f.step = step;
    return f;
  }
  /** column with a 4px rounded data end and a square baseline */
  function barPath(x, y, w, hgt, r) {
    if (hgt <= 0) return "";
    r = Math.min(r == null ? 4 : r, w / 2, hgt);
    return "M" + x + "," + (y + hgt) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + hgt) + "Z";
  }
  /** diagonal hatch pattern for simulated / preview data (stroke = --sim via class) */
  function hatch(svg) {
    var id = uid("hatch"), defs = svg.querySelector("defs") || el("defs", null, svg);
    var p = el("pattern", { id: id, patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(45)" }, defs);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 6, "class": "sn-chart-frame__hatch" }, p);
    return "url(#" + id + ")";
  }
  function rem() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  /** one tooltip per chart; rows = [{key:"line"|"rect"|"dot"|"", c:"var(--chart-1)", value, label, dash}] */
  function tip(host) {
    var d = h("div", "sn-chart-frame__tip"); d.setAttribute("role", "presentation"); d.hidden = true; host.appendChild(d);
    return {
      show: function (x, y, title, rows) {
        d.textContent = "";
        if (title) d.appendChild(h("div", "sn-chart-frame__tip-title", title));
        (rows || []).forEach(function (r) {
          var row = h("div", "sn-chart-frame__tip-row");
          var k = h("span", "sn-chart-frame__tip-key" + (r.key ? " sn-chart-frame__tip-key--" + r.key : ""));
          if (r.c) k.style.setProperty("--c", r.c);
          if (r.dash) k.classList.add("sn-chart-frame__tip-key--dash");
          row.appendChild(k);
          row.appendChild(h("span", "sn-chart-frame__tip-value", r.value));
          row.appendChild(h("span", "sn-chart-frame__tip-label", r.label));
          d.appendChild(row);
        });
        d.hidden = false;
        var hw = host.clientWidth, tw = d.offsetWidth, th = d.offsetHeight;
        var left = x + 14; if (left + tw > hw - 4) left = Math.max(4, x - tw - 14);
        var top = Math.max(4, y - th - 10);
        d.style.left = left + "px"; d.style.top = top + "px";
      },
      hide: function () { d.hidden = true; }
    };
  }
  /** one tab stop per plot: arrows / Home / End move the active index; pointer maps x -> index */
  function nav(target, count, pxToIndex, onIndex, opts) {
    opts = opts || {}; var cur = -1;
    function set(i) { if (i == null || i < 0) { cur = -1; onIndex(-1); return; } cur = Math.max(0, Math.min(count - 1, i)); onIndex(cur); }
    target.addEventListener("keydown", function (e) {
      var k = e.key, i = cur < 0 ? (opts.start || 0) : cur;
      if (k === "ArrowRight" || k === "ArrowUp") i = cur < 0 ? i : i + 1;
      else if (k === "ArrowLeft" || k === "ArrowDown") i = cur < 0 ? i : i - 1;
      else if (k === "Home") i = 0; else if (k === "End") i = count - 1;
      else if (k === "Escape") { set(-1); return; } else return;
      e.preventDefault(); set(i);
    });
    target.addEventListener("focus", function () { if (cur < 0) set(opts.start || 0); });
    target.addEventListener("blur", function () { set(-1); });
    target.addEventListener("pointermove", function (e) { var b = target.getBoundingClientRect(); set(pxToIndex(e.clientX - b.left, e.clientY - b.top)); });
    target.addEventListener("pointerleave", function () { if (document.activeElement !== target) set(-1); });
    return { set: set, get: function () { return cur; } };
  }
  /** re-render on container resize (charts are drawn at 1 user unit = 1 CSS px) */
  function fit(host, draw) {
    var w = 0;
    function go() { var nw = host.clientWidth; if (nw && Math.abs(nw - w) > 1) { w = nw; draw(nw); } }
    if (window.ResizeObserver) new ResizeObserver(go).observe(host);
    go();
  }
  /** "View as table" toggle: swaps plot and table, keeps focus on the button */
  function tableToggle(btn, plot, table) {
    var S = window.SongNodes;
    function paint(on) { btn.innerHTML = S.icon(on ? "chart-line" : "table-2") + (on ? "View as chart" : "View as table"); }
    paint(false);
    btn.addEventListener("click", function () { var on = table.hidden; table.hidden = !on; plot.hidden = on; paint(on); });
  }
  return { el: el, text: text, h: h, uid: uid, linear: linear, band: band, barPath: barPath, hatch: hatch, rem: rem, tip: tip, nav: nav, fit: fit, tableToggle: tableToggle };
})();
