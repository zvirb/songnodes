/* svg kit (subset of the chart kit used by Heatmap and Sparkline previews) */
var K = (function () {
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, a, parent) { var e = document.createElementNS(NS, tag); if (a) for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; }
  function text(parent, x, y, s, a) { var t = el("text", Object.assign({ x: x, y: y }, a || {}), parent); t.textContent = s; return t; }
  function rem() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  return { el: el, text: text, rem: rem };
})();
