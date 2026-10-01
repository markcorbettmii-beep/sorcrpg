(function () {
  "use strict";

  var PAGE_LIMIT = 12000;
  var PAGE_CONTENT_BUDGET = 11500;
  var ROSTER_PAGE_LIMIT = 10;
  var main = document.querySelector("main");
  if (!main) return;

  var fileName = window.location.pathname.split("/").pop() || "";
  var pageIndexTitles = {
    "rules_character-creation.html": "Character Creation",
    "rules_character-progression.html": "Character Progression",
    "rules_combat-movement.html": "Combat & Movement",
    "rules_equipment.html": "Armaments & Equipment",
    "rules_playable-classes.html": "Playable Classes",
    "rules_playable-races.html": "Playable Races",
    "rules_sorc-cards.html": "SORC Cards",
    "rules_companions.html": "Companions",
  };
  var pageIndexTitle = pageIndexTitles[fileName.toLowerCase()] || "Rules";
  var canPaginate = /^rules_(character-creation|character-progression|combat-movement|equipment|playable-classes|playable-races|sorc-cards|companions)\.html$/i.test(fileName);
  var isClassPage = /rules_playable-classes\.html$/i.test(fileName);
  var isRacePage = /rules_playable-races\.html$/i.test(fileName);
  var pageByElement = new Map();
  var pageViews = [];
  var paginatedCards = [];
  var rosterCards = [];
  var rosterListPages = [];
  var rosterListNode = null;
  var rosterKind = "";
  var currentPage = 1;
  var totalPages = 1;

  function normalizedLength(value) {
    return String(value || "").replace(/\s+/g, " ").trim().length;
  }

  function textLength(node) {
    if (!node) return 0;
    if (node.nodeType === Node.TEXT_NODE) return normalizedLength(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return 0;
    if (node.matches("script, style, nav, .page-nav, .rules-page-index, .rules-page-controls, .rules-roster-index, .rules-detail-back")) return 0;
    var copy = node.cloneNode(true);
    copy.querySelectorAll("script, style, nav, .page-nav, .rules-page-index, .rules-page-controls, .rules-roster-index, .rules-detail-back").forEach(function (item) {
      item.remove();
    });
    return normalizedLength(copy.innerText || copy.textContent);
  }

  function headingLevel(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return 0;
    var match = node.tagName.match(/^H([1-6])$/);
    return match ? Number(match[1]) : 0;
  }

  function splitAtHeading(nodes, level) {
    var marker = "H" + level;
    if (!nodes.some(function (node) { return node.nodeType === Node.ELEMENT_NODE && node.tagName === marker; })) return [nodes];
    var groups = [];
    var group = [];
    nodes.forEach(function (node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === marker && group.length) {
        groups.push(group);
        group = [];
      }
      group.push(node);
    });
    if (group.length) groups.push(group);
    return groups;
  }

  function splitOversized(nodes, previousLevel, budget) {
    if (nodes.reduce(function (sum, node) { return sum + textLength(node); }, 0) <= budget) return [nodes];
    for (var level = previousLevel + 1; level <= 6; level += 1) {
      var groups = splitAtHeading(nodes, level);
      if (groups.length > 1) {
        return groups.reduce(function (all, group) {
          return all.concat(splitOversized(group, level, budget));
        }, []);
      }
    }
    return [nodes];
  }

  function unitsForSection(section, budget) {
    var nodes = Array.from(section.childNodes);
    var total = nodes.reduce(function (sum, node) { return sum + textLength(node); }, 0);
    if (total <= budget) return [{ section: section, nodes: nodes, chars: total }];

    var firstLevel = nodes.reduce(function (lowest, node) {
      var level = headingLevel(node);
      return level ? Math.min(lowest, level) : lowest;
    }, 7);
    if (firstLevel > 6) return [{ section: section, nodes: nodes, chars: total }];

    return splitAtHeading(nodes, firstLevel).reduce(function (units, group) {
      splitOversized(group, firstLevel, budget).forEach(function (piece) {
        units.push({
          section: section,
          nodes: piece,
          chars: piece.reduce(function (sum, node) { return sum + textLength(node); }, 0)
        });
      });
      return units;
    }, []);
  }

  function packUnits(units, budget) {
    var pages = [];
    var current = [];
    var chars = 0;
    units.forEach(function (unit) {
      if (current.length && chars + unit.chars > budget) {
        pages.push(current);
        current = [];
        chars = 0;
      }
      current.push(unit);
      chars += unit.chars;
    });
    if (current.length) pages.push(current);
    return pages;
  }

  function packCards(cards, budget, maxCards) {
    var pages = [];
    var current = [];
    var chars = 0;
    cards.forEach(function (card) {
      var cardChars = textLength(card);
      if (current.length && (current.length >= maxCards || chars + cardChars > budget)) {
        pages.push(current);
        current = [];
        chars = 0;
      }
      current.push(card);
      chars += cardChars;
    });
    if (current.length) pages.push(current);
    return pages;
  }

  function makePageView(units, pageNumber) {
    var view = document.createElement("div");
    view.className = "rules-page-content";
    view.dataset.rulesPageView = "true";
    view.dataset.rulesPage = String(pageNumber);
    var lastSource = null;
    var lastWrapper = null;

    units.forEach(function (unit) {
      if (unit.section) {
        if (lastSource !== unit.section) {
          lastWrapper = unit.section.cloneNode(false);
          lastWrapper.removeAttribute("id");
          view.appendChild(lastWrapper);
          lastSource = unit.section;
        }
        unit.nodes.forEach(function (node) { lastWrapper.appendChild(node); });
      } else {
        view.appendChild(unit.node);
        lastSource = null;
        lastWrapper = null;
      }
    });
    return view;
  }

  function buildGenericPages() {
    var contentRoot = main.querySelector(".rules-content") || main;
    if (textLength(contentRoot) <= PAGE_LIMIT) return false;

    var rootNodes = Array.from(contentRoot.childNodes);
    var sectionIndexes = [];
    rootNodes.forEach(function (node, index) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("rules-section")) sectionIndexes.push(index);
    });
    if (!sectionIndexes.length) return false;

    var firstSection = sectionIndexes[0];
    var lastSection = sectionIndexes[sectionIndexes.length - 1];
    var fixedBefore = rootNodes.slice(0, firstSection);
    var fixedAfter = rootNodes.slice(lastSection + 1);
    var units = [];

    rootNodes.slice(firstSection, lastSection + 1).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) return;
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("rules-section")) {
        var sectionUnits = unitsForSection(node, PAGE_CONTENT_BUDGET);
        sectionUnits.forEach(function (unit) {
          var containsMedia = unit.nodes.some(function (child) {
            return child.nodeType === Node.ELEMENT_NODE && (child.matches("img, svg, canvas, video, audio, iframe, table") || child.querySelector("img, svg, canvas, video, audio, iframe, table"));
          });
          if (unit.chars > 0 || containsMedia) units.push(unit);
        });
      } else if (node.nodeType === Node.ELEMENT_NODE && node.matches("nav, .page-nav")) {
        units.push({ node: node, chars: 0 });
      } else if (textLength(node) > 0) {
        units.push({ node: node, chars: textLength(node) });
      }
    });

    var pageGroups = packUnits(units, PAGE_CONTENT_BUDGET);
    if (pageGroups.length < 2) return false;

    pageViews = pageGroups.map(function (group, index) {
      return makePageView(group, index + 1);
    });
    contentRoot.replaceChildren();
    fixedBefore.forEach(function (node) { contentRoot.appendChild(node); });
    pageViews.forEach(function (view) { contentRoot.appendChild(view); });
    fixedAfter.forEach(function (node) { contentRoot.appendChild(node); });
    totalPages = pageViews.length;
    return true;
  }

  function rosterHeading(card) {
    return card.querySelector("h2, h3, h4, h5, h6");
  }

  function rosterIdentifier(card, heading) {
    var slug = (heading && heading.textContent || card.textContent || "entry")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "entry";
    var identifier = card.id || (heading && heading.id) || slug;
    if (heading && !heading.id) heading.id = identifier;
    card.dataset.rosterId = identifier;
    return identifier;
  }

  function rosterUrl(identifier, pageNumber, detail) {
    if (detail) {
      var fileId = rosterKind === "race" ? identifier.replace(/^race-/, "") : identifier;
      return "rules_" + (rosterKind === "race" ? "race-" : "class-") + fileId + ".html";
    }
    return (rosterKind === "race" ? "rules_playable-races.html" : "rules_playable-classes.html") +
      "?rulesPage=" + String(pageNumber);
  }

  function buildRosterPages(cards, kind) {
    if (!cards.length) return false;

    rosterCards = cards;
    rosterKind = kind;

    cards.forEach(function (card) {
      var heading = rosterHeading(card);
      rosterIdentifier(card, heading);
    });

    totalPages = Math.ceil(cards.length / ROSTER_PAGE_LIMIT);
    rosterListPages = [];
    cards.forEach(function (card, index) {
      card.dataset.rulesPage = String(Math.floor(index / ROSTER_PAGE_LIMIT) + 1);
      card.hidden = true;
    });

    rosterListNode = document.createElement("nav");
    rosterListNode.className = "rules-roster-index";
    rosterListNode.setAttribute("aria-label", kind === "race" ? "Race previews" : "Class previews");

    for (var start = 0; start < cards.length; start += ROSTER_PAGE_LIMIT) {
      var pageNumber = Math.floor(start / ROSTER_PAGE_LIMIT) + 1;
      var page = document.createElement("div");
      page.className = "rules-roster-page";
      page.dataset.rosterPage = String(pageNumber);
      var list = document.createElement("ol");
      var pageCards = cards.slice(start, start + ROSTER_PAGE_LIMIT);

      pageCards.forEach(function (card) {
        var heading = rosterHeading(card);
        var title = heading ? heading.textContent.trim().replace(/\s+/g, " ") : "Read full description";
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.href = rosterUrl(card.dataset.rosterId, pageNumber, true);
        link.textContent = title;
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
        list.appendChild(item);
      });

      page.appendChild(list);
      rosterListPages.push(page);
      rosterListNode.appendChild(page);
    }

    var insertionPoint;
    if (kind === "race") {
      var rosterHeadingNode = main.querySelector("#race-section-goliath");
      insertionPoint = rosterHeadingNode && rosterHeadingNode.closest(".rules-section");
    } else {
      insertionPoint = cards[0].parentElement;
    }
    if (insertionPoint && insertionPoint.parentNode) {
      insertionPoint.parentNode.insertBefore(rosterListNode, insertionPoint);
    } else {
      main.appendChild(rosterListNode);
    }
    return totalPages > 1;
  }

  function buildRacePages() {
    return buildRosterPages(Array.from(main.querySelectorAll(".race-card")), "race");
  }

  function buildClassPages() {
    return buildRosterPages(Array.from(main.querySelectorAll(".class-card")), "class");
  }

  function pageForElement(element) {
    if (!element) return 1;
    var directView = element.closest(".rules-page-content");
    if (directView) return Number(directView.dataset.rulesPage) || 1;
    var card = element.closest(".class-card, .race-card");
    if (card && card.dataset.rulesPage) return Number(card.dataset.rulesPage) || 1;
    var section = element.closest(".rules-section");
    if (section) {
      var firstCard = section.querySelector(".class-card, .race-card");
      if (firstCard && firstCard.dataset.rulesPage) return Number(firstCard.dataset.rulesPage) || 1;
    }
    return 1;
  }

  function rememberElementPages() {
    main.querySelectorAll("[id]").forEach(function (element) {
      pageByElement.set(element, pageForElement(element));
    });
  }

  function requestedPageFromLocation() {
    var params = new URLSearchParams(window.location.search);
    var explicitPage = params.get("rulesPage");
    if (explicitPage !== null && /^\d+$/.test(explicitPage)) {
      return Math.max(1, Math.min(totalPages, Number(explicitPage)));
    }
    var id = decodeURIComponent((window.location.hash || "").slice(1));
    if (id) {
      var target = document.getElementById(id);
      if (target) return Math.max(1, Math.min(totalPages, pageForElement(target)));
    }
    return 1;
  }

  function makePageControls() {
    var nav = document.createElement("nav");
    nav.className = "rules-page-controls";
    nav.setAttribute("aria-label", "Rules page navigation");
    var list = document.createElement("ul");
    for (var number = 1; number <= totalPages; number += 1) {
      var item = document.createElement("li");
      if (number === currentPage) {
        var current = document.createElement("span");
        current.textContent = "Page " + number;
        current.setAttribute("aria-current", "page");
        item.appendChild(current);
      } else {
        var link = document.createElement("a");
        var url = new URL(window.location.href);
        url.searchParams.set("rulesPage", String(number));
        url.hash = "";
        link.href = url.pathname + url.search;
        link.textContent = "Page " + number;
        item.appendChild(link);
      }
      list.appendChild(item);
    }
    nav.appendChild(list);
    return nav;
  }

  function renderPageControls() {
    document.querySelectorAll(".rules-page-controls").forEach(function (nav) { nav.remove(); });
    if (totalPages <= 1) return;
    var host = main.querySelector(".rules-content") || main;
    var top = makePageControls();
    var bottom = makePageControls();
    host.insertBefore(top, host.firstChild);
    main.appendChild(bottom);
  }

  function showPage(pageNumber) {
    currentPage = Math.max(1, Math.min(totalPages, pageNumber));
    pageViews.forEach(function (view) {
      view.hidden = Number(view.dataset.rulesPage) !== currentPage;
    });
    paginatedCards.forEach(function (card) {
      card.hidden = Number(card.dataset.rulesPage) !== currentPage;
    });
    if (rosterListNode) {
      rosterCards.forEach(function (card) { card.hidden = true; });
      rosterListPages.forEach(function (page) {
        page.hidden = Number(page.dataset.rosterPage) !== currentPage;
      });
    }
    renderPageControls();
  }

  function ensureHeadingIds(headings) {
    var headingSet = new Set(headings);
    var usedIds = new Set();
    main.querySelectorAll("[id]").forEach(function (element) {
      if (!headingSet.has(element)) usedIds.add(element.id);
    });
    headings.forEach(function (heading) {
      var id = heading.id;
      if (!id || usedIds.has(id)) {
        var slug = (id || heading.textContent.trim())
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "section";
        var unique = slug;
        var suffix = 2;
        while (usedIds.has(unique)) {
          unique = slug + "-" + suffix;
          suffix += 1;
        }
        heading.id = unique;
        id = unique;
      }
      usedIds.add(id);
    });
  }

  function addStyles() {
    if (document.getElementById("rules-page-index-styles")) return;
    var style = document.createElement("style");
    style.id = "rules-page-index-styles";
    style.textContent =
      ".rules-page-index{display:inline-block;max-width:100%;margin:.6rem 0 1rem;padding:.45rem .7rem;border:1px solid rgba(197,117,0,.5);border-radius:4px;background:rgba(197,117,0,.07)}" +
      ".rules-page-index summary{display:flex;align-items:center;justify-content:space-between;gap:.5rem;cursor:pointer;color:#c57500;font-size:.9rem;font-weight:700;letter-spacing:.03em}" +
      ".rules-page-index summary::-webkit-details-marker{display:none}" +
      ".rules-page-index summary::marker{content:''}" +
      ".rules-page-index-indicator{display:inline-block;flex:0 0 .48rem;width:.48rem;height:.48rem;margin:0 .15rem .2rem 0;border:solid #c57500;border-width:0 2px 2px 0;transform:rotate(45deg);transition:transform .15s ease}" +
      ".rules-page-index details[open] .rules-page-index-indicator{transform:rotate(225deg)}" +
      ".rules-page-index-close{position:sticky;top:8px;z-index:2;display:flex;align-items:center;gap:.35rem;width:max-content;max-width:100%;margin:.55rem 0 .55rem auto;padding:.4rem .65rem;min-height:44px;border:1px solid rgba(197,117,0,.6);border-radius:4px;background:rgba(197,117,0,.12);color:#c57500;font:inherit;font-size:.84rem;font-weight:700;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)}" +
      ".rules-page-index-close[hidden]{display:none!important}" +
      ".rules-page-index-close:focus-visible{outline:2px solid #c57500;outline-offset:2px}" +
      ".rules-page-index-close-icon{font-size:1.1rem;line-height:1}" +
      ".rules-page-index ul{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin:.6rem 0 0;padding-left:1.2rem;gap:.25rem 1rem}" +
      ".rules-page-index li{break-inside:avoid;margin:.2rem 0}" +
      ".rules-page-index a{color:inherit;text-decoration-color:rgba(197,160,66,.55)}" +
      ".rules-page-index .index-level-3{margin-left:1rem;list-style-type:circle}" +
      ".rules-page-index .index-level-4{margin-left:2rem;list-style-type:square}" +
      ".rules-page-controls{margin:1rem 0;padding:.6rem .8rem;border:1px solid rgba(197,160,66,.28);border-radius:4px;background:rgba(10,12,22,.2)}" +
      ".rules-page-controls ul{display:flex!important;flex-wrap:wrap;gap:.4rem .8rem;list-style:none;margin:0;padding:0}" +
      ".rules-page-controls a,.rules-page-controls span{display:inline-block;padding:.25rem .5rem;border-radius:3px;color:inherit}" +
      ".rules-page-controls [aria-current=page]{background:rgba(197,160,66,.2);font-weight:700}" +
      "body.lawful-mode .rules-page-index,body.lawful-mode .rules-page-controls{background:rgba(185,170,0,.08);border-color:rgba(120,95,20,.28)}" +
      "body.lawful-mode .rules-page-index-close{background:rgba(185,170,0,.14);border-color:rgba(120,95,20,.35);color:#78600f}";
    style.textContent += ".rules-page-index details[open] .rules-page-index-indicator{visibility:hidden}";
    document.head.appendChild(style);
  }

  function supplementalIndexEntries(headings) {
    if (rosterListNode || headings.length !== 1 || currentPage !== 1) return [];

    var entries = [];
    var usedIds = new Set(Array.from(main.querySelectorAll("[id]")).map(function (element) { return element.id; }).filter(Boolean));

    function addEntry(target, value) {
      var label = String(value || "").replace(/\s+/g, " ").replace(/:\s*$/, "").trim();
      if (!target || !label) return;

      var id = target.id;
      if (!id) {
        var base = label.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "index-entry";
        id = base;
        var suffix = 2;
        while (usedIds.has(id)) id = base + "-" + suffix++;
        target.id = id;
      }
      usedIds.add(id);
      entries.push({ label: label, id: id });
    }

    main.querySelectorAll("table").forEach(function (table) {
      table.querySelectorAll("tr").forEach(function (row) {
        if (row.closest("thead") || row.closest("table") !== table) return;
        var firstCell = row.querySelector("th, td");
        if (firstCell) addEntry(row, firstCell.textContent);
      });
    });

    main.querySelectorAll(".callout > strong:first-child").forEach(function (label) {
      var callout = label.closest(".callout");
      if (callout) addEntry(callout, label.textContent);
    });

    return entries;
  }

  function addHeadingIndex(headings) {
    var selection;
    if (rosterListNode) {
      selection = currentPage === 1
        ? headings.filter(function (heading) { return !heading.closest(".class-card, .race-card"); })
        : [];
    } else {
      selection = currentPage === 1 && totalPages > 1
        ? headings
        : headings.filter(function (heading) { return pageForElement(heading) === currentPage; });
    }
    var rosterLinks = rosterListNode
      ? Array.from(rosterListNode.querySelectorAll(".rules-roster-page a"))
      : [];
    var extraEntries = supplementalIndexEntries(headings);
    if (!selection.length && !rosterLinks.length && !extraEntries.length) return;

    var nav = document.createElement("nav");
    nav.className = "rules-page-index";
    nav.setAttribute("aria-label", "Chapter Index");
    var details = document.createElement("details");
    var summary = document.createElement("summary");
    var summaryLabel = document.createElement("span");
    summaryLabel.textContent = "Chapter Index";
    var indicator = document.createElement("span");
    indicator.className = "rules-page-index-indicator";
    indicator.setAttribute("aria-hidden", "true");
    summary.appendChild(summaryLabel);
    summary.appendChild(indicator);
    var list = document.createElement("ul");
    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "rules-page-index-close";
    closeButton.setAttribute("aria-label", "Close Chapter Index");
    closeButton.hidden = true;
    var closeLabel = document.createElement("span");
    closeLabel.textContent = "Close Ch. Index";
    var closeIcon = document.createElement("span");
    closeIcon.className = "rules-page-index-close-icon";
    closeIcon.setAttribute("aria-hidden", "true");
    closeIcon.textContent = "×";
    closeButton.appendChild(closeLabel);
    closeButton.appendChild(closeIcon);
    closeButton.addEventListener("click", function () {
      details.open = false;
      summary.focus();
    });
    details.addEventListener("toggle", function () {
      closeButton.hidden = !details.open;
    });

    selection.forEach(function (heading) {
      var item = document.createElement("li");
      var level = headingLevel(heading) || 2;
      item.className = "index-level-" + level;
      var link = document.createElement("a");
      var targetPage = pageForElement(heading);
      if (targetPage === currentPage || rosterListNode) {
        link.href = "#" + encodeURIComponent(heading.id);
      } else {
        var url = new URL(window.location.href);
        url.searchParams.set("rulesPage", String(targetPage));
        url.hash = heading.id;
        link.href = url.pathname + url.search + url.hash;
      }
      link.textContent = heading.textContent.trim().replace(/\s+/g, " ");
      item.appendChild(link);
      list.appendChild(item);
    });

    rosterLinks.forEach(function (sourceLink) {
      var item = document.createElement("li");
      item.className = "index-level-3";
      var link = document.createElement("a");
      link.href = sourceLink.getAttribute("href");
      link.textContent = sourceLink.textContent.trim().replace(/\s+/g, " ");
      item.appendChild(link);
      list.appendChild(item);
    });

    extraEntries.forEach(function (entry) {
      var item = document.createElement("li");
      item.className = "index-level-3";
      var link = document.createElement("a");
      link.href = "#" + encodeURIComponent(entry.id);
      link.textContent = entry.label;
      item.appendChild(link);
      list.appendChild(item);
    });

    details.appendChild(summary);
    details.appendChild(closeButton);
    details.appendChild(list);
    nav.appendChild(details);

    var firstVisibleHeading = headings.find(function (heading) {
      var view = heading.closest(".rules-page-content");
      return !heading.closest(".class-card, .race-card") && (!view || !view.hidden);
    });
    var indexAnchor = firstVisibleHeading || main.firstElementChild;
    if (indexAnchor) indexAnchor.insertAdjacentElement("afterend", nav);
    else main.appendChild(nav);
  }

  var headings = Array.from(main.querySelectorAll("h2, h3, h4")).filter(function (heading) {
    return !heading.closest("nav, .rules-page-index, .rules-page-controls");
  });
  ensureHeadingIds(headings);

  if (canPaginate && isRacePage) {
    buildRacePages();
  } else if (canPaginate && isClassPage) {
    buildClassPages();
  } else if (canPaginate) {
    buildGenericPages();
  }

  rememberElementPages();
  currentPage = requestedPageFromLocation();
  showPage(currentPage);
  addStyles();
  addHeadingIndex(headings);

  if (window.location.hash) {
    window.requestAnimationFrame(function () {
      var target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target) target.scrollIntoView();
    });
  }
})();