(function() {
  var host = document.querySelector('[data-character-workspace-nav]');
  if (!host) return;

  var params = new URLSearchParams(window.location.search);
  var characterId = params.get('characterId') || '';
  if (!characterId) {
    try { characterId = localStorage.getItem('sorc.characterId') || ''; } catch (e) {}
  } else {
    try { localStorage.setItem('sorc.characterId', characterId); } catch (e) {}
  }

  var current = host.getAttribute('data-current') || '';
  var links = [
    { id: 'sheet', label: 'Character Sheet', title: 'View Character Sheet', href: '/content/character/character-sheet-fem-musc.html' },
    { id: 'customize', label: 'Customize', title: 'Customize Character', href: '/content/character/character-customizer/cc-default.html' },
    { id: 'property', label: 'Property & Cards', title: 'Manage Property & Cards', href: '/content/features/space.html?tab=property' },
    { id: 'home', label: 'Home & Family', title: 'Open Home & Family', href: '/content/pages/home-and-family.html' },
    { id: 'journal', label: 'Journal', title: 'Open Journal', href: '/content/pages/journal.html' }
  ];

  function withCharacterId(href) {
    var url = new URL(href, window.location.origin);
    if (characterId) url.searchParams.set('characterId', characterId);
    return url.pathname + url.search + url.hash;
  }

  host.innerHTML = '<nav class="character-workspace-nav" aria-label="Character Workspace">' +
    links.map(function(link, index) {
      var separator = index ? '<span class="separator" aria-hidden="true">·</span>' : '';
      if (link.id === current) {
        return separator + '<span class="current" aria-current="page" title="' + link.title + '">' + link.label + '</span>';
      }
      return separator + '<a href="' + withCharacterId(link.href) + '" title="' + link.title + '">' + link.label + '</a>';
    }).join('') +
    '</nav>';

  if (characterId) {
    document.querySelectorAll('a[href]').forEach(function(anchor) {
      var href = anchor.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.indexOf('://') !== -1) return;
      try {
        var url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (!/character|features\/space|pages\/home-and-family|pages\/journal/.test(url.pathname)) return;
        url.searchParams.set('characterId', characterId);
        anchor.setAttribute('href', url.pathname + url.search + url.hash);
      } catch (e) {}
    });
  }

  window.SORCCharacterWorkspace = {
    characterId: characterId,
    withCharacterId: withCharacterId
  };
})();