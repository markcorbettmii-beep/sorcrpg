(function() {
    'use strict';

    var PLANETS = [
        { id:'glacies-et-ignis', name:'Glacies et Ignis', className:'ember' },
        { id:'tenue', name:'Tenue', className:'green', moon:'No moon' },
        { id:'tribus', name:'Tribus', className:'ice' },
        { id:'zailister', name:'Zailister', short:'Zail', className:'zail', active:true },
        { id:'quintus-elementum', name:'Quintus Elementum', className:'ochre' },
        { id:'hexagonum', name:'Hexagonum', className:'dark' },
        { id:'citrine-candenti', name:'Citrine Candenti', className:'citrine', moon:'Three moons' },
        { id:'octavo', name:'Octavo', className:'split' },
        { id:'angeligla', name:'Angeligla', className:'gas', moon:'Auralis I · II · III' },
        { id:'corpus-caeleste', name:'Corpus Caeleste', className:'violet', moon:'Spectros' },
        { id:'undeximus', name:'Undeximus', className:'blue' },
        { id:'omne-malum', name:'Omnè Malum', className:'cloud' },
        { id:'tredeki', name:'Tredeki', className:'metal' }
    ];
    var PLANET_PLACES = [
        { id:'nivis', name:'Nivis', x:448, y:350, level:'nivis' },
        { id:'glaciera', name:'Glaciera', x:402, y:255 },
        { id:'terrora', name:'Terrora', x:165, y:410 },
        { id:'natura', name:'Natura', x:750, y:365 },
        { id:'southern-arctic', name:'Southern Arctic', x:695, y:625 },
        { id:'wandering-wastelands', name:'Wandering Wastelands', x:296, y:334 },
        { id:'aestus', name:'Isles of Aestus', x:605, y:260 },
        { id:'chisel-islands', name:'Chisel Islands', x:700, y:438 },
        { id:'nivis-islands', name:'Nivis Islands', x:450, y:515 }
    ];
    var NIVIS_POINTS = [
        { id:1, name:'Prismatic Lagoon', x:150, y:535 },
        { id:2, name:'Pearl Coast', x:210, y:410 },
        { id:3, name:'Umbra Ocean', x:160, y:270 },
        { id:4, name:'Cascade Heights', x:355, y:310 },
        { id:5, name:'Strait of Nivisthunderneathalion', x:365, y:220 },
        { id:6, name:'Mt. Deadtooth', x:490, y:320 },
        { id:7, name:"Hold's Keep Valley", x:350, y:480, level:'valley' },
        { id:8, name:'Putrid Sludge of Umbra', x:280, y:360 },
        { id:9, name:'The Underhold', x:415, y:545 },
        { id:10, name:'Deadtooth Pass', x:455, y:380 },
        { id:11, name:'Firey Spires', x:530, y:475 },
        { id:12, name:"Pirate's Bay", x:510, y:145 },
        { id:13, name:'Heavenly Peaks', x:560, y:235 },
        { id:14, name:'Spire Crumbling Bridge', x:585, y:335 },
        { id:15, name:'Dragon Lagoon', x:665, y:160 },
        { id:16, name:"Serpent's Ridge", x:635, y:405 },
        { id:17, name:'Jungle Boue', x:525, y:575 },
        { id:18, name:'Rooted Hollows', x:445, y:605 },
        { id:19, name:'Sloughs of Sorrow', x:295, y:445 },
        { id:20, name:'Fareast Wetlands', x:710, y:455 },
        { id:21, name:'Mystic Marsh of Wraith Water', x:665, y:535 },
        { id:22, name:'Bleeding Bayou', x:742, y:590 },
        { id:23, name:"Dead Man's Wharf", x:335, y:625 },
        { id:24, name:'Grinhold', x:405, y:415 }
    ];
    var VALLEY_PLACES = [
        { id:'stronghold', name:'Imperial Stronghold', x:420, y:200 },
        { id:'mountains-north', name:'Mt. Pelasgian Range', x:580, y:95 },
        { id:'cemetery', name:'Grey Valley Cemetery', x:230, y:300 },
        { id:'dead-woods', name:'The Dead Woods', x:105, y:400 },
        { id:'shield', name:"Kael's Shield (Wall)", x:520, y:475 },
        { id:'church', name:'Church of the Holy Avenger', x:660, y:620 },
        { id:'forest', name:'Bustling Forest · Veilwood Gate', x:405, y:565 },
        { id:'camp', name:'Human Camp', x:205, y:585 },
        { id:'styx', name:'River Styx', x:105, y:790 },
        { id:'rampart', name:"Kael Vorn's Rampart", x:285, y:935 }
    ];
    var MAPS = {
        planet:{ name:'Planet Zailister', image:'/content/maps/assets/hud/zailister-map.png', ratio:'9 / 7', viewBox:'0 0 900 700', points:PLANET_PLACES },
        nivis:{ name:'Continent Nivis', image:'/content/maps/assets/hud/nivis-continent.png', ratio:'9 / 7', viewBox:'0 0 900 700', points:NIVIS_POINTS },
        valley:{ name:"Hold's Keep Valley", image:'/content/maps/assets/hud/holds-keep-valley.png', ratio:'3 / 4', viewBox:'0 0 768 1024', points:VALLEY_PLACES }
    };
    var ICONS = {
        'hud-z':'<path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z"/><circle cx="12" cy="12" r="3"/>',
        overview:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4M4 12h3m10 0h3"/>',
        'trophy-room':'<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5m-4 3h8"/>',
        characters:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        leaderboards:'<path d="M4 20V10h4v10M10 20V4h4v16m2 0v-8h4v8M2 21h20"/>',
        fellows:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>',
        property:'<path d="M12 2 20 5v6c0 5-3.3 8.5-8 11-4.7-2.5-8-6-8-11V5l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
        'online-journal':'<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3Z"/><path d="M5 17a2 2 0 0 1 2-2h12M9 7h6m-6 4h6"/>',
        home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
        standing:'<path d="m3 8 5 4 4-7 4 7 5-4-2 11H5L3 8Z"/><path d="M5 22h14"/>',
        'essentia-exchange':'<path d="M4 7h15l-3-3m4 13H5l3 3"/><path d="M19 7v5M5 17v-5"/>',
        mailbox:'<path d="M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v11H4V8Z"/><path d="M4 13h6l2 3 2-3h6"/>',
        settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a8 8 0 0 0 0-6l1.4-1.1-1.4-2.4-1.7.7a8 8 0 0 0-1.7-1L15.7 3h-2.8l-.3 1.8a8 8 0 0 0-1.7 1l-1.7-.7-1.4 2.4L9.2 9a8 8 0 0 0 0 6l-1.4 1.1 1.4 2.4 1.7-.7a8 8 0 0 0 1.7 1l.3 1.8h2.8l.3-1.8a8 8 0 0 0 1.7-1l1.7.7 1.4-2.4Z"/>'
    };
    var currentLevel = 'planet';
    var lastRenderArgs = { user:{}, isPro:false, isWanderer:false, tabs:[] };
    var selectedCharacterId = '';
    var selectedDomainId = '';
    var zoom = 1, translateX = 0, translateY = 0;
    var pointers = new Map(), drag = null, pinch = null;

    function esc(value) {
        return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function hudData() {
        var source = window.SORC_SPACE_HUD_DATA;
        return source && typeof source === 'object' ? source : null;
    }
    function serverId(source) {
        return String(source && (source.languageServerId || source.gameServerId || source.serverId) || '');
    }
    function recordCharacterId(record) {
        return String(record && (record.characterId || record.character_id || record.id) || '');
    }
    function readiedCharacters() {
        var source = hudData();
        var activeServerId = serverId(source);
        if (!source || !activeServerId) return [];
        var explicitlyReady = Array.isArray(source.readiedCharacters) ? source.readiedCharacters : null;
        var candidates = explicitlyReady || (Array.isArray(source.characters) ? source.characters : []);
        var readyIds = Array.isArray(source.readiedCharacterIds) ? source.readiedCharacterIds.map(String) : [];
        return candidates.filter(function(record) {
            var id = recordCharacterId(record);
            var recordServerId = String(record.serverId || record.languageServerId || record.gameServerId || record.server_id || '');
            var isReadied = !!explicitlyReady || record.readied === true || record.isReadied === true ||
                record.is_readied === true || readyIds.indexOf(id) !== -1;
            return !!id && isReadied && recordServerId === activeServerId;
        });
    }
    function selectedCharacter(user) {
        var candidates = readiedCharacters();
        var requestedId = String(selectedCharacterId || (user && (user.active_character_id || user.activeCharacterId || user.characterId)) || '');
        if (!requestedId && candidates.length === 1) return candidates[0];
        return candidates.find(function(record) { return recordCharacterId(record) === requestedId; }) || null;
    }
    function characterId(user) {
        return recordCharacterId(selectedCharacter(user));
    }
    function characterPortrait(record) {
        var url = String(record && (record.portraitUrl || record.portrait_url || record.portraitImageUrl || record.portrait_image_url) || '').trim();
        return /^(https?:\/\/|\/)/i.test(url) ? url : '';
    }
    function planetSelector() {
        return '<div class="space-hud-planet-grid" aria-label="Planets and moons">' + PLANETS.map(function(planet) {
            return '<div class="space-hud-planet ' + (planet.active ? 'active' : 'dimmed') + '" aria-current="' + (planet.active ? 'true' : 'false') + '">' +
                '<span class="space-hud-planet-orb ' + esc(planet.className) + '" aria-hidden="true"></span><span class="space-hud-planet-copy"><strong>' +
                esc(planet.name) + (planet.short ? ' <small>(' + esc(planet.short) + ')</small>' : '') + '</strong>' +
                (planet.moon ? '<small class="space-hud-moon">' + esc(planet.moon) + '</small>' : '') +
                (planet.active ? '<small class="space-hud-planet-state">Map available</small>' : '') + '</span></div>';
        }).join('') + '</div>';
    }
    function solarSystem() {
        var summary = domainSummary();
        var hasPosition = !!characterPosition();
        var nodes = PLANETS.map(function(planet, index) {
            var angle = (-142 + index * 26) * Math.PI / 180;
            var rx = 13 + index * 2.7, ry = 9 + index * 2.1;
            var left = 50 + Math.cos(angle) * rx, top = 50 + Math.sin(angle) * ry;
            var size = planet.active ? 46 : 22 + (index % 3) * 3;
            var moonCount = knownMoonCount(planet);
            var moonTrack = moonCount
                ? '<span class="space-hud-system-moon-track" aria-hidden="true">' +
                    Array.from({ length:moonCount }, function(_, moonIndex) {
                        return '<i style="--moon-angle:' + (moonIndex * 360 / moonCount) + 'deg"></i>';
                    }).join('') + '</span>'
                : '';
            var content = '<span class="space-hud-globe ' + esc(planet.className) + '"></span>' + moonTrack +
                '<span class="space-hud-system-name">' + esc(planet.name) + '</span>' +
                (planet.moon && planet.moon !== 'No moon' ? '<small class="space-hud-system-moon">' + esc(planet.moon) + '</small>' : '') +
                (planet.active ? '<span class="space-hud-system-markers">' +
                    (summary.domains ? '<small class="domain-count">D ' + summary.domains + '</small>' : '') +
                    (summary.items ? '<small class="item-count">Items ' + summary.items + '</small>' : '') +
                    (hasPosition ? '<small class="position-count">YOU</small>' : '') + '</span>' : '');
            return planet.active
                ? '<button type="button" class="space-hud-system-body zailister" style="--orbit-x:' + left + '%;--orbit-y:' + top + '%;--globe-size:' + size + 'px" onclick="window.setSpaceHudLevel(\'planet\')" aria-label="Explore Zailister">' + content + '</button>'
                : '<div class="space-hud-system-body dimmed" style="--orbit-x:' + left + '%;--orbit-y:' + top + '%;--globe-size:' + size + 'px" aria-label="' + esc(planet.name) + '">' + content + '</div>';
        }).join('');
        var orbits = [20, 31, 42, 53, 64, 75, 86].map(function(width, index) {
            return '<i class="space-hud-orbit" style="--orbit-width:' + width + '%;--orbit-height:' + (15 + index * 9) + '%"></i>';
        }).join('');
        return '<div class="space-hud-solar-system" id="spaceHudSolarSystem" aria-label="Solar system; Zailister is highlighted">' +
            '<div class="space-hud-star adoria" title="Adoria"></div><div class="space-hud-star tawdry" title="Tawdry Dwarf"></div>' +
            '<span class="space-hud-star-label">Adoria · Tawdry Dwarf</span>' + orbits + nodes +
            '<div class="space-hud-system-note">Zoom in or select Zailister to open its atlas.</div></div>';
    }
    function knownMoonCount(planet) {
        if (!planet.moon || planet.moon === 'No moon') return 0;
        if (/three/i.test(planet.moon)) return 3;
        return planet.moon.split('·').length;
    }
    function universeView() {
        var summary = domainSummary();
        var position = characterPosition();
        var markers = (summary.domains ? '<span class="space-hud-universe-marker domain-count">Domains ' + summary.domains + '</span>' : '') +
            (summary.items ? '<span class="space-hud-universe-marker item-count">Items ' + summary.items + '</span>' : '') +
            (position ? '<span class="space-hud-universe-marker position-count">YOU · Zailister</span>' : '');
        return '<div class="space-hud-universe-viewport" id="spaceHudMapViewport"><div class="space-hud-universe-stars" aria-hidden="true"></div>' +
            '<button type="button" class="space-hud-universe-system" onclick="window.setSpaceHudLevel(\'solar\')" aria-label="Open the known Adoria and Tawdry Dwarf system">' +
            '<span class="space-hud-universe-orbit"></span><span class="space-hud-universe-orbit second"></span><span class="space-hud-universe-star"></span>' +
            '<strong>Adoria · Tawdry Dwarf</strong><small>Known planetary system</small>' + (markers ? '<span class="space-hud-universe-markers">' + markers + '</span>' : '') +
            '</button><p class="space-hud-universe-note">Only recorded systems are shown; unconnected universe data is not inferred.</p></div>';
    }
    function domainRecords() {
        var source = hudData();
        var user = lastRenderArgs.user || {};
        if (!source || typeof source !== 'object') return { personal:[], campaigns:[], serverLabel:'Not connected', connected:false };
        var id = characterId(user);
        var activeServerId = serverId(source);
        var own = Array.isArray(source.characterDomains) ? source.characterDomains : [];
        var personal = own.filter(function(item) {
            var ownerId = String(item.characterId || item.ownerCharacterId || item.character_id || '');
            var recordServerId = String(item.serverId || item.languageServerId || item.gameServerId || '');
            return !!id && ownerId === id && item.planetId === 'zailister' &&
                (!recordServerId || recordServerId === activeServerId);
        });
        var campaignIds = Array.isArray(source.currentCampaignIds) ? source.currentCampaignIds.map(String) : [];
        var campaignList = Array.isArray(source.campaignDomains) ? source.campaignDomains : [];
        var campaigns = activeServerId && id ? campaignList.filter(function(item) {
            var ownerId = String(item.characterId || item.ownerCharacterId || item.character_id || '');
            return item.planetId === 'zailister' &&
                String(item.serverId || item.languageServerId || item.gameServerId || '') === activeServerId &&
                ownerId !== id && campaignIds.indexOf(String(item.campaignId || '')) !== -1;
        }) : [];
        var shared = activeServerId && id && Array.isArray(source.sharedDomains)
            ? source.sharedDomains.filter(function(item) {
                var ownerId = String(item.characterId || item.ownerCharacterId || item.character_id || '');
                return item.planetId === 'zailister' &&
                    String(item.serverId || item.languageServerId || item.gameServerId || '') === activeServerId &&
                    ownerId && ownerId !== id && item.authorized === true;
            })
            : [];
        shared.forEach(function(item) {
            var id = String(item.id || item.domainId || '');
            if (!campaigns.some(function(existing) { return String(existing.id || existing.domainId || '') === id; })) campaigns.push(item);
        });
        return {
            personal:personal, campaigns:campaigns,
            serverLabel:source.languageServerName || (activeServerId ? 'Game server linked' : 'Not connected'),
            connected:Array.isArray(source.characterDomains) && !!activeServerId && !!id && Array.isArray(source.currentCampaignIds)
        };
    }
    function characterPosition() {
        var source = hudData();
        if (!source) return null;
        var id = characterId(lastRenderArgs.user || {});
        if (!id || !serverId(source)) return null;
        var position = source.characterPosition || source.currentPosition || null;
        if (!position && Array.isArray(source.characterPositions)) {
            position = source.characterPositions.find(function(item) {
                return String(item.characterId || item.character_id || '') === id;
            }) || null;
        }
        if (!position || (position.characterId && String(position.characterId) !== id) ||
            (position.character_id && String(position.character_id) !== id)) return null;
        var positionServerId = String(position.serverId || position.languageServerId || position.gameServerId || '');
        if (positionServerId && positionServerId !== serverId(source)) return null;
        if (position.planetId !== 'zailister') return null;
        return position;
    }
    function domainContents(domain) {
        if (Array.isArray(domain.contents)) return domain.contents;
        if (Array.isArray(domain.items)) return domain.items;
        return [];
    }
    function domainId(domain) {
        return String(domain && (domain.id || domain.domainId || domain.domain_id) || '');
    }
    function hasMapCoordinates(item) {
        return !!(item && MAPS[item.mapLevel] &&
            item.mapX != null && item.mapY != null &&
            String(item.mapX).trim() !== '' && String(item.mapY).trim() !== '' &&
            Number.isFinite(Number(item.mapX)) && Number.isFinite(Number(item.mapY)));
    }
    function domainSummary() {
        var records = domainRecords().personal;
        return {
            domains:records.length,
            items:records.reduce(function(total, domain) { return total + domainContents(domain).length; }, 0)
        };
    }
    function domainSlots() {
        var data = domainRecords();
        var caps = lastRenderArgs.isPro
            ? [{ label:'Domain 1', size:'Tract · larger land; Character-built city' }, { label:'Domain 2', size:'Parcel · several Homes' }, { label:'Domain 3', size:'Lot · one Home' }]
            : [{ label:'Domain', size:'Lot · one Home' }];
        var rules = '/content/essentia_core/rules_game-features.html#domains';
        return '<div class="space-hud-domain-slots">' + caps.map(function(cap, index) {
            var domain = data.personal[index];
            return '<article class="space-hud-domain-slot ' + (domain ? 'assigned' : 'unassigned') + '">' +
                '<span class="space-hud-domain-title">' + esc(cap.label) + '</span><span class="space-hud-domain-cap">' + esc(cap.size) + '</span>' +
                (domain
                    ? '<strong>' + esc(domain.name || 'Named Domain') + '</strong><small>' + esc(domain.path || domain.locationLabel || 'Location details pending') + '</small>' +
                        (hasMapCoordinates(domain) && domainId(domain)
                            ? '<button type="button" class="space-hud-domain-jump" data-space-domain-id="' + esc(domainId(domain)) + '">Show on map</button>'
                            : '<small>Map coordinates are not recorded; no marker is shown.</small>')
                    : '<span class="space-hud-domain-unassigned">' +
                        (data.connected ? 'No Domain is recorded for this Character.' : 'Domain assignment data is not connected for this Character.') +
                        '</span><a href="' + rules + '" class="space-hud-acquire">Read Domain rules</a>') +
            '</article>';
        }).join('') + '</div><p class="space-hud-data-note">' +
            (data.connected ? 'Domain records are scoped to this Character and Zailister.' : 'Domain and server records are not connected in this preview.') +
        '</p>';
    }
    function campaignDomainsMarkup(query) {
        var data = domainRecords(), q = String(query || '').trim().toLowerCase();
        var matches = data.campaigns.filter(function(item) {
            return !q || (String(item.name || '') + ' ' + String(item.path || '') + ' ' + String(item.campaignName || '')).toLowerCase().indexOf(q) !== -1;
        });
        if (!matches.length) {
            var message = data.connected
                ? 'No other authorized Domains are available to this Character on this game server.'
                : 'Readied Character, game-server, and Domain authorization data are not connected. Global Domain browsing is disabled.';
            return '<p class="space-hud-domain-empty">' + esc(message) + '</p>';
        }
        return matches.map(function(item) {
            var id = domainId(item);
            var contents = '<strong>' + esc(item.name || 'Domain') + '</strong><span>' + esc(item.path || '') + '</span>' +
                '<small>' + esc(item.campaignName || 'Authorized shared Domain') + '</small>';
            return id
                ? '<button type="button" class="space-hud-campaign-domain" data-space-domain-id="' + esc(id) + '">' + contents + '</button>'
                : '<article class="space-hud-campaign-domain">' + contents + '</article>';
        }).join('');
    }
    function mapMarker(point, level) {
        var isPoi = level === 'nivis';
        var action = level === 'planet' && point.level
            ? 'window.setSpaceHudLevel(\'nivis\')'
            : level === 'nivis' && point.level
                ? 'window.selectSpaceHudPoint(' + point.id + ')'
                : level === 'nivis'
                    ? 'window.selectSpaceHudPoint(' + point.id + ')'
                    : 'window.selectSpaceHudPlace(\'' + esc(point.name) + '\',' + point.x + ',' + point.y + ')';
        var label = isPoi
            ? '<text class="hud-marker-number" text-anchor="middle" y="5">' + point.id + '</text>'
            : '<text class="hud-marker-label" x="18" y="5">' + esc(point.name) + '</text>';
        return '<g class="hud-map-marker ' + (isPoi ? 'poi' : '') + (point.level ? ' drilldown' : '') + '" transform="translate(' + point.x + ' ' + point.y + ')" tabindex="0" role="button" aria-label="' + esc(point.name) + '" onclick="' + action + '">' +
            '<circle class="hud-marker-halo" r="' + (isPoi ? 17 : 10) + '"/>' + label + '<title>' + esc(point.name) + '</title></g>';
    }
    function overlaySvg(level) {
        var map = MAPS[level];
        var markers = map.points.map(function(point) { return mapMarker(point, level); }).join('');
        var data = domainRecords();
        var allDomains = data.personal.concat(data.campaigns);
        var domains = allDomains.filter(function(item) {
            return item.mapLevel === level && hasMapCoordinates(item);
        }).map(function(item) {
            var id = domainId(item);
            var selected = id && id === selectedDomainId ? ' is-selected' : '';
            var action = id
                ? ' data-space-domain-id="' + esc(id) + '" tabindex="0" role="button"'
                : '';
            return '<g class="hud-domain-marker' + selected + '"' + action + ' transform="translate(' + Number(item.mapX) + ' ' + Number(item.mapY) + ')" aria-label="' + esc(item.name || 'Domain') + '">' +
                '<circle r="13"/><text x="18" y="5">' + esc(item.name || 'Domain') + '</text></g>';
        }).join('');
        var contents = allDomains.reduce(function(html, domain) {
            return html + domainContents(domain).filter(function(item) {
                return item.mapLevel === level && Number.isFinite(Number(item.mapX)) && Number.isFinite(Number(item.mapY));
            }).map(function(item) {
                return '<g class="hud-content-marker" transform="translate(' + Number(item.mapX) + ' ' + Number(item.mapY) + ')" aria-label="' + esc(item.name || 'Domain contents') + '">' +
                    '<path d="M0 -10 10 0 0 10 -10 0Z"/><text x="15" y="5">' + esc(item.name || 'Contents') + '</text></g>';
            }).join('');
        }, '');
        var position = characterPosition();
        var portrait = characterPortrait(selectedCharacter(lastRenderArgs.user || {}));
        var you = position && position.mapLevel === level && hasMapCoordinates(position)
            ? '<g class="hud-user-position' + (portrait ? ' has-portrait' : '') + '" transform="translate(' + Number(position.mapX) + ' ' + Number(position.mapY) + ')" aria-label="Readied Character position">' +
                '<circle class="hud-user-marker-base" r="18"/><path class="hud-user-marker-cross" d="M-7 0h14M0-7v14"/>' +
                (portrait ? '<image class="hud-user-portrait" href="' + esc(portrait) + '" x="-16" y="-16" width="32" height="32" clip-path="url(#spaceHudPortraitClip)" preserveAspectRatio="xMidYMid slice"/>' : '') +
                '<text x="23" y="5">YOU</text></g>'
            : '';
        return '<svg class="space-hud-map-overlay" viewBox="' + map.viewBox + '" preserveAspectRatio="none" aria-label="Map places, Domain markers, and Character position">' +
            '<defs><clipPath id="spaceHudPortraitClip"><circle r="16"/></clipPath></defs>' + markers + domains + contents + you + '</svg>';
    }
    function mapLocationsList() {
        var points = MAPS[currentLevel].points;
        if (currentLevel === 'nivis') {
            return '<ol class="space-hud-poi-list">' + points.map(function(point) {
                return '<li><button type="button" onclick="window.selectSpaceHudPoint(' + point.id + ')"><span>' + point.id + '</span>' + esc(point.name) + '</button></li>';
            }).join('') + '</ol>';
        }
        return '<ul class="space-hud-place-list">' + points.map(function(point) {
            var action = currentLevel === 'planet' && point.level
                ? 'window.setSpaceHudLevel(\'nivis\')'
                : currentLevel === 'valley'
                    ? 'window.selectSpaceHudValleyPoint(\'' + point.id + '\')'
                    : 'window.selectSpaceHudPlace(\'' + esc(point.name) + '\',' + point.x + ',' + point.y + ')';
            return '<li><button type="button" onclick="' + action + '">' + esc(point.name) + '</button></li>';
        }).join('') + '</ul>';
    }
    function icon(tabId) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[tabId] || ICONS.overview) + '</svg>';
    }
    function tabIcons(tabs, isWanderer) {
        var allowed = (Array.isArray(tabs) ? tabs : []).filter(function(tab) {
            return !isWanderer || tab.access === 'PUBLIC';
        });
        return '<nav class="space-hud-tab-icons" aria-label="Haven pages">' + allowed.map(function(tab) {
            return '<button type="button" class="space-hud-tab-icon" onclick="switchTab(\'' + esc(tab.id) + '\')" aria-label="Open ' + esc(tab.label) + '">' +
                '<span class="space-hud-tab-icon-art">' + icon(tab.id) + '</span><small>' + esc(tab.label) + '</small></button>';
        }).join('') + '</nav>';
    }
    function characterSelectorMarkup() {
        var source = hudData();
        var activeServerId = serverId(source);
        var characters = readiedCharacters();
        if (!source || !activeServerId) {
            return '<div class="space-hud-character-state"><strong>Readied Character</strong><small>Same-server readiness data is not connected. Character markers are not shown.</small></div>';
        }
        if (!characters.length) {
            return '<div class="space-hud-character-state"><strong>Readied Character</strong><small>No Readied Characters are available on this game server.</small></div>';
        }
        var selectedId = characterId(lastRenderArgs.user || {});
        if (characters.length === 1) {
            var only = characters[0];
            return '<div class="space-hud-character-state"><strong>Readied Character</strong><small>' +
                esc(only.name || only.characterName || only.displayName || 'Character') + ' · same game server</small></div>';
        }
        return '<label class="space-hud-character-select-label" for="spaceHudCharacterSelect">Readied Character' +
            '<select id="spaceHudCharacterSelect"><option value="">Choose a Character</option>' +
            characters.map(function(record) {
                var id = recordCharacterId(record);
                var name = record.name || record.characterName || record.displayName || 'Character';
                return '<option value="' + esc(id) + '"' + (id === selectedId ? ' selected' : '') + '>' + esc(name) + '</option>';
            }).join('') + '</select><small>Only Readied Characters on this game server are listed.</small></label>';
    }
    function mapPanel() {
        if (currentLevel === 'universe') return universeView();
        if (currentLevel === 'solar') {
            return '<div class="space-hud-solar-viewport" id="spaceHudMapViewport">' + solarSystem() + '</div>';
        }
        var map = MAPS[currentLevel];
        return '<div class="space-hud-map-viewport" id="spaceHudMapViewport" style="--map-ratio:' + map.ratio + '">' +
            '<div class="space-hud-map-world" id="spaceHudMapWorld"><img class="space-hud-map-image" src="' + map.image + '" alt="' + esc(map.name) + '" draggable="false" />' + overlaySvg(currentLevel) + '</div>' +
            '<div class="space-hud-map-readout" id="spaceHudMapReadout">Map grid coordinates · select a marker</div>' +
            '<div class="space-hud-close-range" id="spaceHudCloseRange" hidden>ISOMETRIC CLOSE VIEW · FEW HUNDRED FEET</div></div>';
    }
    function renderSpaceHud(user, isPro, isWanderer, tabs) {
        lastRenderArgs = { user:user || {}, isPro:!!isPro, isWanderer:!!isWanderer, tabs:Array.isArray(tabs) ? tabs : [] };
        var candidates = readiedCharacters();
        var preferences = [];
        if (user && (user.active_character_id || user.activeCharacterId || user.characterId)) {
            preferences.push(String(user.active_character_id || user.activeCharacterId || user.characterId));
        }
        try {
            if (window.SORCPropertyInventory && typeof window.SORCPropertyInventory.characterId === 'function') {
                preferences.push(String(window.SORCPropertyInventory.characterId() || ''));
            }
        } catch(e) {}
        if (selectedCharacterId) preferences.push(selectedCharacterId);
        var selected = null;
        preferences.some(function(id) {
            selected = candidates.find(function(record) { return recordCharacterId(record) === id; }) || null;
            return !!selected;
        });
        if (!selected && candidates.length === 1) selected = candidates[0];
        var nextCharacterId = recordCharacterId(selected);
        if (nextCharacterId !== selectedCharacterId) selectedDomainId = '';
        selectedCharacterId = nextCharacterId;
        var title = currentLevel === 'universe' ? 'Universe' : currentLevel === 'solar' ? 'Solar system' : MAPS[currentLevel].name;
        var domainData = domainRecords();
        var canReturnToDomain = domainData.personal.some(hasMapCoordinates);
        var crumb = function(level, label) {
            return '<button type="button" class="' + (currentLevel === level ? 'active' : '') + '" onclick="window.setSpaceHudLevel(\'' + level + '\')">' + label + '</button>';
        };
        return '<main class="space-hud" data-space-hud>' +
            '<header class="space-hud-heading"><div><span class="space-hud-eyebrow">HAVEN · 2D MAP</span><h2>Haven</h2><p>Explore the globe and regional maps, then open existing Haven pages.</p></div><div class="space-hud-server-badge"><span></span>Same game server required</div></header>' +
            '<section class="space-hud-page-navigation"><span class="space-hud-eyebrow">HAVEN PAGES</span>' + tabIcons(lastRenderArgs.tabs, !!isWanderer) + '</section>' +
            '<section class="space-hud-planet-panel"><div class="space-hud-section-title"><h3>Planets</h3><span>Zailister is highlighted; every other planet and moon is dimmed.</span></div>' + planetSelector() + '</section>' +
            '<div class="space-hud-main-grid"><section class="space-hud-map-column"><div class="space-hud-map-panel">' +
                '<div class="space-hud-map-toolbar"><div class="space-hud-breadcrumb">' + crumb('universe','Universe') + '<span>›</span>' + crumb('solar','System') + '<span>›</span>' + crumb('planet','Zailister') + '<span>›</span>' + crumb('nivis','Nivis') + '<span>›</span>' + crumb('valley','Hold’s Keep Valley') + '</div>' +
                    '<div class="space-hud-zoom-controls"><button type="button" onclick="window.zoomSpaceHudMap(-1)" aria-label="Zoom out">−</button><span id="spaceHudZoomValue">100%</span><button type="button" onclick="window.zoomSpaceHudMap(1)" aria-label="Zoom in">+</button><button type="button" onclick="window.resetSpaceHudMap()">Reset</button><button type="button" class="space-hud-return-domain" onclick="window.returnToOwnSpaceHudDomain()"' + (canReturnToDomain ? '' : ' disabled title="This Character has no recorded Domain coordinates."') + '>Return to Domain</button></div></div>' +
                mapPanel() + '<div class="space-hud-map-caption"><span>' + esc(title) + '</span><span>' +
                    (currentLevel === 'universe' ? 'Recorded systems only' : currentLevel === 'solar' ? 'Planetary globes · Adoria and Tawdry Dwarf' : currentLevel === 'nivis' ? 'Reference scale shown: 0–300 miles' : currentLevel === 'valley' ? 'Isometric regional atlas · close-range view' : 'Planetary atlas') +
                '</span></div></div>' +
                ((currentLevel === 'solar' || currentLevel === 'universe') ? '' : '<section class="space-hud-poi-panel"><div class="space-hud-section-title"><h3>' + (currentLevel === 'nivis' ? 'Points of Interest' : 'Map Locations') + '</h3><span id="spaceHudSelectedPlace">Select a place</span></div>' + mapLocationsList() + '</section>') +
            '</section><aside class="space-hud-domain-panel"><div class="space-hud-domain-heading"><span class="space-hud-eyebrow">CHARACTER DOMAIN</span><h3>Domain</h3><p>Domain capacity follows the Basic and Pro membership rules.</p></div>' +
                characterSelectorMarkup() +
                '<div class="space-hud-account-cap">' + (lastRenderArgs.isPro ? 'PRO · up to 3 Domains' : 'BASIC · 1 Domain') + '</div>' + domainSlots() +
                '<div class="space-hud-marker-legend"><strong>Map markers</strong><span><i class="domain-mark"></i>Domain</span><span><i class="content-mark"></i>Contents</span><span><i class="position-mark"></i>You</span><small>Markers need recorded map coordinates at the displayed level.</small></div>' +
                '<section class="space-hud-campaigns"><div class="space-hud-section-title"><h4>Shared Domains</h4><small>' + esc(domainData.serverLabel) + '</small></div>' +
                    '<label for="spaceHudDomainSearch">Search authorized Domains</label><input id="spaceHudDomainSearch" type="search" placeholder="Search authorized Domains" autocomplete="off" />' +
                    '<div id="spaceHudCampaignDomains" aria-live="polite">' + campaignDomainsMarkup('') + '</div>' +
                    '<p class="space-hud-campaign-scope">Only Domains authorized for this Character on the same game server can appear. There is no global Domain directory.</p></section>' +
                '</aside></div></main>';
    }
    function rerender() {
        var panel = document.getElementById('tab-hud-z');
        if (!panel) return;
        panel.innerHTML = renderSpaceHud(lastRenderArgs.user, lastRenderArgs.isPro, lastRenderArgs.isWanderer, lastRenderArgs.tabs);
        bindSpaceHud();
    }
    function transition(level) {
        currentLevel = level;
        zoom = 1; translateX = 0; translateY = 0;
        rerender();
    }
    function applyTransform() {
        var viewport = document.getElementById('spaceHudMapViewport');
        var world = document.getElementById('spaceHudMapWorld');
        if (!viewport || !world) return;
        var rect = viewport.getBoundingClientRect();
        if (zoom < 1) {
            translateX = rect.width * (1 - zoom) / 2;
            translateY = rect.height * (1 - zoom) / 2;
        } else {
            translateX = Math.max(rect.width * (1 - zoom), Math.min(0, translateX));
            translateY = Math.max(rect.height * (1 - zoom), Math.min(0, translateY));
        }
        var closeRange = currentLevel === 'valley' && zoom >= 2.6;
        world.style.transform = 'translate(' + translateX + 'px,' + translateY + 'px) scale(' + zoom + ')' +
            (closeRange ? ' perspective(1200px) rotateX(4deg)' : '');
        var label = document.getElementById('spaceHudZoomValue');
        if (label) label.textContent = Math.round(zoom * 100) + '%';
        var close = document.getElementById('spaceHudCloseRange');
        if (close) close.hidden = !closeRange;
        var viewportClass = document.getElementById('spaceHudMapViewport');
        if (viewportClass) viewportClass.classList.toggle('isometric-close', closeRange);
        var userMarker = document.querySelector('#spaceHudMapWorld .hud-user-position');
        if (userMarker) {
            userMarker.classList.toggle('is-distant', zoom < 1.25);
            userMarker.classList.toggle('is-close', zoom >= 2.6);
        }
    }
    function zoomAt(next, clientX, clientY, direction) {
        if (currentLevel === 'universe') {
            if (direction > 0) transition('solar');
            return;
        }
        if (currentLevel === 'solar') {
            if (direction > 0) transition('planet');
            else transition('universe');
            return;
        }
        var minZoom = .62;
        if (next < minZoom) {
            transition(currentLevel === 'valley' ? 'nivis' : currentLevel === 'nivis' ? 'planet' : 'solar');
            return;
        }
        var viewport = document.getElementById('spaceHudMapViewport');
        if (!viewport) return;
        var rect = viewport.getBoundingClientRect();
        var px = clientX - rect.left, py = clientY - rect.top;
        var mapX = (px - translateX) / zoom, mapY = (py - translateY) / zoom;
        zoom = Math.max(minZoom, Math.min(4, next));
        translateX = px - mapX * zoom;
        translateY = py - mapY * zoom;
        applyTransform();
    }
    function bindMap(viewport) {
        if (!viewport || viewport.dataset.bound === 'true') return;
        viewport.dataset.bound = 'true';
        viewport.addEventListener('wheel', function(event) {
            event.preventDefault();
            var direction = event.deltaY < 0 ? 1 : -1;
            zoomAt(zoom * (direction > 0 ? 1.14 : .88), event.clientX, event.clientY, direction);
        }, { passive:false });
        viewport.addEventListener('pointerdown', function(event) {
            if (event.target.closest('button') || event.target.closest('[role="button"]')) return;
            viewport.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
            if (pointers.size === 1) drag = { x:event.clientX, y:event.clientY, tx:translateX, ty:translateY };
            if (pointers.size === 2) {
                var pair = Array.from(pointers.values());
                pinch = { distance:Math.hypot(pair[0].x-pair[1].x, pair[0].y-pair[1].y), zoom:zoom };
                drag = null;
            }
        });
        viewport.addEventListener('pointermove', function(event) {
            if (!pointers.has(event.pointerId)) return;
            pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
            if (pointers.size > 1 && pinch) {
                var p = Array.from(pointers.values()).slice(0, 2);
                var cx = (p[0].x+p[1].x)/2, cy = (p[0].y+p[1].y)/2;
                zoomAt(pinch.zoom * Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y) / Math.max(1, pinch.distance), cx, cy,
                    Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y) > pinch.distance ? 1 : -1);
            } else if (drag && zoom > 1) {
                translateX = drag.tx + event.clientX - drag.x;
                translateY = drag.ty + event.clientY - drag.y;
                applyTransform();
            }
        });
        function end(event) {
            pointers.delete(event.pointerId);
            if (pointers.size < 2) pinch = null;
            if (!pointers.size) drag = null;
            else {
                var p = Array.from(pointers.values())[0];
                drag = { x:p.x, y:p.y, tx:translateX, ty:translateY };
            }
        }
        viewport.addEventListener('pointerup', end);
        viewport.addEventListener('pointercancel', end);
        viewport.addEventListener('lostpointercapture', end);
    }
    function bindSpaceHud() {
        var root = document.querySelector('#tab-hud-z .space-hud');
        if (!root || root.dataset.bound === 'true') return;
        root.dataset.bound = 'true';
        bindMap(root.querySelector('#spaceHudMapViewport'));
        root.addEventListener('click', function(event) {
            var domainControl = event.target.closest('[data-space-domain-id]');
            if (domainControl && root.contains(domainControl)) {
                window.selectSpaceHudDomain(domainControl.getAttribute('data-space-domain-id'));
            }
        });
        root.addEventListener('keydown', function(event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            var domainMarker = event.target.closest('g[data-space-domain-id]');
            if (!domainMarker || !root.contains(domainMarker)) return;
            event.preventDefault();
            window.selectSpaceHudDomain(domainMarker.getAttribute('data-space-domain-id'));
        });
        var characterSelect = root.querySelector('#spaceHudCharacterSelect');
        if (characterSelect) characterSelect.addEventListener('change', function() {
            selectedCharacterId = characterSelect.value;
            selectedDomainId = '';
            rerender();
        });
        var search = root.querySelector('#spaceHudDomainSearch');
        if (search) search.addEventListener('input', function() {
            var results = root.querySelector('#spaceHudCampaignDomains');
            if (results) results.innerHTML = campaignDomainsMarkup(search.value);
        });
        applyTransform();
    }
    function updateReadout(name, x, y) {
        var readout = document.getElementById('spaceHudMapReadout');
        var selected = document.getElementById('spaceHudSelectedPlace');
        if (readout) readout.textContent = x == null || y == null
            ? String(name || 'Map coordinates are not recorded.')
            : 'Map grid coordinates · X ' + x + ' · Y ' + y;
        if (selected) selected.textContent = name;
    }
    function focusDomain(item) {
        if (!item) return;
        selectedDomainId = domainId(item);
        if (!hasMapCoordinates(item)) {
            rerender();
            updateReadout((item.name || 'Domain') + ' · map coordinates are not recorded.', null, null);
            return;
        }
        if (currentLevel !== item.mapLevel) transition(item.mapLevel);
        else rerender();
        var viewport = document.getElementById('spaceHudMapViewport');
        if (!viewport) {
            updateReadout(item.name || 'Domain', item.mapX, item.mapY);
            return;
        }
        var rect = viewport.getBoundingClientRect();
        var dimensions = MAPS[item.mapLevel].viewBox.split(' ').map(Number);
        zoom = Math.max(1.55, zoom);
        translateX = rect.width / 2 - Number(item.mapX) / dimensions[2] * rect.width * zoom;
        translateY = rect.height / 2 - Number(item.mapY) / dimensions[3] * rect.height * zoom;
        applyTransform();
        updateReadout(item.name || 'Domain', item.mapX, item.mapY);
    }
    window.renderSpaceHud = renderSpaceHud;
    window.bindSpaceHud = bindSpaceHud;
    window.setSpaceHudLevel = function(level) {
        if (level === 'universe' || level === 'solar' || MAPS[level]) transition(level);
    };
    window.selectSpaceHudPoint = function(id) {
        var point = NIVIS_POINTS.find(function(item) { return item.id === Number(id); });
        if (!point) return;
        if (point.level) { transition(point.level); return; }
        updateReadout(point.name, point.x, point.y);
    };
    window.selectSpaceHudPlace = function(name, x, y) { updateReadout(name, x, y); };
    window.selectSpaceHudValleyPoint = function(id) {
        var point = VALLEY_PLACES.find(function(item) { return item.id === id; });
        if (point) updateReadout(point.name, point.x, point.y);
    };
    window.zoomSpaceHudMap = function(direction) {
        var viewport = document.getElementById('spaceHudMapViewport');
        if (!viewport) return;
        if (currentLevel === 'universe') { if (direction > 0) transition('solar'); return; }
        if (currentLevel === 'solar') {
            transition(direction > 0 ? 'planet' : 'universe');
            return;
        }
        var rect = viewport.getBoundingClientRect();
        zoomAt(zoom * (direction > 0 ? 1.25 : .8), rect.left + rect.width/2, rect.top + rect.height/2, direction);
    };
    window.resetSpaceHudMap = function() {
        zoom = 1; translateX = 0; translateY = 0;
        if (currentLevel === 'solar') transition('solar');
        else applyTransform();
    };
    window.selectSpaceHudDomain = function(id) {
        var data = domainRecords();
        var item = data.personal.concat(data.campaigns).find(function(domain) { return domainId(domain) === String(id); });
        if (item) focusDomain(item);
    };
    window.returnToOwnSpaceHudDomain = function() {
        var item = domainRecords().personal.find(hasMapCoordinates);
        if (!item) {
            updateReadout('This Character’s Domain has no recorded map coordinates.', null, null);
            return;
        }
        focusDomain(item);
    };
    window.refreshSpaceHud = rerender;
})();