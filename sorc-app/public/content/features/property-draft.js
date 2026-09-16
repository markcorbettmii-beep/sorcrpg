(function() {
    var cards = [
        { id:'character-sheet', type:'Character Cards', name:'Kaida Character Sheet', ref:'char-pg.A-001', summary:'Kaida, Level 30. The active Character profile and indexed statistics.', art:'', owned:true, worn:false },
        { id:'character-profile', type:'Character Cards', name:'Kaida Character Profile', ref:'char-pg.A-002', summary:'Kaida, Level 30. Identity, class, level, and current state.', art:'', owned:true, worn:false },
        { id:'character-stats', type:'Character Cards', name:'Stats Sheet', ref:'char-pg.A-003', summary:'Core scores and current tracked values.', art:'', owned:true, worn:false },
        { id:'character-placeholder-1', type:'Character Cards', name:'Progression Card', ref:'char-pg.A-004', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'character-placeholder-2', type:'Character Cards', name:'Talent Card', ref:'char-pg.A-005', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'companion-drake', type:'Companion Cards', name:'Guardian Drake', ref:'comp-pg.A-101', rank:'Divine', role:'Guardian', size:'Behemoth', race:'Drake', summary:'A Guardian Companion carried On Person.', art:'/content/character/assets/customizer/pickers/companions/companion-picker-drake.png', layerArt:'/content/character/assets/shared/companions/layers/high-res-drake.png', owned:true, worn:false },
        { id:'companion-weasel', type:'Companion Cards', name:'Pet Weasel', ref:'comp-pg.A-102', rank:'Rare', role:'Pet', size:'Small', race:'Weasel', summary:'A Pet Companion carried On Person.', art:'/content/character/assets/customizer/pickers/companions/companion-picker-weasel.png', layerArt:'/content/character/assets/shared/companions/layers/high-res-weas.png', owned:true, worn:false },
        { id:'companion-angelic', type:'Companion Cards', name:'Angelic', ref:'comp-pg.A-103', rank:'Legendary', role:'Angelic', size:'Tiny', race:'Angelic', summary:"An Angelic Companion that hovers at Kaida's shoulder.", art:'/content/character/assets/customizer/pickers/companions/companion-picker-angelic.png', layerArt:'/content/character/assets/shared/companions/layers/high-res-angelic.png', owned:true, worn:false },
        { id:'companion-common', type:'Companion Cards', name:'Anim. Compass', ref:'comp-pg.A-104', companionTop:'Anim. Compass', companionBottom:'LVL 30 Changeling', summary:'An Adult Companion carried On Person.', art:'/content/character/assets/customizer/pickers/companions/companion-picker-anim-compass.png', layerArt:'/content/character/assets/shared/companions/layers/high-res-anim-comp.png', owned:true, worn:false },
        { id:'companion-placeholder-2', type:'Companion Cards', name:'Goliath Companion', ref:'comp-pg.A-105', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'safe-haven-default', type:'Compass Safe Havens', name:'Default', ref:'haven-pg.A-400', summary:'The nearest Safe Haven to where the campaign began. Its map-area image is supplied by the current module.', art:'', safeHaven:'default', owned:true, worn:false },
        { id:'safe-haven-secret-glades', type:'Compass Safe Havens', name:'Secret Glades', ref:'haven-pg.A-401', summary:'Map-area location marked for the Animated Compass and selected as the current canvas background.', art:'/content/character/assets/shared/canvas/high-res-canvas-background.png', safeHaven:'secret-glades', owned:true, worn:false },
        { id:'item-pouch', type:'Item Cards', name:'Small Pouch', ref:'item-pg.A-201', summary:'Tiny container. One stack or small item slot.', art:'', owned:true, worn:false },
        { id:'item-potion', type:'Item Cards', name:'Potion Stack', ref:'item-pg.A-202', summary:'Stackable consumable. Stack cap is recorded on its Card.', art:'', owned:true, worn:false },
        { id:'item-tool', type:'Item Cards', name:'Field Tool', ref:'item-pg.A-203', summary:'A carried practical tool.', art:'', owned:true, worn:false },
        { id:'item-placeholder-1', type:'Item Cards', name:'Material Stack', ref:'item-pg.A-204', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'item-placeholder-2', type:'Item Cards', name:'Quest Item', ref:'item-pg.A-205', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'armor-core', type:'Armament Cards', name:'Leather Core Set', ref:'arm-pg.A-301', summary:'Cuirass, greaves, and pauldrons. Core Set: 4 slots.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-core.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-core-leathtaba3.png', owned:true, worn:true },
        { id:'armor-helm', type:'Armament Cards', name:'Leather Helm', ref:'arm-pg.A-302', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-helm.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-helm-leathtaba3.png_20260915_021632_0000.png', owned:true, worn:true },
        { id:'armor-gloves', type:'Armament Cards', name:'Leather Gloves', ref:'arm-pg.A-303', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-gloves.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-gloves-leathtaba3.png_20260915_021700_0000.png', owned:true, worn:true },
        { id:'armor-boots', type:'Armament Cards', name:'Leather Boots', ref:'arm-pg.A-304', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-boots.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-boots-leathtaba3.png_20260915_021749_0000.png', owned:true, worn:true },
        { id:'weapon-taw', type:'Armament Cards', name:'Dual-Wield TAW', ref:'arm-pg.A-305', summary:'Readied dual-wield TAW Armament.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-taw.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-dw-taw3.png_20260915_021606_0000.png', owned:true, worn:true },
        { id:'armament-placeholder', type:'Armament Cards', name:'Readied Armament', ref:'arm-pg.A-306', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false }
    ];
    var esc = function(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    var get = function(id) { return cards.filter(function(card) { return card.id === id; })[0]; };
    var art = function(card) { return card.art ? '<img src="' + esc(card.art) + '" alt="" loading="lazy" />' : '<span aria-hidden="true">&#9672;</span>'; };
    function companionMeta(card, position) {
        if (card.type !== 'Companion Cards') return '';
        var text = position === 'top'
            ? (card.companionTop || [card.rank, card.role].filter(Boolean).join(' · '))
            : (card.companionBottom || [card.size, card.race].filter(Boolean).join(' · '));
        return text ? '<span class="property-companion-card-meta property-companion-card-' + position + '">' + esc(text) + '</span>' : '';
    }
    function button(card, selected) {
        return '<button type="button" class="property-armory-card ' + (card.owned ? 'owned' : 'unowned') + (card.worn ? ' readied' : '') + (card.id === selected ? ' selected' : '') + '" data-property-card="' + esc(card.id) + '" data-property-name="' + esc(card.name + ' ' + card.ref + ' ' + card.summary) + '" onclick="selectPropertyCard(\'' + esc(card.id) + '\')" aria-pressed="' + (card.id === selected ? 'true' : 'false') + '">' +
            companionMeta(card, 'top') + '<span class="property-armory-card-art' + (card.art ? '' : ' placeholder') + '">' + art(card) + '</span>' + companionMeta(card, 'bottom') + '<span class="property-armory-card-name">' + esc(card.name) + '</span><span class="property-armory-card-ref">#' + esc(card.ref) + '</span><span class="property-armory-card-state">' + (card.owned ? (card.worn ? 'Readied' : 'Carried') : 'Not owned') + '</span></button>';
    }
    function indexItem(card, selected) {
        return '<button type="button" class="property-card-index-item' + (card.id === selected ? ' selected' : '') + (card.owned ? '' : ' unowned') + '" onclick="selectPropertyCard(\'' + esc(card.id) + '\')" aria-label="Open ' + esc(card.name) + '"><span class="property-card-index-name">' + esc(card.name) + '</span><span class="property-card-index-meta">' + esc(card.ref) + ' &middot; ' + (card.owned ? (card.worn ? 'Readied' : 'Carried') : 'Not owned') + '</span></button>';
    }
    var SAFE_HAVEN_ART = '/content/character/assets/shared/canvas/high-res-canvas-background.png';
    var SAFE_HAVENS = [{ id:'default', name:'Default', art:'' }, { id:'secret-glades', name:'Secret Glades', art:SAFE_HAVEN_ART }];
    function selectedSafeHaven() { var id = 'default'; try { id = localStorage.getItem('sorc.property.safeHaven') || id; } catch(e) {} return SAFE_HAVENS.filter(function(haven) { return haven.id === id; })[0] || SAFE_HAVENS[0]; }
    function safeHavenControl(haven) { return '<details class="property-safe-haven-control"><summary aria-label="Select Safe Haven">Safe Haven</summary><div class="property-safe-haven-options" role="listbox" aria-label="Safe Haven choices">' + SAFE_HAVENS.map(function(item) { return '<button type="button" class="property-safe-haven-option' + (item.id === haven.id ? ' selected' : '') + '" onclick="selectPropertySafeHaven(\'' + esc(item.id) + '\')" role="option" aria-selected="' + (item.id === haven.id ? 'true' : 'false') + '">' + esc(item.name) + '</button>'; }).join('') + '</div></details>'; }
    function isSelected(selected, id) { return Array.isArray(selected) ? selected.indexOf(id) !== -1 : selected === id; }
    function orbitPiece(card, selected) {
        if (!card || !card.art) return '';
        var companion = card.type === 'Companion Cards';
        var top = companion ? (card.companionTop || [card.rank, card.role].filter(Boolean).join(' · ')) : '';
        var bottom = companion ? (card.companionBottom || [card.size, card.race].filter(Boolean).join(' · ')) : '';
        return '<button type="button" class="property-orbit-piece ' + (companion ? 'property-companion-orbit-piece ' : '') + (isSelected(selected, card.id) ? 'property-highlighted' : 'property-subdued') + '" onclick="selectPropertyCard(\'' + esc(card.id) + '\')" aria-label="Open ' + esc(card.name) + '">' + (top ? '<span class="property-orbit-meta property-orbit-meta-top">' + esc(top) + '</span>' : '') + '<img src="' + esc(card.art) + '" alt="" />' + (bottom ? '<span class="property-orbit-meta property-orbit-meta-bottom">' + esc(bottom) + '</span>' : '') + '<span>' + esc(card.name) + '</span></button>';
    }
    function storedSelection(key, legacyKey, selected, type) { var raw = null; try { raw = localStorage.getItem(key); } catch(e) {} if (raw !== null) { try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch(e) {} if (raw === 'none') return []; return [raw]; } var legacy = ''; try { legacy = localStorage.getItem(legacyKey) || ''; } catch(e) {} if (legacy && legacy !== 'none') return [legacy]; return type === 'worn' ? ['armor-core'] : []; }
    function selectedArmament(selected) { return storedSelection('sorc.property.selectedArmaments', 'sorc.property.lastReadied', selected, 'worn'); }
    function selectedCompanion(selected) { return storedSelection('sorc.property.selectedCompanions', 'sorc.property.selectedCompanion', selected, 'type'); }
    var CHARACTER_PICKERS = [
        { id:'character-picker-basic-1', name:'Basic 1', art:'/content/character/assets/customizer/pickers/characters/character-picker-basic-1.png', tier:'basic' },
        { id:'character-picker-basic-2', name:'Basic 2', art:'/content/character/assets/customizer/pickers/characters/character-picker-basic-2.png', tier:'basic' },
        { id:'character-picker-pro-1', name:'Pro 1', art:'/content/character/assets/customizer/pickers/characters/character-picker-pro-1.png', tier:'pro' },
        { id:'character-picker-pro-2', name:'Pro 2', art:'/content/character/assets/customizer/pickers/characters/character-picker-pro-2.png', tier:'pro' },
        { id:'character-picker-pro-3', name:'Pro 3', art:'/content/character/assets/customizer/pickers/characters/character-picker-pro-3.png', tier:'pro' }
    ];
    function selectedCharacterPicker() { var id = ''; try { id = localStorage.getItem('sorc.property.characterPicker') || ''; } catch(e) {} return id === 'none' ? 'none' : (id || CHARACTER_PICKERS[0].id); }
    function characterPickerMarkup() {
        var selected = selectedCharacterPicker();
        return '<div class="property-character-picker"><div class="property-character-picker-tiers"><div class="property-character-picker-tier basic">Basic</div><div class="property-character-picker-tier pro">Pro</div></div><div class="property-character-picker-thumbs">' +
            CHARACTER_PICKERS.map(function(picker) { return '<button type="button" class="property-character-picker-thumb ' + picker.tier + ' ' + picker.id + (picker.id === selected ? ' selected' : '') + '" onclick="selectPropertyCharacterPicker(\'' + esc(picker.id) + '\')" aria-label="Select ' + esc(picker.name) + '" aria-pressed="' + (picker.id === selected ? 'true' : 'false') + '"><img src="' + esc(picker.art) + '" alt="' + esc(picker.name) + '" /></button>'; }).join('') +
        '</div></div>';
    }
    var CHARACTER_LAYER_SETS = {
        'character-picker-basic-1': [
            '/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png',
            '/content/character/assets/female/firstborn/human/faces/femface2-pale-grn.png',
            '/content/character/assets/female/firstborn/human/hair/femhair1.png'
        ],
        'character-picker-basic-2': [
            '/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png',
            '/content/character/assets/female/firstborn/human/faces/femface2-pale-grn.png',
            '/content/character/assets/female/firstborn/human/hair/femhair1.png'
        ],
        'character-picker-pro-1': [
            '/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png',
            '/content/character/assets/female/firstborn/human/faces/femface2-pale-grn.png',
            '/content/character/assets/female/firstborn/human/hair/femhair1.png'
        ],
        'character-picker-pro-2': [
            '/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png',
            '/content/character/assets/female/firstborn/human/faces/femface2-pale-grn.png',
            '/content/character/assets/female/firstborn/human/hair/femhair1.png'
        ],
        'character-picker-pro-3': [
            '/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png',
            '/content/character/assets/female/firstborn/human/faces/femface2-pale-grn.png',
            '/content/character/assets/female/firstborn/human/hair/femhair1.png'
        ]
    };
    function selectedCharacterLayers(selectedArmaments) {
        var selected = selectedCharacterPicker();
        if (selected === 'none') return [];
        var layers = CHARACTER_LAYER_SETS[selected] || CHARACTER_LAYER_SETS['character-picker-basic-1'];
        return selectedArmaments.indexOf('armor-core') !== -1 ? layers.slice(1) : layers;
    }
    function canvasLayer(card, className, index) {
        var src = card && (card.layerArt || card.art);
        if (!src) return '';
        return '<img class="property-canvas-layer ' + className + (index == null ? '' : ' property-canvas-layer-' + index) + '" src="' + esc(src) + '" alt="" aria-hidden="true" />';
    }
    function canvasLayers(selectedArmaments, selectedCompanions) {
        var armaments = selectedArmaments.map(function(id) { return get(id); }).filter(Boolean);
        var companions = selectedCompanions.map(function(id) { return get(id); }).filter(Boolean);
        return '<div class="property-canvas-layer-stack" aria-label="Selected canvas layers"><div class="property-canvas-composition">' +
            selectedCharacterLayers(selectedArmaments).map(function(src, index) { return '<img class="property-canvas-layer property-canvas-layer-character-' + index + '" src="' + src + '" alt="" aria-hidden="true" />'; }).join('') +
            companions.map(function(card) { return canvasLayer(card, 'property-canvas-layer-companion ' + card.id); }).join('') +
            armaments.map(function(card) { return canvasLayer(card, 'property-canvas-layer-armament ' + card.id); }).join('') +
        '</div></div>';
    }
    function canvas(selected) {
        var card = get(selected) || cards[0], haven = selectedSafeHaven(), highlightedArmament = selectedArmament(selected);
        var worn = cards.filter(function(c) { return c.worn && c.owned; });
        var companions = cards.filter(function(c) { return c.type === 'Companion Cards' && c.owned; }), highlightedCompanion = selectedCompanion(selected);
        var canvasBackground = haven.art ? ' style="background-image:url(\'' + esc(haven.art) + '\')"' : '';
        return '<section class="property-canvas"><div class="property-canvas-heading"><div class="property-canvas-heading-haven"><span>Haven</span><strong>' + esc(haven.name) + '</strong></div><div class="property-canvas-heading-title">Worn Armaments</div></div><div class="property-canvas-stage" aria-label="Kaida portrait with worn Armaments and Companions"' + canvasBackground + '>' + safeHavenControl(haven) + canvasLayers(highlightedArmament, highlightedCompanion) + '<div class="property-canvas-orbit worn">' + worn.map(function(c) { return orbitPiece(c, highlightedArmament); }).join('') + '</div><div class="property-canvas-orbit companions"><div class="property-canvas-orbit-title">Companions</div>' + companions.map(function(c) { return orbitPiece(c, highlightedCompanion); }).join('') + '</div></div><div class="property-canvas-caption"><strong>' + esc(card.name) + '</strong><span>' + (card.owned ? esc(card.summary) : 'You do not yet own this Card.') + '</span>' + characterPickerMarkup() + '<div class="property-canvas-stats"><span class="property-canvas-stat">#' + esc(card.ref) + '</span><span class="property-canvas-stat">' + (card.owned ? (card.worn ? 'Readied' : 'Carried') : 'Not owned') + '</span></div></div></section>';
    }
    function page(pageName, selected) {
        var nav = '<div class="property-page-nav" aria-label="Property pages"><button class="' + (pageName === 'on-person' ? 'active' : '') + '" onclick="selectPropertyPage(\'on-person\')">On Person</button><button class="future" onclick="selectPropertyPage(\'home\')">Home</button><button class="future" onclick="selectPropertyPage(\'guild\')">Guild &amp; Clan</button><button class="future" onclick="selectPropertyPage(\'rented\')">Rented Storage</button><button class="future" onclick="selectPropertyPage(\'stash\')">Stash</button></div>';
        if (pageName !== 'on-person') return nav + '<h4 class="property-page-title">' + esc(pageName === 'containers' ? 'Containers' : ({home:'Home',guild:'Guild and Clan',rented:'Rented Storage',stash:'Stash'}[pageName] || 'Property')) + '</h4><div class="property-container-page"><p class="property-container-note">This category has its own Property page and its own Card capacity. The visual Card index will be added after the On Person Armory draft is approved.</p></div>';
        var owned = cards.filter(function(card) { return card.owned; }), unowned = cards.filter(function(card) { return !card.owned; }).slice(0, 5);
        return nav + '<h4 class="property-page-title">On Person</h4><div class="property-draft-tools"><input class="property-draft-search" id="propertyDraftSearch" type="search" placeholder="Search Cards by name or ref #..." oninput="filterPropertyDraft(this.value)" /><span class="property-draft-cap">Five Cards per row &middot; &#187; for more</span></div><div id="propertySearchMessage" class="property-search-message" hidden></div><div class="property-armory-layout">' + canvas(selected) + '<aside class="property-card-index"><h4>Card Index</h4><p>Choose any Card. The center canvas keeps Kaida, her worn Armaments, her Companions, and her Safe Haven visible while the selected Card is marked.</p><div class="property-card-index-list" id="propertyCardIndex">' + owned.concat(unowned).map(function(card) { return indexItem(card, selected); }).join('') + '</div></aside></div>' + rows(selected) + '<section class="property-container-category"><div class="property-armory-row-head"><h4>Containers</h4><span>Storage carried On Person</span></div><div class="property-armory-row"><div class="property-armory-row-head"><h4>Companions</h4><span class="property-container-size">Tiny &middot; Small &middot; Standard &middot; Goliath</span></div><div class="property-card-row">' + ['Fellowship Companion','Pack Mule','Tiny Companion','Goliath Companion','Behemoth Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i < 2 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">container-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i < 2 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') + '</div></div><div class="property-armory-row"><div class="property-armory-row-head"><h4>Harnesses</h4><span class="property-container-size">Small</span></div><div class="property-card-row">' + ['Leather Harness','Pack Harness','Harness Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i === 0 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">harness-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i === 0 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') + '</div></div><div class="property-armory-row"><div class="property-armory-row-head"><h4>Wagons</h4><span class="property-container-size">Goliath</span></div><div class="property-card-row">' + ['Cargo Wagon','Wagon Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i === 0 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">wagon-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i === 0 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') + '</div></div></section>';
    }
    var rowPages = {};
    function rows(selected) {
        return '<div id="propertyDraftRows">' + ['Character Cards','Companion Cards','Compass Safe Havens','Item Cards','Armament Cards'].map(function(type) {
            var typeCards = cards.filter(function(card) { return card.type === type; }), pageSize = 5;
            var pageCount = Math.max(1, Math.ceil(typeCards.length / pageSize));
            var pageNumber = Math.min(rowPages[type] || 0, pageCount - 1);
            rowPages[type] = pageNumber;
            var controls = pageCount > 1
                ? '<div class="property-armory-row-controls"><button type="button" onclick="selectPropertyRowPage(\'' + esc(type) + '\', -1)' + (pageNumber === 0 ? ' disabled' : '') + ' aria-label="Previous ' + esc(type) + ' page">&#171;</button><span>' + (pageNumber + 1) + '/' + pageCount + '</span><button type="button" onclick="selectPropertyRowPage(\'' + esc(type) + '\', 1)" aria-label="Next ' + esc(type) + ' page">&#187;</button></div>'
                : '<span>5 Cards per page</span>';
            return '<section class="property-armory-row"><div class="property-armory-row-head"><h4>' + esc(type) + '</h4>' + controls + '</div><div class="property-card-row">' + typeCards.slice(pageNumber * pageSize, pageNumber * pageSize + pageSize).map(function(card) { return button(card, selected); }).join('') + '</div></section>';
        }).join('') + '</div>';
    }
    window.renderPropertyDraft = function() {
        var selected = 'armor-core'; try { selected = localStorage.getItem('sorc.property.lastReadied') || selected; } catch(e) {}
        return '<div class="property-draft" id="propertyDraft" data-selected="' + esc(selected) + '">' + page('on-person', selected) + '</div>';
    };
    window.selectPropertyPage = function(name) { var draft = document.getElementById('propertyDraft'); if (!draft) return; var selected = draft.getAttribute('data-selected') || 'armor-core'; draft.innerHTML = page(name, selected); };
    window.selectPropertyCard = function(id) { var card = get(id), draft = document.getElementById('propertyDraft'); if (!card || !draft) return; var previous = draft.getAttribute('data-selected') || 'armor-core'; draft.setAttribute('data-selected', id); try { if (card.worn && card.owned) { var armaments = selectedArmament(previous), armamentIndex = armaments.indexOf(id); if (armamentIndex === -1) armaments.push(id); else armaments.splice(armamentIndex, 1); localStorage.setItem('sorc.property.selectedArmaments', JSON.stringify(armaments)); } if (card.type === 'Companion Cards' && card.owned) { var companions = selectedCompanion(previous), companionIndex = companions.indexOf(id); if (companionIndex === -1) companions.push(id); else companions.splice(companionIndex, 1); localStorage.setItem('sorc.property.selectedCompanions', JSON.stringify(companions)); } if (card.safeHaven) localStorage.setItem('sorc.property.safeHaven', card.safeHaven); } catch(e) {} draft.innerHTML = page('on-person', id); };
    window.selectPropertyCharacterPicker = function(id) { var draft = document.getElementById('propertyDraft'); if (!draft) return; try { localStorage.setItem('sorc.property.characterPicker', selectedCharacterPicker() === id ? 'none' : id); } catch(e) {} draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'armor-core'); };
    window.selectPropertyRowPage = function(type, direction) { var draft = document.getElementById('propertyDraft'); if (!draft) return; var typeCards = cards.filter(function(card) { return card.type === type; }), pageCount = Math.max(1, Math.ceil(typeCards.length / 5)), pageNumber = rowPages[type] || 0; rowPages[type] = (pageNumber + direction + pageCount) % pageCount; draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'armor-core'); };
    window.selectPropertySafeHaven = function(id) { var draft = document.getElementById('propertyDraft'), haven = SAFE_HAVENS.filter(function(item) { return item.id === id; })[0]; if (!draft || !haven) return; try { localStorage.setItem('sorc.property.safeHaven', id); } catch(e) {} draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'character-sheet'); };
    window.filterPropertyDraft = function(query) {
        var q = String(query || '').trim().toLowerCase(), matches = cards.filter(function(card) { return !q || (card.name + ' ' + card.ref + ' ' + card.summary + ' ' + card.type).toLowerCase().indexOf(q) !== -1; });
        document.querySelectorAll('#propertyDraftRows .property-armory-card').forEach(function(button) { button.style.display = (!q || (button.getAttribute('data-property-name') || '').toLowerCase().indexOf(q) !== -1) ? '' : 'none'; });
        var index = document.getElementById('propertyCardIndex'); if (index) index.innerHTML = matches.filter(function(card) { return card.owned; }).concat(matches.filter(function(card) { return !card.owned; }).slice(0, 5)).map(function(card) { return indexItem(card, document.getElementById('propertyDraft').getAttribute('data-selected') || 'armor-core'); }).join('');
        var message = document.getElementById('propertySearchMessage'); if (message) { message.hidden = !q || matches.length > 0; message.textContent = matches.length ? '' : 'No Card matches that search. Try the Card name, its ref #, or a Card type such as Armament, Companion, or Item.'; }
    };
})();