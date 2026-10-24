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
