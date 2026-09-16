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
        { id:'companion-common', type:'Companion Cards', name:'Anim. Compass', ref:'comp-pg.A-104', rank:'Common', companionTop:'Anim. Compass', companionBottom:'LVL 30 Changeling', summary:'An Adult Companion carried On Person.', art:'/content/character/assets/customizer/pickers/companions/companion-picker-anim-compass.png', layerArt:'/content/character/assets/shared/companions/layers/high-res-anim-comp.png', owned:true, worn:false },
        { id:'companion-placeholder-2', type:'Companion Cards', name:'Goliath Companion', ref:'comp-pg.A-105', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'safe-haven-default', type:'Compass Safe Havens', name:'Default', ref:'haven-pg.A-400', summary:'The nearest Safe Haven to where the campaign began. Its map-area image is supplied by the current module.', art:'', safeHaven:'default', owned:true, worn:false },
        { id:'safe-haven-secret-glades', type:'Compass Safe Havens', name:'Secret Glades', ref:'haven-pg.A-401', summary:'Map-area location marked for the Animated Compass and selected as the current canvas background.', art:'/content/character/assets/shared/canvas/high-res-canvas-background.png', safeHaven:'secret-glades', owned:true, worn:false },
        { id:'item-pouch', type:'Item Cards', name:'Small Pouch', ref:'item-pg.A-201', summary:'Tiny container. One stack or small item slot.', art:'', owned:true, worn:false },
        { id:'item-potion', type:'Item Cards', name:'Potion Stack', ref:'item-pg.A-202', summary:'Stackable consumable. Stack cap is recorded on its Card.', art:'', owned:true, worn:false },
        { id:'item-tool', type:'Item Cards', name:'Field Tool', ref:'item-pg.A-203', summary:'A carried practical tool.', art:'', owned:true, worn:false },
        { id:'item-placeholder-1', type:'Item Cards', name:'Material Stack', ref:'item-pg.A-204', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'item-placeholder-2', type:'Item Cards', name:'Quest Item', ref:'item-pg.A-205', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false },
        { id:'armor-core', type:'Armament Cards', name:'Leather Core Set', ref:'arm-pg.A-301', rank:'Legendary', summary:'Cuirass, greaves, and pauldrons. Core Set: 4 slots.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-core.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-core-leathtaba3.png', owned:true, worn:true },
        { id:'armor-helm', type:'Armament Cards', name:'Leather Helm', ref:'arm-pg.A-302', rank:'Legendary', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-helm.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-helm-leathtaba3.png_20260915_021632_0000.png', owned:true, worn:true },
        { id:'armor-gloves', type:'Armament Cards', name:'Leather Gloves', ref:'arm-pg.A-303', rank:'Legendary', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-gloves.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-gloves-leathtaba3.png_20260915_021700_0000.png', owned:true, worn:true },
        { id:'armor-boots', type:'Armament Cards', name:'Leather Boots', ref:'arm-pg.A-304', rank:'Legendary', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-boots.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-boots-leathtaba3.png_20260915_021749_0000.png', owned:true, worn:true },
        { id:'weapon-taw', type:'Armament Cards', name:'Dual-Wield TAW', ref:'arm-pg.A-305', rank:'Legendary', summary:'Readied dual-wield TAW Armament.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-taw.png?v=fit1', layerArt:'/content/character/assets/shared/equipment/layers/high-res-dw-taw3.png_20260915_021606_0000.png', owned:true, worn:true },
        { id:'armament-placeholder', type:'Armament Cards', name:'Readied Armament', ref:'arm-pg.A-306', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false }
    ];
    var esc = function(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    var get = function(id) { return cards.filter(function(card) { return card.id === id; })[0]; };
    var art = function(card) { return card.art ? '<img src="' + esc(card.art) + '" alt="" loading="lazy" />' : '<span aria-hidden="true">&#9672;</span>'; };
    function rankClass(item) { var rank = String(item && item.rank || '').toLowerCase().replace(/[^a-z]+/g, '-'); return rank ? ' property-rank-' + rank : ''; }
    function companionMeta(card, position) {
        if (card.type !== 'Companion Cards') return '';
        var text = position === 'top'
            ? (card.companionTop || [card.rank, card.role].filter(Boolean).join(' · '))
            : (card.companionBottom || [card.size, card.race].filter(Boolean).join(' · '));
        return text ? '<span class="property-companion-card-meta property-companion-card-' + position + '">' + esc(text) + '</span>' : '';
    }
    var propertyHoldTimer = null, suppressNextCompanionClick = false;
    function pickerInteraction(item, clickHandler) {
        return (clickHandler || '') + ' onpointerdown="startPropertyCardHold(event,\'' + esc(item.id) + '\')" onpointerup="endPropertyCardHold()" onpointercancel="cancelPropertyCardHold()" onpointerleave="cancelPropertyCardHold()" oncontextmenu="return false"';
    }
    function companionInteraction(card) {
        var clickHandler = card.type === 'Companion Cards'
            ? ' onclick="propertyCompanionTap(\'' + esc(card.id) + '\')"'
            : ' onclick="selectPropertyCard(\'' + esc(card.id) + '\')"';
        return pickerInteraction(card, clickHandler);
    }
    function button(card, selected) {
        return '<button type="button" class="property-armory-card' + rankClass(card) + ' ' + (card.owned ? 'owned' : 'unowned') + (card.worn ? ' readied' : '') + (card.id === selected ? ' selected' : '') + '" data-property-card="' + esc(card.id) + '" data-property-name="' + esc(card.name + ' ' + card.ref + ' ' + card.summary) + '"' + companionInteraction(card) + ' aria-pressed="' + (card.id === selected ? 'true' : 'false') + '">' +
            '<span class="property-armory-card-art' + (card.art ? '' : ' placeholder') + '">' + art(card) + '</span></button>';
    }
    function indexItem(card, selected) {
        return '<button type="button" class="property-card-index-item' + rankClass(card) + (card.id === selected ? ' selected' : '') + (card.owned ? '' : ' unowned') + '"' + companionInteraction(card) + ' aria-label="Open ' + esc(card.name) + '"><span class="property-card-index-name">' + esc(card.name) + '</span><span class="property-card-index-meta">' + esc(card.ref) + ' &middot; ' + (card.owned ? (card.worn ? 'Readied' : 'Carried') : 'Not owned') + '</span></button>';
    }
    var SAFE_HAVEN_ART = '/content/character/assets/shared/canvas/high-res-canvas-background.png';
    var SAFE_HAVENS = [{ id:'default', name:'Default', art:'' }, { id:'secret-glades', name:'Secret Glades', art:SAFE_HAVEN_ART }];
    function selectedSafeHaven() { var id = 'default'; try { id = localStorage.getItem('sorc.property.safeHaven') || id; } catch(e) {} return SAFE_HAVENS.filter(function(haven) { return haven.id === id; })[0] || SAFE_HAVENS[0]; }
    function safeHavenControl(haven) { return '<details class="property-safe-haven-control"><summary aria-label="Select Safe Haven">Safe Haven</summary><div class="property-safe-haven-options" role="listbox" aria-label="Safe Haven choices">' + SAFE_HAVENS.map(function(item) { return '<button type="button" class="property-safe-haven-option' + (item.id === haven.id ? ' selected' : '') + '" onclick="selectPropertySafeHaven(\'' + esc(item.id) + '\')" role="option" aria-selected="' + (item.id === haven.id ? 'true' : 'false') + '">' + esc(item.name) + '</button>'; }).join('') + '</div></details>'; }
    function isSelected(selected, id) { return Array.isArray(selected) ? selected.indexOf(id) !== -1 : selected === id; }
    function orbitPiece(card, selected) {
        if (!card || !card.art) return '';
        var companion = card.type === 'Companion Cards';
        return '<button type="button" class="property-orbit-piece' + rankClass(card) + ' ' + (isSelected(selected, card.id) ? 'property-highlighted' : 'property-subdued') + '"' + companionInteraction(card) + ' aria-label="Open ' + esc(card.name) + '"><img src="' + esc(card.art) + '" alt="" /></button>';
    }
    function storedSelection(key, legacyKey, selected, type) { var raw = null; try { raw = localStorage.getItem(key); } catch(e) {} if (raw !== null) { try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch(e) {} if (raw === 'none') return []; return [raw]; } var legacy = ''; try { legacy = localStorage.getItem(legacyKey) || ''; } catch(e) {} if (legacy && legacy !== 'none') return [legacy]; return type === 'worn' ? ['armor-core'] : []; }
    function selectedArmament(selected) { return storedSelection('sorc.property.selectedArmaments', 'sorc.property.lastReadied', selected, 'worn'); }
    function selectedCompanion(selected) { return storedSelection('sorc.property.selectedCompanions', 'sorc.property.selectedCompanion', selected, 'type'); }
    var CHARACTER_PICKERS = [
        { id:'character-picker-basic-1', name:'Kaida', art:'/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png_20260916_001443_0000.png', tier:'basic', available:true },
        { id:'character-picker-basic-2', name:'Male Muscular', art:'/content/character/assets/customizer/pickers/characters/character-picker-male-musc-silhouette.png?v=sheet-musc-2', tier:'basic', available:false },
        { id:'character-picker-pro-1', name:'Male Muscular', art:'/content/character/assets/customizer/pickers/characters/character-picker-male-musc-silhouette.png?v=sheet-musc-2', tier:'pro', available:false },
        { id:'character-picker-pro-2', name:'Male Muscular', art:'/content/character/assets/customizer/pickers/characters/character-picker-male-musc-silhouette.png?v=sheet-musc-2', tier:'pro', available:false },
        { id:'character-picker-pro-3', name:'Male Muscular', art:'/content/character/assets/customizer/pickers/characters/character-picker-male-musc-silhouette.png?v=sheet-musc-2', tier:'pro', available:false }
    ];
    function selectedCharacterPicker() {
        var id = '';
        try { id = localStorage.getItem('sorc.property.characterPicker') || ''; } catch(e) {}
        return CHARACTER_PICKERS.some(function(picker) { return picker.available && picker.id === id; }) ? id : CHARACTER_PICKERS[0].id;
    }
    function characterPickerMarkup() {
        var selected = selectedCharacterPicker();
        return '<div class="property-character-picker"><div class="property-character-picker-tiers"><div class="property-character-picker-tier basic">Basic</div><div class="property-character-picker-tier pro">Pro</div></div><div class="property-character-picker-thumbs">' +
            CHARACTER_PICKERS.map(function(picker) {
                var disabled = picker.available ? '' : ' unavailable';
                var interaction = pickerInteraction(picker, picker.available ? ' onclick="selectPropertyCharacterPicker(\'' + esc(picker.id) + '\')" aria-pressed="' + (picker.id === selected ? 'true' : 'false') + '"' : ' aria-disabled="true"');
                var pickerImage = picker.available ? '<img src="' + esc(picker.art) + '" alt="' + esc(picker.name) + '" />' : '';
                return '<button type="button" class="property-character-picker-thumb ' + picker.tier + disabled + ' ' + picker.id + (picker.id === selected ? ' selected' : '') + '"' + interaction + ' aria-label="' + esc(picker.name) + (picker.available ? '' : ' (not available)') + '">' + pickerImage + '</button>';
            }).join('') +
        '</div></div>';
    }
    var CHARACTER_LAYER_SETS = {
        'character-picker-basic-1': [
            '/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png_20260916_001443_0000.png'
        ]
    };
    function selectedCharacterLayers(selectedArmaments) {
        var selected = selectedCharacterPicker();
        if (selected === 'none') return [];
        var layers = CHARACTER_LAYER_SETS[selected] || CHARACTER_LAYER_SETS['character-picker-basic-1'];
        return layers;
    }
    function canvasLayer(card, className, index) {
        var src = card && (card.layerArt || card.art);
        if (!src) return '';
        return '<img class="property-canvas-layer ' + className + (index == null ? '' : ' property-canvas-layer-' + index) + '" src="' + esc(src) + '" alt="" aria-hidden="true" />';
    }
    var ARMAMENT_LAYER_ORDER = { 'armor-boots': 1, 'armor-core': 2, 'armor-gloves': 3, 'weapon-taw': 4, 'armor-helm': 5 };
    function canvasLayers(selectedArmaments, selectedCompanions) {
        var armaments = selectedArmaments.map(function(id) { return get(id); }).filter(Boolean);
        armaments.sort(function(a, b) {
            var aOrder = ARMAMENT_LAYER_ORDER[a.id] || 99, bOrder = ARMAMENT_LAYER_ORDER[b.id] || 99;
            return aOrder - bOrder;
        });
        var companions = selectedCompanions.map(function(id) { return get(id); }).filter(Boolean);
        return '<div class="property-canvas-layer-stack" aria-label="Selected canvas layers"><div class="property-canvas-composition">' +
            selectedCharacterLayers(selectedArmaments).map(function(src, index) { return '<img class="property-canvas-layer property-canvas-layer-character-' + index + '" src="' + src + '" alt="" aria-hidden="true" />'; }).join('') +
            companions.map(function(card) { return canvasLayer(card, 'property-canvas-layer-companion ' + card.id); }).join('') +
            armaments.map(function(card) { return canvasLayer(card, 'property-canvas-layer-armament ' + card.id); }).join('') +
        '</div></div>';
    }
    function canvas(selected) {
        var haven = selectedSafeHaven(), highlightedArmament = selectedArmament(selected);
        var worn = cards.filter(function(c) { return c.worn && c.owned; });
        var companions = cards.filter(function(c) { return c.type === 'Companion Cards' && c.owned; }), highlightedCompanion = selectedCompanion(selected);
        var canvasBackground = haven.art ? ' style="background-image:url(\'' + esc(haven.art) + '\')"' : '';
        return '<section class="property-canvas">' +
            '<div class="property-canvas-pickers property-canvas-pickers-top"><div class="property-canvas-picker-title">Worn Armaments</div><div class="property-canvas-orbit worn">' + worn.map(function(c) { return orbitPiece(c, highlightedArmament); }).join('') + '</div></div>' +
            '<div class="property-canvas-stage" aria-label="Kaida portrait with worn Armaments and Companions"' + canvasBackground + '>' +
                safeHavenControl(haven) +
                canvasLayers(highlightedArmament, highlightedCompanion) +
            '</div>' +
            '<div class="property-canvas-pickers property-canvas-pickers-bottom"><div class="property-canvas-orbit companions">' + companions.map(function(c) { return orbitPiece(c, highlightedCompanion); }).join('') + '</div><div class="property-companion-instruction">select or long press to view Card</div></div>' +
            '<div class="property-canvas-caption">' + characterPickerMarkup() + '</div>' +
        '</section>';
    }
    function haulingSection() {
        return '<section class="property-container-category"><div class="property-armory-row-head"><h4>Hauling</h4><span>Companions and wagons</span></div>' +
            '<div class="property-armory-row"><div class="property-armory-row-head"><h4>Companions</h4><span class="property-container-size">Tiny &middot; Small &middot; Standard &middot; Goliath</span></div><div class="property-card-row">' +
            ['Fellowship Companion','Pack Mule','Tiny Companion','Goliath Companion','Behemoth Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i < 2 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">container-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i < 2 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') +
            '</div></div><div class="property-armory-row"><div class="property-armory-row-head"><h4>Wagons</h4><span class="property-container-size">Goliath</span></div><div class="property-card-row">' +
            ['Cargo Wagon','Wagon Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i === 0 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">wagon-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i === 0 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') +
            '</div></div></section>';
    }
    function page(pageName, selected) {
        var nav = '<div class="property-page-nav" aria-label="Property pages"><button class="' + (pageName === 'on-person' ? 'active' : '') + '" onclick="selectPropertyPage(\'on-person\')">On Person</button><button class="future" onclick="selectPropertyPage(\'home\')">Home</button><button class="future" onclick="selectPropertyPage(\'guild\')">Guild &amp; Clan</button><button class="future" onclick="selectPropertyPage(\'rented\')">Rented Storage</button><button class="future" onclick="selectPropertyPage(\'ordnance\')">Ordnance Berth</button><button class="future" onclick="selectPropertyPage(\'stash\')">Stash</button></div>';
        var pageTitles = { home:'Home', guild:'Guild and Clan', rented:'Rented Storage', ordnance:'Ordnance Berth', stash:'Stash' };
        var pageDescriptions = {
            home: "The Character's Armory, Safes, Closets, Companion Quarters, Deployments, and Trophy Room Items.",
            guild: 'Storage, Armory and Hall Banks.',
            rented: 'Storage leased outside your Home, Guild, or Clan.',
            ordnance: 'Neutral massive commercial space available for lease when your Home properties run out of room. This cavernous industrial bay accommodates heavy Spacecraft, specialized Armor, bulk Weapons, and larger Biological Companions. Assets are held safely regardless of faction Standing; keep monthly rental fees current or the property may be auctioned.',
            stash: 'Things you have buried, stashed, or hidden. An Animated Compass Safe Haven is an example of a place where hidden things can be kept.'
        };
        if (pageName !== 'on-person') return nav + '<h4 class="property-page-title">' + esc(pageTitles[pageName] || 'Property') + '</h4><div class="property-container-page"><p class="property-container-note">' + esc(pageDescriptions[pageName] || '') + '</p></div>';
        var owned = cards.filter(function(card) { return card.owned; }), unowned = cards.filter(function(card) { return !card.owned; }).slice(0, 5);
        return nav + '<h4 class="property-page-title">On Person</h4><div class="property-draft-tools"><input class="property-draft-search" id="propertyDraftSearch" type="search" placeholder="Search Cards by name or ref #..." oninput="filterPropertyDraft(this.value)" /><span class="property-draft-cap">Five Cards per row &middot; &#187; for more</span></div><div id="propertySearchMessage" class="property-search-message" hidden></div><div class="property-armory-layout">' + canvas(selected) + '<aside class="property-card-index"><h4>Card Index</h4><p>Choose any Card. The center canvas keeps Kaida, her worn Armaments, her Companions, and her Safe Haven visible while the selected Card is marked.</p><div class="property-card-index-list" id="propertyCardIndex">' + owned.concat(unowned).map(function(card) { return indexItem(card, selected); }).join('') + '</div></aside></div>' + rows(selected) + haulingSection();
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
    window.selectPropertyCard = function(id) { var card = get(id), draft = document.getElementById('propertyDraft'); if (!card || !draft) return; var previous = draft.getAttribute('data-selected') || 'armor-core', detailSelected = card.type === 'Companion Cards' ? previous : id; draft.setAttribute('data-selected', detailSelected); try { if (card.worn && card.owned) { var armaments = selectedArmament(previous), armamentIndex = armaments.indexOf(id); if (armamentIndex === -1) armaments.push(id); else armaments.splice(armamentIndex, 1); localStorage.setItem('sorc.property.selectedArmaments', JSON.stringify(armaments)); } if (card.type === 'Companion Cards' && card.owned) { var companions = selectedCompanion(previous), companionIndex = companions.indexOf(id); if (companionIndex === -1) companions.push(id); else companions.splice(companionIndex, 1); localStorage.setItem('sorc.property.selectedCompanions', JSON.stringify(companions)); } if (card.safeHaven) localStorage.setItem('sorc.property.safeHaven', card.safeHaven); } catch(e) {} draft.innerHTML = page('on-person', detailSelected); };
    window.propertyCompanionTap = function(id) { if (suppressNextCompanionClick) { suppressNextCompanionClick = false; return; } window.selectPropertyCard(id); };
    window.startPropertyCardHold = function(event, id) { if (event.pointerType === 'mouse' && event.button !== 0) return; window.cancelPropertyCardHold(); propertyHoldTimer = window.setTimeout(function() { suppressNextCompanionClick = true; window.showPropertyLongPressCard(id); }, 600); };
    window.endPropertyCardHold = function() { if (propertyHoldTimer) { window.clearTimeout(propertyHoldTimer); propertyHoldTimer = null; } };
    window.cancelPropertyCardHold = window.endPropertyCardHold;
    window.showPropertyLongPressCard = function(id) { var card = get(id) || CHARACTER_PICKERS.filter(function(picker) { return picker.id === id; })[0]; if (!card) return; var existing = document.getElementById('propertyLongPressCard'); if (existing) existing.remove(); var image = card.art ? '<img src="' + esc(card.art) + '" alt="' + esc(card.name) + '" />' : '<span class="property-long-press-placeholder" aria-hidden="true">&#9672;</span>'; var cardInfo = [card.rank, card.role].filter(Boolean).join(' · '); var overlay = document.createElement('div'); overlay.id = 'propertyLongPressCard'; overlay.className = 'property-long-press-overlay'; overlay.innerHTML = '<section class="property-long-press-card' + rankClass(card) + '" role="dialog" aria-modal="true" aria-label="' + esc(card.name) + ' Card" onclick="event.stopPropagation()"><button type="button" class="property-long-press-close" onclick="closePropertyLongPressCard()" aria-label="Close Card">&times;</button><div class="property-long-press-art">' + image + '</div><div class="property-long-press-meta"><div class="property-long-press-name">' + esc(card.name) + '</div>' + (cardInfo ? '<div class="property-long-press-rank">' + esc(cardInfo) + '</div>' : '') + '<div class="property-long-press-note">SORC Cards under development.</div></div></section>'; overlay.setAttribute('onclick', 'closePropertyLongPressCard()'); document.body.appendChild(overlay); window.setTimeout(function() { suppressNextCompanionClick = false; }, 900); };
    window.closePropertyLongPressCard = function() { var overlay = document.getElementById('propertyLongPressCard'); if (overlay) overlay.remove(); };
    window.selectPropertyCharacterPicker = function(id) { var draft = document.getElementById('propertyDraft'), picker = CHARACTER_PICKERS.filter(function(item) { return item.id === id && item.available; })[0]; if (!draft || !picker) return; try { localStorage.setItem('sorc.property.characterPicker', id); } catch(e) {} draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'armor-core'); };
    window.selectPropertyRowPage = function(type, direction) { var draft = document.getElementById('propertyDraft'); if (!draft) return; var typeCards = cards.filter(function(card) { return card.type === type; }), pageCount = Math.max(1, Math.ceil(typeCards.length / 5)), pageNumber = rowPages[type] || 0; rowPages[type] = (pageNumber + direction + pageCount) % pageCount; draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'armor-core'); };
    window.selectPropertySafeHaven = function(id) { var draft = document.getElementById('propertyDraft'), haven = SAFE_HAVENS.filter(function(item) { return item.id === id; })[0]; if (!draft || !haven) return; try { localStorage.setItem('sorc.property.safeHaven', id); } catch(e) {} draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'character-sheet'); };
    window.filterPropertyDraft = function(query) {
        var q = String(query || '').trim().toLowerCase(), matches = cards.filter(function(card) { return !q || (card.name + ' ' + card.ref + ' ' + card.summary + ' ' + card.type).toLowerCase().indexOf(q) !== -1; });
        document.querySelectorAll('#propertyDraftRows .property-armory-card').forEach(function(button) { button.style.display = (!q || (button.getAttribute('data-property-name') || '').toLowerCase().indexOf(q) !== -1) ? '' : 'none'; });
        var index = document.getElementById('propertyCardIndex'); if (index) index.innerHTML = matches.filter(function(card) { return card.owned; }).concat(matches.filter(function(card) { return !card.owned; }).slice(0, 5)).map(function(card) { return indexItem(card, document.getElementById('propertyDraft').getAttribute('data-selected') || 'armor-core'); }).join('');
        var message = document.getElementById('propertySearchMessage'); if (message) { message.hidden = !q || matches.length > 0; message.textContent = matches.length ? '' : 'No Card matches that search. Try the Card name, its ref #, or a Card type such as Armament, Companion, or Item.'; }
    };
})();