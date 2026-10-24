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
