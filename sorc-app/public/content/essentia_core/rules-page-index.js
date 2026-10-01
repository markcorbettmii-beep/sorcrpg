(function () {
  "use strict";

  var LIMIT = 12000;
  var BUDGET = 11500;
  var CARD_LIMIT = 10;
  var main = document.querySelector("main");
  if (!main) return;

  var file = location.pathname.split("/").pop();
  var indexTitles = {
    "rules_character-creation.html": "Character Creation",
    "rules_character-progression.html": "Character Progression",
    "rules_combat-movement.html": "Combat & Movement",
    "rules_equipment.html": "Armaments & Equipment",
    "rules_playable-classes.html": "Playable Classes",
    "rules_playable-races.html": "Playable Races",
    "rules_sorc-cards.html": "SORC Cards",
    "rules_companions.html": "Companions",
  };
  var indexTitle = indexTitles[file.toLowerCase()] || "Rules";
  var classPage = /rules_playable-classes\.html$/i.test(file);
  var racePage = /rules_playable-races\.html$/i.test(file);
  var paginated = /rules_(character-creation|character-progression|combat-movement|equipment|playable-classes|playable-races|sorc-cards|companions)\.html$/i.test(file);
  var views = [], cards = [], pageOf = new Map(), current = 1, total = 1;
  var rosterListNode = null, rosterListPages = [], rosterKind = "";
  var activeIndexFrame = null, activeIndexDetails = null, activeIndexCloseButton = null, activeIndexClosePin = null;
  var closePositionPending = false, closeReanchorPending = false;
  var closeResizeObserver = window.ResizeObserver
    ? new window.ResizeObserver(function () { scheduleActiveIndexClosePosition(true); })
    : null;

  function updateActiveIndexClosePosition(reanchor) {
    var frame = activeIndexFrame;
    var details = activeIndexDetails;
    var button = activeIndexCloseButton;
    if (!frame || !details || !button || !details.open || button.hidden) {
      if (button) button.classList.remove("is-pinned");
      if (!details || !details.open || !button) activeIndexClosePin = null;
      return;
    }

    var frameRect = frame.getBoundingClientRect();
    var viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    var viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    if (
      frameRect.width <= 0 ||
      frameRect.height <= 0 ||
      frameRect.right <= 0 ||
      frameRect.left >= viewportWidth ||
      frameRect.bottom <= 0 ||
      frameRect.top >= viewportHeight
    ) {
      button.classList.remove("is-pinned");
      return;
    }

    button.style.maxWidth = Math.max(0, Math.min(frameRect.width - 8, viewportWidth - 8)) + "px";
    var buttonRect = button.getBoundingClientRect();
    if (reanchor || !activeIndexClosePin) {
      var top = Math.max(4, frameRect.top + 4);
      var right = Math.min(frameRect.right - 4, viewportWidth - 4);
      var left = Math.max(frameRect.left + 4, right - buttonRect.width);
      activeIndexClosePin = { top: top, left: left };
      button.style.top = top + "px";
      button.style.left = left + "px";
    }

    buttonRect = button.getBoundingClientRect();
    var insideFrame =
      buttonRect.left >= frameRect.left + 2 &&
      buttonRect.right <= frameRect.right - 2 &&
      buttonRect.top >= frameRect.top + 2 &&
      buttonRect.bottom <= frameRect.bottom - 2;
    var insideViewport =
      buttonRect.left >= 0 &&
      buttonRect.right <= viewportWidth &&
      buttonRect.top >= 0 &&
      buttonRect.bottom <= viewportHeight;
    button.classList.toggle("is-pinned", insideFrame && insideViewport);
  }

  function scheduleActiveIndexClosePosition(reanchor) {
    if (reanchor) closeReanchorPending = true;
    if (closePositionPending) return;
    closePositionPending = true;
    window.requestAnimationFrame(function () {
      closePositionPending = false;
      var shouldReanchor = closeReanchorPending;
      closeReanchorPending = false;
      updateActiveIndexClosePosition(shouldReanchor);
    });
  }

  window.addEventListener("scroll", function () {
    scheduleActiveIndexClosePosition(false);
  }, { passive: true });
  document.addEventListener("scroll", function () {
    scheduleActiveIndexClosePosition(false);
  }, { capture: true, passive: true });
  window.addEventListener("resize", function () {
    scheduleActiveIndexClosePosition(true);
  }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", function () {
      scheduleActiveIndexClosePosition(false);
    }, { passive: true });
    window.visualViewport.addEventListener("resize", function () {
      scheduleActiveIndexClosePosition(true);
    }, { passive: true });
  }

  function text(node) {
    if (!node) return 0;
    var clone = node.nodeType === 1 ? node.cloneNode(true) : node;
    if (clone.querySelectorAll) clone.querySelectorAll("script,style,nav,.rules-page-index,.rules-page-controls").forEach(function (x) { x.remove(); });
    return String(clone.innerText || clone.textContent || "").replace(/\s+/g, " ").trim().length;
  }
  function level(node) { return node.nodeType === 1 && /^H[2-6]$/.test(node.tagName) ? +node.tagName.slice(1) : 0; }
  function splitAt(nodes, wanted) {
    var groups = [], group = [];
    nodes.forEach(function (n) {
      if (level(n) === wanted && group.length) { groups.push(group); group = []; }
      group.push(n);
    });
    if (group.length) groups.push(group);
    return groups.length > 1 ? groups : [nodes];
  }
  function splitOversized(nodes, previous) {
    var size = nodes.reduce(function (s, n) { return s + text(n); }, 0);
    if (size <= BUDGET) return [nodes];
    for (var wanted = previous + 1; wanted <= 6; wanted += 1) {
      var groups = splitAt(nodes, wanted);
      if (groups.length > 1) {
        return groups.reduce(function (all, group) {
          return all.concat(splitOversized(group, wanted));
        }, []);
      }
    }
    return [nodes];
  }
  function units(section) {
    var nodes = Array.from(section.childNodes), first = 7;
    nodes.forEach(function (n) { var l = level(n); if (l) first = Math.min(first, l); });
    if (nodes.reduce(function (s, n) { return s + text(n); }, 0) <= BUDGET || first > 6) {
      return [{ section: section, nodes: nodes, chars: nodes.reduce(function (s, n) { return s + text(n); }, 0) }];
    }
    var result = [];
    splitAt(nodes, first).forEach(function (group) {
      splitOversized(group, first).forEach(function (ns) {
        result.push({ section: section, nodes: ns, chars: ns.reduce(function (s, n) { return s + text(n); }, 0) });
      });
    });
    return result;
  }
  function pack(items, budget) {
    var out = [], group = [], size = 0;
    items.forEach(function (item) {
      if (group.length && size + item.chars > budget) { out.push(group); group = []; size = 0; }
      group.push(item); size += item.chars;
    });
    if (group.length) out.push(group);
    return out;
  }
  function view(group, number) {
    var v = document.createElement("div");
    v.className = "rules-page-content";
    v.dataset.rulesPage = number;
    var source, wrapper;
    group.forEach(function (u) {
      if (u.section) {
        if (source !== u.section) { wrapper = u.section.cloneNode(false); wrapper.removeAttribute("id"); v.appendChild(wrapper); source = u.section; }
        u.nodes.forEach(function (n) { wrapper.appendChild(n); });
      } else v.appendChild(u.node);
    });
    return v;
  }
  function cardGroups(list) {
    var out = [], group = [], size = 0;
    list.forEach(function (card) {
      var n = text(card);
      if (group.length && (group.length >= CARD_LIMIT || size + n > BUDGET)) { out.push(group); group = []; size = 0; }
      group.push(card); size += n;
    });
    if (group.length) out.push(group);
    return out;
  }
  function generic() {
    var root = main.querySelector(".rules-content") || main;
    if (text(root) <= LIMIT) return;
    var nodes = Array.from(root.childNodes), sections = nodes.filter(function (x) { return x.nodeType === 1 && x.classList.contains("rules-section"); });
    if (!sections.length) return;
    var all = [];
    nodes.forEach(function (node) {
      if (node.nodeType === 1 && node.classList.contains("rules-section")) units(node).forEach(function (u) { if (u.chars) all.push(u); });
      else if (text(node)) all.push({ node: node, chars: text(node) });
    });
    var groups = pack(all, BUDGET);
    if (groups.length < 2) return;
    views = groups.map(function (group, i) { return view(group, i + 1); });
    root.replaceChildren();
    views.forEach(function (v) { root.appendChild(v); });
    total = views.length;
  }
  function roster() {
    var kind = racePage ? "race" : "class";
    var list = Array.from(main.querySelectorAll(racePage ? ".race-card" : ".class-card"));
    if (!list.length) return;

    rosterKind = kind;
    cards = list;
    total = Math.ceil(list.length / CARD_LIMIT);
    rosterListPages = [];
    list.forEach(function (card, index) {
      card.dataset.rulesPage = Math.floor(index / CARD_LIMIT) + 1;
      card.hidden = true;
    });

    rosterListNode = document.createElement("nav");
    rosterListNode.className = "rules-roster-index";
    rosterListNode.setAttribute("aria-label", kind === "race" ? "Race previews" : "Class previews");

    for (var start = 0; start < list.length; start += CARD_LIMIT) {
      var pageNumber = Math.floor(start / CARD_LIMIT) + 1;
      var page = document.createElement("div");
      page.className = "rules-roster-page";
      page.dataset.rosterPage = pageNumber;
      var orderedList = document.createElement("ol");

      list.slice(start, start + CARD_LIMIT).forEach(function (card) {
        var heading = card.querySelector("h2,h3,h4,h5,h6");
        var identifier = heading && heading.id;
        if (!identifier) {
          identifier = (heading ? heading.textContent : "entry")
            .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "entry";
          if (heading) heading.id = identifier;
        }
        var fileId = kind === "race" ? identifier.replace(/^race-/, "") : identifier;
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.href = "rules_" + (kind === "race" ? "race-" : "class-") + fileId + ".html";
        link.textContent = heading ? heading.textContent.trim().replace(/\s+/g, " ") : "Read full description";
        item.appendChild(link);

        var summarySource = heading && heading.nextElementSibling;
        if (summarySource && summarySource.tagName !== "P" && summarySource.querySelector) {
          summarySource = summarySource.querySelector("p");
        }
        if (summarySource && summarySource.tagName === "P") {
          var summary = document.createElement("p");
          summary.textContent = summarySource.innerText || summarySource.textContent || "";
          item.appendChild(summary);
        }
        orderedList.appendChild(item);
      });

      page.appendChild(orderedList);
      rosterListPages.push(page);
      rosterListNode.appendChild(page);
    }

    var insertionPoint = kind === "race"
      ? list[0].closest(".rules-section")
      : list[0].parentElement;
    if (insertionPoint && insertionPoint.parentNode) insertionPoint.parentNode.insertBefore(rosterListNode, insertionPoint);
    else main.appendChild(rosterListNode);
  }
  function addIds() {
    var headings = new Set(Array.from(main.querySelectorAll("h2,h3,h4,h5")));
    var used = new Set(Array.from(main.querySelectorAll("[id]")).filter(function (x) { return !headings.has(x); }).map(function (x) { return x.id; }).filter(Boolean));
    main.querySelectorAll("h2,h3,h4,h5").forEach(function (h) {
      if (!h.id || used.has(h.id)) {
        var base = (h.textContent || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section", id = base, i = 2;
        while (used.has(id)) id = base + "-" + i++;
        h.id = id;
      }
      used.add(h.id);
    });
  }
  function mapPages() {
    main.querySelectorAll("[id]").forEach(function (el) {
      var v = el.closest(".rules-page-content"), card = el.closest(".class-card,.race-card");
      var section = el.closest(".rules-section"), firstCard = section && section.querySelector(".class-card,.race-card");
      pageOf.set(el, v ? +v.dataset.rulesPage : card && card.dataset.rulesPage ? +card.dataset.rulesPage : firstCard && firstCard.dataset.rulesPage ? +firstCard.dataset.rulesPage : 1);
    });
  }
  function controls() {
    document.querySelectorAll(".rules-page-controls").forEach(function (x) { x.remove(); });
    if (total < 2) return;
    var nav = function () {
      var n = document.createElement("nav"); n.className = "rules-page-controls"; n.setAttribute("aria-label", "Rules page navigation");
      var ul = document.createElement("ul");
      for (var i = 1; i <= total; i++) {
        var li = document.createElement("li"), a = document.createElement(i === current ? "span" : "a");
        if (i === current) a.setAttribute("aria-current", "page");
        else { var u = new URL(location.href); u.searchParams.set("rulesPage", i); u.hash = ""; a.href = u.pathname + u.search; }
        a.textContent = "Page " + i; li.appendChild(a); ul.appendChild(li);
      }
      n.appendChild(ul); return n;
    };
    var host = main.querySelector(".rules-content") || main; host.insertBefore(nav(), host.firstChild); main.appendChild(nav());
  }
  function index() {
    if (closeResizeObserver && activeIndexFrame) closeResizeObserver.unobserve(activeIndexFrame);
    if (activeIndexCloseButton) activeIndexCloseButton.remove();
    activeIndexFrame = null;
    activeIndexDetails = null;
    activeIndexCloseButton = null;
    activeIndexClosePin = null;
    document.querySelectorAll(".rules-page-index").forEach(function (x) { x.remove(); });
    document.querySelectorAll(".rules-page-index-close").forEach(function (x) { x.remove(); });
    var hs = Array.from(main.querySelectorAll("h2,h3,h4,h5")).filter(function (h) { return !h.closest("nav"); });
    var selected = rosterListNode
      ? (current === 1 ? hs.filter(function (h) { return !h.closest(".class-card,.race-card"); }) : [])
      : (total > 1 ? hs.filter(function (h) { return (pageOf.get(h) || 1) === current; }) : hs);

    var rosterLinks = rosterListNode
      ? Array.from(rosterListNode.querySelectorAll(".rules-roster-page a"))
      : [];
    var extraEntries = [];
    if (!rosterListNode && hs.length === 1 && current === 1) {
      var usedIds = new Set(Array.from(main.querySelectorAll("[id]")).map(function (element) { return element.id; }).filter(Boolean));

      function addEntry(target, value) {
        var entryLabel = String(value || "").replace(/\s+/g, " ").replace(/:\s*$/, "").trim();
        if (!target || !entryLabel) return;
        var id = target.id;
        if (!id) {
          var base = entryLabel.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "index-entry";
          id = base;
          var suffix = 2;
          while (usedIds.has(id)) id = base + "-" + suffix++;
          target.id = id;
        }
        usedIds.add(id);
        extraEntries.push({ label: entryLabel, id: id });
      }

      main.querySelectorAll("table").forEach(function (table) {
        table.querySelectorAll("tr").forEach(function (row) {
          if (row.closest("thead") || row.closest("table") !== table) return;
          var firstCell = row.querySelector("th, td");
          if (firstCell) addEntry(row, firstCell.textContent);
        });
      });

      main.querySelectorAll(".callout > strong:first-child").forEach(function (labelNode) {
        var callout = labelNode.closest(".callout");
        if (callout) addEntry(callout, labelNode.textContent);
      });
    }

    if (!selected.length && !rosterLinks.length && !extraEntries.length) return;
    var n = document.createElement("nav");
    n.className = "rules-page-index";
    n.setAttribute("aria-label", "Chapter Index");
    var d = document.createElement("details"), s = document.createElement("summary");
    d.id = "rules-page-index-details";
    var label = document.createElement("span"); label.textContent = "Chapter Index";
    var indicator = document.createElement("span"); indicator.className = "rules-page-index-indicator"; indicator.setAttribute("aria-hidden", "true");
    s.appendChild(label); s.appendChild(indicator); d.appendChild(s);
    var close = document.createElement("button");
    close.type = "button";
    close.className = "rules-page-index-close";
    close.setAttribute("aria-label", "Close Chapter Index");
    close.setAttribute("aria-controls", d.id);
    close.hidden = true;
    var closeLabel = document.createElement("span");
    closeLabel.textContent = "Close Ch. Index";
    var closeIcon = document.createElement("span");
    closeIcon.className = "rules-page-index-close-icon";
    closeIcon.setAttribute("aria-hidden", "true");
    closeIcon.textContent = "×";
    close.appendChild(closeLabel);
    close.appendChild(closeIcon);
    close.addEventListener("click", function () { d.open = false; s.focus(); });
    d.addEventListener("toggle", function () {
      close.hidden = !d.open;
      if (activeIndexCloseButton !== close) return;
      activeIndexClosePin = null;
      close.classList.remove("is-pinned");
      if (d.open) scheduleActiveIndexClosePosition(true);
    });
    var ul = document.createElement("ul");
    selected.forEach(function (h) {
      var li = document.createElement("li");
      li.dataset.level = h.tagName.slice(1);
      var a = document.createElement("a");
      var p = pageOf.get(h) || 1;
      var u = new URL(location.href);
      if (!rosterListNode) u.searchParams.set("rulesPage", p);
      u.hash = h.id;
      a.href = u.pathname + u.search + u.hash;
      a.textContent = h.textContent.trim().replace(/\s+/g, " ");
      li.appendChild(a);
      ul.appendChild(li);
    });
    rosterLinks.forEach(function (sourceLink) {
      var li = document.createElement("li");
      li.dataset.level = "3";
      var a = document.createElement("a");
      a.href = sourceLink.getAttribute("href");
      a.textContent = sourceLink.textContent.trim().replace(/\s+/g, " ");
      li.appendChild(a);
      ul.appendChild(li);
    });
    extraEntries.forEach(function (entry) {
      var li = document.createElement("li");
      li.dataset.level = "3";
      var a = document.createElement("a");
      a.href = "#" + encodeURIComponent(entry.id);
      a.textContent = entry.label;
      li.appendChild(a);
      ul.appendChild(li);
    });
    d.appendChild(ul);
    n.appendChild(d);
    var indexAnchor = selected[0] || hs.find(function (h) { return !h.closest(".class-card,.race-card"); }) || main.firstElementChild;
    if (indexAnchor) indexAnchor.insertAdjacentElement("afterend", n);
    else main.appendChild(n);
    activeIndexFrame = n;
    activeIndexDetails = d;
    activeIndexCloseButton = close;
    document.body.appendChild(close);
    if (closeResizeObserver) closeResizeObserver.observe(n);
  }
  function styles() {
    var s = document.createElement("style"); s.textContent = ".rules-page-index{display:inline-block;max-width:100%;margin:.6rem 0 1rem;padding:.45rem .7rem;border:1px solid rgba(197,117,0,.5);border-radius:6px;background:rgba(197,117,0,.07)}.rules-page-index summary{display:flex;align-items:center;justify-content:space-between;gap:.5rem;cursor:pointer;color:#c57500;font-size:.9rem;font-weight:700;letter-spacing:.03em}.rules-page-index summary::-webkit-details-marker{display:none}.rules-page-index summary::marker{content:''}.rules-page-index-indicator{display:inline-block;flex:0 0 .48rem;width:.48rem;height:.48rem;margin:0 .15rem .2rem 0;border:solid #c57500;border-width:0 2px 2px 0;transform:rotate(45deg);transition:transform .15s ease}.rules-page-index details[open] .rules-page-index-indicator{transform:rotate(225deg)}.rules-page-index ul{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.35rem 1.25rem;padding:0;margin:.8rem 0;list-style:none}.rules-page-index li[data-level='3']{padding-left:1rem}.rules-page-index li[data-level='4']{padding-left:2rem}.rules-page-controls{margin:1rem 0;padding:.6rem .8rem;border:1px solid rgba(160,140,200,.35);border-radius:8px;background:rgba(120,80,200,.07)}.rules-page-controls ul{display:flex!important;flex-wrap:wrap;gap:.4rem .8rem;list-style:none;margin:0;padding:0}.rules-page-controls a,.rules-page-controls span{display:inline-block;padding:.25rem .5rem;color:inherit}.rules-page-controls [aria-current=page]{font-weight:700;background:rgba(160,140,200,.2)}";
    s.textContent += ".rules-page-index-close{position:fixed;top:0;left:0;z-index:1001;display:flex;align-items:center;gap:.25rem;width:max-content;max-width:calc(100vw - 8px);margin:0;padding:.15rem .4rem;min-height:32px;border:1px solid rgba(197,117,0,.6);border-radius:3px;background:rgba(197,117,0,.14);color:#c57500;font:inherit;font-size:.72rem;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.16);visibility:hidden;pointer-events:none}.rules-page-index-close.is-pinned{visibility:visible;pointer-events:auto}.rules-page-index-close[hidden]{display:none!important}.rules-page-index-close:focus-visible{outline:2px solid #c57500;outline-offset:2px}.rules-page-index-close-icon{font-size:1.1rem;line-height:1}body.lawful-mode .rules-page-index-close{background:rgba(185,170,0,.14);border-color:rgba(120,95,20,.35);color:#78600f}";
    s.textContent += ".rules-page-index details[open] .rules-page-index-indicator{visibility:hidden}";
    document.head.appendChild(s);
  }
  function show(n) {
    current = Math.max(1, Math.min(total, n));
    views.forEach(function (v) { v.hidden = +v.dataset.rulesPage !== current; });
    if (rosterListNode) cards.forEach(function (c) { c.hidden = true; });
    else cards.forEach(function (c) { c.hidden = +c.dataset.rulesPage !== current; });
    rosterListPages.forEach(function (page) { page.hidden = +page.dataset.rosterPage !== current; });
    controls(); index();
  }
  addIds();
  if (paginated && racePage) roster();
  else if (paginated && classPage) roster();
  else if (paginated) generic();
  mapPages();
  var requested = new URLSearchParams(location.search).get("rulesPage");
  show(/^\d+$/.test(requested || "") ? +requested : 1);
  styles();
})();