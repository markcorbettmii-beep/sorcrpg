(function() {
    function propertyCharacterId() {
        var id = '';
        try { id = new URLSearchParams(window.location.search).get('characterId') || ''; } catch(e) {}
        if (!id) {
            try { id = localStorage.getItem('sorc.characterId') || ''; } catch(e) {}
        }
        return id || 'default';
    }
    function propertyStorageKey(name) {
        return 'sorc.property.' + propertyCharacterId() + '.' + name;
    }
    window.SORCPropertyCharacterId = propertyCharacterId;
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
        { id:'armor-core', type:'Armament Cards', category:'Armor', name:'Leather Core Set', ref:'arm-pg.A-301', rank:'Rare', summary:'Cuirass, greaves, and pauldrons. Core Set: 4 slots.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-core.png?v=fit1', layerArt:'/content/character/assets/shared/armaments/techad/armor-taba/rare/high-res-core-leathtaba3.png_20260916_103316_0000.png', occludesBody:true, owned:true, worn:true },
        { id:'armor-helm', type:'Armament Cards', category:'Armor', name:'Leather Helm', ref:'arm-pg.A-302', rank:'Rare', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-helm.png?v=fit1', layerArt:'/content/character/assets/shared/armaments/techad/armor-taba/rare/high-res-helm-leathtaba3.png_20260915_021632_0000.png', owned:true, worn:true },
        { id:'armor-gloves', type:'Armament Cards', category:'Armor', name:'Leather Gloves', ref:'arm-pg.A-303', rank:'Rare', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-gloves.png?v=fit1', layerArt:'/content/character/assets/shared/armaments/techad/armor-taba/rare/high-res-gloves-leathtaba3.png_20260915_021700_0000.png', owned:true, worn:true },
        { id:'armor-boots', type:'Armament Cards', category:'Armor', name:'Leather Boots', ref:'arm-pg.A-304', rank:'Rare', summary:'Separate worn piece. 1 slot.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-boots.png?v=fit1', layerArt:'/content/character/assets/shared/armaments/techad/armor-taba/rare/high-res-boots-leathtaba3.png_20260916_124704_0000.png', owned:true, worn:true },
        { id:'weapon-taw', type:'Armament Cards', category:'Weapons', name:'Dual-Wield TAW', ref:'arm-pg.A-305', rank:'Rare', summary:'Readied dual-wield TAW Armament.', art:'/content/character/assets/customizer/pickers/armaments/armament-picker-taw.png?v=fit1', layerArt:'/content/character/assets/shared/armaments/techad/weapons-taw/rare/hand/dw/high-res-dw-taw3.png_20260916_103435_0000.png', owned:true, worn:true },
        { id:'armament-placeholder', type:'Armament Cards', category:'Readied Armaments', name:'Readied Armament', ref:'arm-pg.A-306', summary:'Placeholder Card awaiting its image.', art:'', owned:false, worn:false }
    ];
    window.SORCPropertyInventory = {
        characterId: propertyCharacterId,
        owned: function(type) {
            return cards.filter(function(card) {
                return card.owned && (!type || card.type === type);
            }).map(function(card) {
                return { id: card.id, type: card.type, name: card.name, ref: card.ref, summary: card.summary, worn: !!card.worn };
            });
        }
    };
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
        return '<button type="button" class="property-armory-card' + rankClass(card) + ' ' + (card.owned ? 'owned' : 'unowned') + (card.worn ? ' readied' : '') + (card.id === selected ? ' selected' : '') + '" data-property-card="' + esc(card.id) + '" data-property-name="' + esc(card.name + ' ' + card.ref + ' ' + card.summary + ' ' + card.type + ' ' + (card.category || '')) + '"' + companionInteraction(card) + ' aria-pressed="' + (card.id === selected ? 'true' : 'false') + '">' +
            '<span class="property-armory-card-art' + (card.art ? '' : ' placeholder') + '">' + art(card) + '</span></button>';
    }
    function indexItem(card, selected) {
        return '<button type="button" class="property-card-index-item' + rankClass(card) + (card.id === selected ? ' selected' : '') + (card.owned ? '' : ' unowned') + '"' + companionInteraction(card) + ' aria-label="Open ' + esc(card.name) + '"><span class="property-card-index-name">' + esc(card.name) + '</span><span class="property-card-index-meta">' + esc(card.ref) + ' &middot; ' + (card.owned ? (card.worn ? 'Readied' : 'Carried') : 'Not owned') + '</span></button>';
    }
    var SAFE_HAVEN_ART = '/content/character/assets/shared/canvas/high-res-canvas-background.png';
    var SAFE_HAVENS = [{ id:'default', name:'Default', art:'' }, { id:'secret-glades', name:'Secret Glades', art:SAFE_HAVEN_ART }];
    function selectedSafeHaven() { var id = 'default'; try { id = localStorage.getItem(propertyStorageKey('safeHaven')) || id; } catch(e) {} return SAFE_HAVENS.filter(function(haven) { return haven.id === id; })[0] || SAFE_HAVENS[0]; }
    function safeHavenControl(haven) { return '<details class="property-safe-haven-control"><summary aria-label="Select Safe Haven">Safe Haven</summary><div class="property-safe-haven-options" role="listbox" aria-label="Safe Haven choices">' + SAFE_HAVENS.map(function(item) { return '<button type="button" class="property-safe-haven-option' + (item.id === haven.id ? ' selected' : '') + '" onclick="selectPropertySafeHaven(\'' + esc(item.id) + '\')" role="option" aria-selected="' + (item.id === haven.id ? 'true' : 'false') + '">' + esc(item.name) + '</button>'; }).join('') + '</div></details>'; }
    function isSelected(selected, id) { return Array.isArray(selected) ? selected.indexOf(id) !== -1 : selected === id; }
    function orbitPiece(card, selected) {
        if (!card || !card.art) return '';
        var companion = card.type === 'Companion Cards';
        return '<button type="button" class="property-orbit-piece' + rankClass(card) + ' ' + (isSelected(selected, card.id) ? 'property-highlighted' : 'property-subdued') + '"' + companionInteraction(card) + ' aria-label="Open ' + esc(card.name) + '"><img src="' + esc(card.art) + '" alt="" /></button>';
    }
    function storedSelection(key, legacyKey, selected, type) { var raw = null; try { raw = localStorage.getItem(propertyStorageKey(key)); } catch(e) {} if (raw !== null) { try { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch(e) {} if (raw === 'none') return []; return [raw]; } var legacy = ''; try { legacy = localStorage.getItem(propertyStorageKey(legacyKey)) || ''; } catch(e) {} if (legacy && legacy !== 'none') return [legacy]; return type === 'worn' ? ['armor-core'] : []; }
    function selectedArmament(selected) { return storedSelection('selectedArmaments', 'lastReadied', selected, 'worn'); }
    function selectedCompanion(selected) { return storedSelection('selectedCompanions', 'selectedCompanion', selected, 'type'); }
    var CHARACTER_PICKERS = [
        { id:'character-picker-basic-1', name:'Kaida', previewSuffix:' - First Basic Member Character Slot.', art:'/content/character/assets/female/firstborn/human/physiques/muscular/body/fbody-musc-pale.png_20260916_001443_0000.png', tier:'basic', available:true },
        { id:'character-picker-basic-2', name:'Second Basic Member Slot', previewSuffix:' - Create another character now', art:'/content/character/assets/customizer/pickers/characters/picker-silhouette-grp.png_20260925_115236_0000.png', tier:'basic', available:false },
        { id:'character-picker-pro-1', name:'First Pro Member Slot', previewSuffix:' - enter Box Code to create another Character', art:'/content/character/assets/customizer/pickers/characters/picker-silhouette-grp.png_20260925_115236_0000.png', tier:'pro', available:false },
        { id:'character-picker-pro-2', name:'Second Pro Member Slot', previewSuffix:' - enter Box Code to create another Character', art:'/content/character/assets/customizer/pickers/characters/picker-silhouette-grp.png_20260925_115236_0000.png', tier:'pro', available:false },
        { id:'character-picker-pro-3', name:'Third Pro Member Slot', previewSuffix:' - enter Box Code to create another Character', art:'/content/character/assets/customizer/pickers/characters/picker-silhouette-grp.png_20260925_115236_0000.png', tier:'pro', available:false }
    ];
    function selectedCharacterPicker() {
        var id = '';
        try { id = localStorage.getItem(propertyStorageKey('characterPicker')) || ''; } catch(e) {}
        return CHARACTER_PICKERS.some(function(picker) { return picker.available && picker.id === id; }) ? id : CHARACTER_PICKERS[0].id;
    }
    function characterPickerVisible() {
        try { return localStorage.getItem(propertyStorageKey('characterVisible')) !== 'false'; } catch(e) { return true; }
    }
    function characterPickerMarkup() {
        var selected = selectedCharacterPicker();
        return '<div class="property-character-picker"><div class="property-character-picker-tiers"><div class="property-character-picker-tier basic">Basic</div><div class="property-character-picker-tier pro">Pro</div></div><div class="property-character-picker-thumbs">' +
            CHARACTER_PICKERS.map(function(picker) {
                var disabled = picker.available ? '' : ' unavailable';
                var interaction = pickerInteraction(picker, picker.available ? ' onclick="selectPropertyCharacterPicker(\'' + esc(picker.id) + '\')" aria-pressed="' + (picker.id === selected ? 'true' : 'false') + '"' : ' aria-disabled="true"');
                var pickerImage = picker.available ? canvasLayers(selectedArmament(), [], true) : (picker.art ? '<img src="' + esc(picker.art) + '" alt="' + esc(picker.name) + '" />' : '');
                return '<button type="button" class="property-character-picker-thumb ' + picker.tier + disabled + ' ' + picker.id + (picker.id === selected ? ' selected' : '') + '"' + interaction + ' aria-label="' + esc(picker.name) + (picker.available ? '' : ' (not available)') + '">' + pickerImage + '</button>';
            }).join('') +
        '</div></div>';
    }
    window.SORCPropertyCharacterPickerId = selectedCharacterPicker;
    window.SORCPropertyCharacterName = function() {
        var selected = selectedCharacterPicker();
        var picker = CHARACTER_PICKERS.filter(function(item) { return item.id === selected; })[0];
        return picker ? picker.name : 'Character';
    };
    window.SORCPropertyCharacterPickerMarkup = function(handlerName) {
        var markup = characterPickerMarkup();
        if (handlerName === 'selectSpaceCharacterPicker') {
            markup = markup.replace(/onclick="selectPropertyCharacterPicker\(/g, 'onclick="selectSpaceCharacterPicker(');
        }
        return markup;
    };
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
    var HAND_FOREGROUND_ART = '/content/character/assets/female/firstborn/human/physiques/muscular/body/hands-foreground.png_20260916_163927_0000.png';
    function characterHandLayer(src, side) {
        return '<img class="property-canvas-layer property-canvas-layer-character-hand-' + side + '" style="-webkit-mask-image:url(\'' + esc(HAND_FOREGROUND_ART) + '\');mask-image:url(\'' + esc(HAND_FOREGROUND_ART) + '\')" src="' + esc(src) + '" alt="" aria-hidden="true" />';
    }
    var ARMAMENT_LAYER_ORDER = { 'armor-boots': 1, 'armor-core': 2, 'armor-gloves': 3, 'weapon-taw': 4, 'armor-helm': 5 };
    function selectedArmamentOccludesBody(selectedArmaments) {
        return selectedArmaments.some(function(id) {
            var card = get(id);
            return card && card.occludesBody === true;
        });
    }
    function canvasLayers(selectedArmaments, selectedCompanions, forceCharacterVisible) {
        var armaments = selectedArmaments.map(function(id) { return get(id); }).filter(Boolean);
        armaments.sort(function(a, b) {
            var aOrder = ARMAMENT_LAYER_ORDER[a.id] || 99, bOrder = ARMAMENT_LAYER_ORDER[b.id] || 99;
            return aOrder - bOrder;
        });
        var companions = selectedCompanions.map(function(id) { return get(id); }).filter(Boolean);
        var bodyOcclusion = selectedArmamentOccludesBody(selectedArmaments) ? ' property-character-occluded-by-armor' : '';
        var includeCharacter = forceCharacterVisible || characterPickerVisible();
        return '<div class="property-canvas-layer-stack" aria-label="Selected canvas layers"><div class="property-canvas-composition">' +
            (includeCharacter ? selectedCharacterLayers(selectedArmaments).map(function(src, index) { return '<img class="property-canvas-layer property-canvas-layer-character-' + index + (index === 0 ? bodyOcclusion : '') + '" src="' + src + '" alt="" aria-hidden="true" />'; }).join('') +
            companions.map(function(card) { return canvasLayer(card, 'property-canvas-layer-companion ' + card.id); }).join('') +
            armaments.map(function(card) { return canvasLayer(card, 'property-canvas-layer-armament ' + card.id); }).join('') +
            selectedCharacterLayers(selectedArmaments).map(function(src) { return characterHandLayer(src, 'left') + characterHandLayer(src, 'right'); }).join('') : '') +
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
            '<div class="property-canvas-pickers property-canvas-pickers-bottom"><div class="property-canvas-orbit companions">' + companions.map(function(c) { return orbitPiece(c, highlightedCompanion); }).join('') + '</div><div class="property-companion-instruction">Select to view on canvas or long press to view card</div></div>' +
        '</section>';
    }
    function haulingSection() {
        return '<section class="property-container-category"><div class="property-armory-row-head"><h4>Hauling</h4><span>Companions and wagons</span></div>' +
            '<div class="property-armory-row"><div class="property-armory-row-head"><h4>Companions</h4><span class="property-container-size">Tiny &middot; Small &middot; Standard &middot; Goliath</span></div><p class="property-container-note">Companions may be Tearhered or Parked for periods of time, with the right equipment, but this effects their Mood. Vehicles are at risk of theft.</p><div class="property-card-row">' +
            ['Fellowship Companion','Pack Mule','Tiny Companion','Goliath Companion','Behemoth Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i < 2 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">container-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i < 2 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') +
            '</div></div><div class="property-armory-row"><div class="property-armory-row-head"><h4>Wagons</h4><span class="property-container-size">Goliath</span></div><div class="property-card-row">' +
            ['Cargo Wagon','Wagon Placeholder'].map(function(n, i) { return '<button type="button" class="property-armory-card ' + (i === 0 ? 'owned' : 'unowned') + '"><span class="property-armory-card-art placeholder">&#9672;</span><span class="property-armory-card-name">' + esc(n) + '</span><span class="property-armory-card-ref">wagon-' + (i + 1) + '</span><span class="property-armory-card-state">' + (i === 0 ? 'Capacity pending' : 'Not owned') + '</span></button>'; }).join('') +
            '</div></div></section>';
    }
    var PROPERTY_TAB_PAGES = [
        { id:'on-person', title:'Worn', label: 'Worn', description:'Armaments, gear, and other items the Character is currently wearing or has readied.' },
        { id:'carried-hauled', title:'Carried-Hauled', descriptionMarkup:'These are things the Character is Carrying (on their person) and/or is having Hauled (<a href="/content/essentia_core/rules_companions.html#draft-animals">Draft Animals</a>, Vehicles, etc) during their adventures. Companions may be Tearhered or Parked for periods of time, with the right equipment, but this effects their Mood. Vehicles are at risk of theft.' },
        { id:'quarters', title:'Quarters', description:'A Character’s living spaces and household, including rooms, Family, armories, and Companion quarters. Quarters may be rented or owned.' },
        { id:'vaults', title:'Vault', description:'Personal vaults may be rented or owned; town banks, guilds, and clans also provide secure storage.' },
        { id:'storage-stash', title:'Stash/Stored', description:'Home or rented storage for containers, deployed items, trophies, and things the Character has buried, hidden, or stashed.' },
        { id:'force-station', title:'Force Station', descriptionMarkup:'Space for vehicles and spacecraft too large to fit on a <a href="/content/essentia_core/rules_game-features.html#land-divisions">Lot</a>.' }
    ];
    var PROPERTY_CARD_ROWS = [
        { id:'readied-armaments', title:'Readied Armaments', matches:function(card) { return card.type === 'Armament Cards' && ((card.owned && card.worn) || card.category === 'Readied Armaments'); } },
        { id:'sentimental-arms', title:'Sentimental Arms', matches:function(card) { return card.sentimental === true || card.isSentimental === true || card.category === 'Sentimental Arms' || card.type === 'Sentimental Arms'; } },
        { id:'weapons', title:'Weapons', matches:function(card) { return card.category === 'Weapons' || card.type === 'Weapon Cards'; } },
        { id:'armor', title:'Armor', matches:function(card) { return card.category === 'Armor' || card.type === 'Armor Cards'; } },
        { id:'companion', title:'Companion', matches:function(card) { return card.type === 'Companion Cards' || card.category === 'Companion'; } }
    ];
    function propertyRowCards(rowId) {
        var row = PROPERTY_CARD_ROWS.filter(function(item) { return item.id === rowId; })[0];
        return row ? cards.filter(row.matches) : [];
    }
    function cardIndex(selected) {
        var owned = cards.filter(function(card) { return card.owned; });
        var unowned = cards.filter(function(card) { return !card.owned; }).slice(0, 5);
        return '<aside class="property-card-index" aria-label="Property Cards">' +
            '<p>Choose any Card. The selected Character&rsquo;s Assets appear on the Worn page&rsquo;s center canvas.</p>' +
            '<div class="property-card-index-list" id="propertyCardIndex">' + owned.concat(unowned).map(function(card) { return indexItem(card, selected); }).join('') + '</div>' +
            '<p class="property-card-index-note">Full list of Armament and Companion SORC Cards. Armaments Readied and Accompanying Companions are displayed with the Character on the Worn page&rsquo;s center canvas. For the Character&rsquo;s full inventory and container types, refer to the Home tab of User Space.</p>' +
            '</aside>';
    }
    function page(pageName, selected) {
        var access = '<div class="property-access-block"><span class="property-access-pill" aria-label="PUBLIC / PRIVATE"><span class="property-access-public">PUBLIC</span><span class="property-access-divider"> / </span><span class="property-access-private">PRIVATE</span></span><p class="property-gm-note">Some features are available to GMs upon assessing into lobbies for online campaigns.</p></div>';
        var pageIndex = PROPERTY_TAB_PAGES.findIndex(function(item) { return item.id === pageName; });
        var pageInfo = pageIndex >= 0 ? PROPERTY_TAB_PAGES[pageIndex] : { title:'Property', description:'' };
        function pageHeader() {
            return '<div class="property-page-header"><div class="property-page-intro"><div class="property-page-heading-row">' +
                '<h4 class="property-page-title">' + esc(pageInfo.title) + '</h4></div>' +
                (pageInfo.descriptionMarkup || pageInfo.description ? '<p class="property-page-description">' + (pageInfo.descriptionMarkup || esc(pageInfo.description)) + '</p>' : '') +
                '</div></div>';
        }
        function pageNavigation() {
            var previous = pageIndex > 0 ? PROPERTY_TAB_PAGES[pageIndex - 1] : null;
            var next = pageIndex >= 0 && pageIndex < PROPERTY_TAB_PAGES.length - 1 ? PROPERTY_TAB_PAGES[pageIndex + 1] : null;
            return '<nav class="property-page-nav" aria-label="Property pages">' +
                '<div class="property-page-nav-side property-page-nav-left">' +
                    (previous ? '<button type="button" class="property-page-prev" onclick="selectPropertyPage(\'' + previous.id + '\')" aria-label="Previous Property page">&#171;&#171;</button>' : '') +
                    '<span class="property-page-current" aria-current="page">PG. ' + (pageIndex + 1) + ' ' + esc(pageInfo.title) + '</span>' +
                '</div>' +
                (next ? '<div class="property-page-nav-side property-page-nav-right"><button type="button" class="property-page-next" onclick="selectPropertyPage(\'' + next.id + '\')" aria-label="Next Property page">&#187;&#187;</button><span class="property-page-next-label">' + esc(next.title) + '</span></div>' : '') +
                '</nav>';
        }
        function pageFrame(content) {
            return pageHeader() + pageNavigation() + access + content;
        }
        if (pageName === 'carried-hauled') {
            return pageFrame(cardIndex(selected) + haulingSection());
        }
        if (pageName === 'quarters') {
            var familyMarkup = typeof window.renderSpaceFamilyPropertyPage === 'function'
                ? window.renderSpaceFamilyPropertyPage()
                : '<p class="property-container-note">Character and Family information is unavailable.</p>';
            return pageFrame(familyMarkup);
        }
        if (pageName === 'storage-stash') {
            return pageFrame('<div class="property-container-grid">' +
                '<section class="property-container-section"><h5>Home Storage</h5><p>Home closets, storage containers, Deployments, and Trophy Room items.</p></section>' +
                '<section class="property-container-section"><h5>Rented Storage</h5><p>Storage leased outside your Home.</p></section>' +
                '<section class="property-container-section"><h5>Stash</h5><p>Things you have buried, stashed, or hidden. An Animated Compass Safe Haven is one example of a place to keep hidden items.</p></section>' +
                '</div>');
        }
        if (pageName === 'vaults') {
            return pageFrame('<div class="property-container-grid">' +
                '<section class="property-container-section"><h5>Personal Vaults</h5><p>Personal safes and vaults may be rented or owned.</p></section>' +
                '<section class="property-container-section"><h5>Town Banks</h5><p>Secure vault storage is available through town banks.</p></section>' +
                '<section class="property-container-section"><h5>Guild &amp; Clan</h5><p>Guilds and clans may provide vault storage, Armories, and Hall Banks.</p></section>' +
                '</div>');
        }
        if (pageName === 'force-station') {
            return pageFrame('<div class="property-container-grid">' +
                '<section class="property-container-section"><h5>Force Station</h5><p>Keep monthly rental fees current or the property may be auctioned. Vehicles and spacecraft too large for a Lot are kept here.</p></section>' +
                '</div>');
        }
        if (pageName !== 'on-person') return pageFrame('');
        return pageFrame(canvas(selected) + rows(selected));
    }
    var rowPages = {};
    function rows(selected) {
        return '<div class="property-draft-tools"><input class="property-draft-search" id="propertyDraftSearch" type="search" placeholder="Search Cards by name or ref #..." oninput="filterPropertyDraft(this.value)" /></div><div id="propertySearchMessage" class="property-search-message" hidden></div><div id="propertyDraftRows">' + PROPERTY_CARD_ROWS.map(function(row) {
            var rowCards = propertyRowCards(row.id), pageSize = 9;
            var pageCount = Math.ceil(rowCards.length / pageSize);
            var pageNumber = pageCount ? Math.min(rowPages[row.id] || 0, pageCount - 1) : 0;
            rowPages[row.id] = pageNumber;
            var visibleCards = rowCards.slice(pageNumber * pageSize, pageNumber * pageSize + pageSize);
            var rowContent = rowCards.length
                ? visibleCards.map(function(card) { return button(card, selected); }).join('')
                : '<div class="property-card-row-empty">No cards yet.</div>';
            var more = pageNumber < pageCount - 1
                ? '<button type="button" class="property-card-row-more" onclick="selectPropertyRowPage(\'' + esc(row.id) + '\', 1)" aria-label="More ' + esc(row.title) + ' cards">&#187;&#187;</button>'
                : '<span class="property-card-row-more is-end" aria-label="No more ' + esc(row.title) + ' cards">&#187;&#187;</span>';
            return '<section class="property-armory-row" data-property-row="' + esc(row.id) + '"><div class="property-armory-row-head"><h4>' + esc(row.title) + '</h4></div><div class="property-card-row">' + rowContent + more + '</div></section>';
        }).join('') + '</div>';
    }
    window.renderPropertyDraft = function() {
        var selected = 'armor-core'; try { selected = localStorage.getItem(propertyStorageKey('lastReadied')) || selected; } catch(e) {}
        var firstPage = PROPERTY_TAB_PAGES[0];
        if (!firstPage) return '<div class="property-draft" id="propertyDraft" data-page="" data-selected="' + esc(selected) + '"><p class="property-container-note">No Property pages are available.</p></div>';
        return '<div class="property-draft" id="propertyDraft" data-page="' + esc(firstPage.id) + '" data-selected="' + esc(selected) + '">' + page(firstPage.id, selected) + '</div>';
    };
    window.selectPropertyPage = function(name) {
        var draft = document.getElementById('propertyDraft');
        if (!draft || !PROPERTY_TAB_PAGES.some(function(item) { return item.id === name; })) return;
        var selected = draft.getAttribute('data-selected') || 'armor-core';
        draft.setAttribute('data-page', name);
        draft.innerHTML = page(name, selected);
        if (name === 'quarters') {
            if (typeof window.refreshSpaceHomeCharacterRecords === 'function') window.refreshSpaceHomeCharacterRecords();
        }
        draft.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
      window.selectPropertyCard = function(id) { var card = get(id), draft = document.getElementById('propertyDraft'); if (!card || !draft) return; var previous = draft.getAttribute('data-selected') || 'armor-core', detailSelected = card.type === 'Companion Cards' ? previous : id, pageName = draft.getAttribute('data-page') || 'on-person'; draft.setAttribute('data-selected', detailSelected); try { if (card.worn && card.owned) { var armaments = selectedArmament(previous), armamentIndex = armaments.indexOf(id); if (armamentIndex === -1) armaments.push(id); else armaments.splice(armamentIndex, 1); localStorage.setItem(propertyStorageKey('selectedArmaments'), JSON.stringify(armaments)); } if (card.type === 'Companion Cards' && card.owned) { var companions = selectedCompanion(previous), companionIndex = companions.indexOf(id); if (companionIndex === -1) companions.push(id); else companions.splice(companionIndex, 1); localStorage.setItem(propertyStorageKey('selectedCompanions'), JSON.stringify(companions)); } if (card.safeHaven) localStorage.setItem(propertyStorageKey('safeHaven'), card.safeHaven); } catch(e) {} draft.innerHTML = page(pageName, detailSelected); };
    window.propertyCompanionTap = function(id) { if (suppressNextCompanionClick) { suppressNextCompanionClick = false; return; } window.selectPropertyCard(id); };
    window.startPropertyCardHold = function(event, id) { if (event.pointerType === 'mouse' && event.button !== 0) return; window.cancelPropertyCardHold(); propertyHoldTimer = window.setTimeout(function() { suppressNextCompanionClick = true; window.showPropertyLongPressCard(id); }, 600); };
    window.endPropertyCardHold = function() { if (propertyHoldTimer) { window.clearTimeout(propertyHoldTimer); propertyHoldTimer = null; } };
    window.cancelPropertyCardHold = window.endPropertyCardHold;
     window.showPropertyLongPressCard = function(id) { var card = get(id) || CHARACTER_PICKERS.filter(function(picker) { return picker.id === id; })[0]; if (!card) return; var existing = document.getElementById('propertyLongPressCard'); if (existing) existing.remove(); var image = card.art ? '<img src="' + esc(card.art) + '" alt="' + esc(card.name) + '" />' : '<span class="property-long-press-placeholder" aria-hidden="true">&#9672;</span>'; var cardInfo = [card.rank, card.role].filter(Boolean).join(' · '); var isCharacterPicker = id.indexOf('character-picker-') === 0; var displayName = card.name + (isCharacterPicker && card.previewSuffix ? card.previewSuffix : ''); var developmentNote = isCharacterPicker ? '' : '<div class="property-long-press-note">SORC Cards under development.</div>'; var overlay = document.createElement('div'); overlay.id = 'propertyLongPressCard'; overlay.className = 'property-long-press-overlay'; overlay.innerHTML = '<section class="property-long-press-card' + rankClass(card) + '" role="dialog" aria-modal="true" aria-label="' + esc(displayName) + ' Card" onclick="event.stopPropagation()"><button type="button" class="property-long-press-close" onclick="closePropertyLongPressCard()" aria-label="Close Card">&times;</button><div class="property-long-press-art">' + image + '</div><div class="property-long-press-meta"><div class="property-long-press-name">' + esc(displayName) + '</div>' + (cardInfo ? '<div class="property-long-press-rank">' + esc(cardInfo) + '</div>' : '') + developmentNote + '</div></section>'; overlay.setAttribute('onclick', 'closePropertyLongPressCard()'); document.body.appendChild(overlay); window.setTimeout(function() { suppressNextCompanionClick = false; }, 900); };
    window.closePropertyLongPressCard = function() { var overlay = document.getElementById('propertyLongPressCard'); if (overlay) overlay.remove(); };
      window.selectPropertyCharacterPicker = function(id) { var draft = document.getElementById('propertyDraft'), picker = CHARACTER_PICKERS.filter(function(item) { return item.id === id && item.available; })[0]; if (!draft || !picker) return; try { if (selectedCharacterPicker() === id) localStorage.setItem(propertyStorageKey('characterVisible'), characterPickerVisible() ? 'false' : 'true'); else { localStorage.setItem(propertyStorageKey('characterPicker'), id); localStorage.setItem(propertyStorageKey('characterVisible'), 'true'); } } catch(e) {} var pageName = draft.getAttribute('data-page') || 'on-person'; draft.innerHTML = page(pageName, draft.getAttribute('data-selected') || 'armor-core'); if (pageName === 'quarters' && typeof window.refreshSpaceHomeCharacterRecords === 'function') window.refreshSpaceHomeCharacterRecords(); };
    window.selectSpaceCharacterPicker = function(id) {
        var picker = CHARACTER_PICKERS.filter(function(item) { return item.id === id && item.available; })[0];
        if (!picker) return;
        try {
            if (selectedCharacterPicker() !== id) {
                localStorage.setItem(propertyStorageKey('characterPicker'), id);
                localStorage.setItem(propertyStorageKey('characterVisible'), 'true');
            }
        } catch(e) {}
        var draft = document.getElementById('propertyDraft');
        if (draft) {
            var pageName = draft.getAttribute('data-page') || 'on-person';
            draft.innerHTML = page(pageName, draft.getAttribute('data-selected') || 'armor-core');
            if (pageName === 'quarters' && typeof window.refreshSpaceHomeCharacterRecords === 'function') {
                window.refreshSpaceHomeCharacterRecords();
            }
        }
        var pickerControls = document.getElementById('spaceCharacterPickerControls');
        if (pickerControls) pickerControls.innerHTML = window.SORCPropertyCharacterPickerMarkup('selectSpaceCharacterPicker');
        if (typeof window.refreshSpaceCharacterIdentity === 'function') window.refreshSpaceCharacterIdentity();
    };
    window.selectPropertyRowPage = function(rowId, direction) { var draft = document.getElementById('propertyDraft'); if (!draft) return; var pageCount = Math.ceil(propertyRowCards(rowId).length / 9); if (!pageCount) return; var pageNumber = Math.min(Math.max(rowPages[rowId] || 0, 0), pageCount - 1); rowPages[rowId] = Math.max(0, Math.min(pageCount - 1, pageNumber + direction)); draft.innerHTML = page('on-person', draft.getAttribute('data-selected') || 'armor-core'); };
      window.selectPropertySafeHaven = function(id) { var draft = document.getElementById('propertyDraft'), haven = SAFE_HAVENS.filter(function(item) { return item.id === id; })[0]; if (!draft || !haven) return; try { localStorage.setItem(propertyStorageKey('safeHaven'), id); } catch(e) {} var pageName = draft.getAttribute('data-page') || 'on-person'; draft.innerHTML = page(pageName, draft.getAttribute('data-selected') || 'character-sheet'); };
    window.filterPropertyDraft = function(query) {
        var q = String(query || '').trim().toLowerCase(), matches = cards.filter(function(card) { return !q || (card.name + ' ' + card.ref + ' ' + card.summary + ' ' + card.type + ' ' + (card.category || '')).toLowerCase().indexOf(q) !== -1; });
        document.querySelectorAll('#propertyDraftRows .property-armory-card').forEach(function(button) { button.style.display = (!q || (button.getAttribute('data-property-name') || '').toLowerCase().indexOf(q) !== -1) ? '' : 'none'; });
        var index = document.getElementById('propertyCardIndex'); if (index) index.innerHTML = matches.filter(function(card) { return card.owned; }).concat(matches.filter(function(card) { return !card.owned; }).slice(0, 5)).map(function(card) { return indexItem(card, document.getElementById('propertyDraft').getAttribute('data-selected') || 'armor-core'); }).join('');
        var message = document.getElementById('propertySearchMessage'); if (message) { message.hidden = !q || matches.length > 0; message.textContent = matches.length ? '' : 'No Card matches that search. Try the Card name, its ref #, or a Card type such as Armament, Companion, or Item.'; }
    };
})();