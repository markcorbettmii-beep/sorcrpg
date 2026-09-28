(function () {
  "use strict";

  var LIMIT = 12000;
  var BUDGET = 11500;
  var CARD_LIMIT = 10;
  var main = document.querySelector("main");
  if (!main) return;

  var file = location.pathname.split("/").pop();
  var classPage = /rules_playable-classes\.html$/i.test(file);
  var racePage = /rules_playable-races\.html$/i.test(file);
  var paginated = /rules_(character-creation|character-progression|combat-movement|equipment|playable-classes|playable-races|sorc-cards|companions)\.html$/i.test(file);
  var views = [], cards = [], pageOf = new Map(), current = 1, total = 1;
  var rosterListNode = null, rosterListPages = [], rosterKind = "";

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
    document.querySelectorAll(".rules-page-index").forEach(function (x) { x.remove(); });
    var hs = Array.from(main.querySelectorAll("h2,h3,h4,h5")).filter(function (h) { return !h.closest("nav"); });
    var selected = rosterListNode
      ? (current === 1 ? hs.filter(function (h) { return !h.closest(".class-card,.race-card"); }) : [])
      : (total > 1 ? hs.filter(function (h) { return (pageOf.get(h) || 1) === current; }) : hs);
    if (!selected.length) return;
    var n = document.createElement("nav"); n.className = "rules-page-index"; n.setAttribute("aria-label", "Page section index");
    var d = document.createElement("details"), s = document.createElement("summary"); s.textContent = "Page " + current + " index — jump to a section"; d.appendChild(s);
    var ul = document.createElement("ul");
    selected.forEach(function (h) { var li = document.createElement("li"); li.dataset.level = h.tagName.slice(1); var a = document.createElement("a"), p = pageOf.get(h) || 1, u = new URL(location.href); if (!rosterListNode) u.searchParams.set("rulesPage", p); u.hash = h.id; a.href = u.pathname + u.search + u.hash; a.textContent = h.textContent.trim(); li.appendChild(a); ul.appendChild(li); });
    d.appendChild(ul); n.appendChild(d); (selected[0] || main.firstChild).insertAdjacentElement("afterend", n);
  }
  function styles() {
    var s = document.createElement("style"); s.textContent = ".rules-page-index{margin:1rem 0 1.5rem;padding:.75rem 1rem;border:1px solid rgba(160,140,200,.35);border-radius:8px;background:rgba(120,80,200,.07)}.rules-page-index summary{cursor:pointer;font-weight:700;letter-spacing:.04em}.rules-page-index ul{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.35rem 1.25rem;padding:0;margin:.8rem 0;list-style:none}.rules-page-index li[data-level='3']{padding-left:1rem}.rules-page-index li[data-level='4']{padding-left:2rem}.rules-page-controls{margin:1rem 0;padding:.6rem .8rem;border:1px solid rgba(160,140,200,.35);border-radius:8px;background:rgba(120,80,200,.07)}.rules-page-controls ul{display:flex!important;flex-wrap:wrap;gap:.4rem .8rem;list-style:none;margin:0;padding:0}.rules-page-controls a,.rules-page-controls span{display:inline-block;padding:.25rem .5rem;color:inherit}.rules-page-controls [aria-current=page]{font-weight:700;background:rgba(160,140,200,.2)}";
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