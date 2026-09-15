/**
 * SORC Navigation System v2
 * D&D Beyond-style hamburger menu, badge, and floating avatar
 * Works on all pages with proper theme support (lawful/dark)
 * Theme sync: lawful (light) default
 */

// Chapter hierarchy for the rules navigation
const RULES_CHAPTERS = [
  {
    name: "Character Creation",
    file: "rules_character-creation.html",
    subsections: [
      { name: "Character Creation Steps", id: "character-creation" },
      { name: "Character Sheet", id: "character-sheet" },
      { name: "Character Details During Creation", id: "character-details" },
      { name: "Birthday", id: "birthday" },
      { name: "Character UID", id: "character-uid" },
      { name: "Race", id: "race" },
      { name: "Alignment", id: "alignment" }
    ]
  },
  {
    name: "Character Progression",
    file: "rules_character-progression.html",
    subsections: [
      { name: "Growth and Progression", id: "growth" },
      { name: "Leveling", id: "leveling" },
      { name: "Attribute Development", id: "attr-dev" }
    ]
  },
  {
    name: "Playable Races",
    file: "rules_playable-races.html",
    subsections: [
      { name: "Playable Races Overview", id: "playable-races" }
    ]
  },
  {
    name: "Equipment & Items",
    file: "rules_equipment.html",
    subsections: [
      { name: "Equipment", id: "equipment" }
    ]
  },
  {
    name: "Statistics & Formulas",
    file: "rules_statistics.html",
    subsections: [
      { name: "Statistics Reference", id: "statistics" }
    ]
  }
];

const SORC_AUTH_REQUIRED_PATHS = new Set([
  '/lobbies.html',
  '/library.html',
  '/content/features/achievements.html',
  '/content/features/ai-chat.html',
  '/content/features/armor-system.html',
  '/content/features/call-to-arms.html',
  '/content/features/characters-home.html',
  '/content/features/collection.html',
  '/content/features/exchange.html',
  '/content/features/fellowships.html',
  '/content/features/forum.html',
  '/content/features/inbox.html',
  '/content/features/leaderboard.html',
  '/content/features/lobbies.html',
  '/content/features/room.html',
  '/content/features/sorc-store.html',
  '/content/features/space.html',
  '/content/features/threads.html',
  '/content/features/trading-post.html',
  '/content/features/trials-of-combat.html',
  '/content/features/vault.html'
]);

class SORCNavigation {
  constructor() {
    this.isMenuOpen = false;
    this.init();
  }

  init() {
    if (document.getElementById('sorc-nav-wrapper')) return;
    if (this.redirectUnauthenticatedVisitor()) return;

    const savedTheme = localStorage.getItem('themeSelected') || 'lawful';
    document.body.classList.toggle('lawful-mode', savedTheme === 'lawful');
    document.body.classList.toggle('evil-mode', savedTheme === 'evil');
    this.injectNavigationHTML();
    this.attachEventListeners();
    this.mountProfileBadge();
    setTimeout(() => this.mountProfileBadge(), 0);
    this.loadUserProfile();
    this.refreshAuthenticatedUser();
    this.initThemeToggle();
  }

  redirectUnauthenticatedVisitor() {
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (!SORC_AUTH_REQUIRED_PATHS.has(currentPath)) return false;

    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('sorc_user') || 'null');
    } catch (error) {
      user = null;
    }
    if (user && user.authKey) return false;

    window.location.replace('/content/auth/wanderer.html');
    return true;
  }

  injectNavigationHTML() {
    // Get the correct path to root based on current page depth
    const pathToRoot = this.getPathToRoot();
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const isHomePage = currentPath === '/' || currentPath === '/index.html';
    const hasPageBanner = !!document.querySelector(
      '.header-container .sorc-letters-img, .header-container .sorc-letters, .header-container img[src*="sorc" i], [data-sorc-page-banner]'
    );
    const brandBannerHTML = (!isHomePage && !hasPageBanner) ? `
      <div class="sorc-global-brand-banner" data-sorc-page-banner>
        <a href="${pathToRoot}index.html" class="sorc-global-brand-link" aria-label="SORC home">
          <img src="/images/newest-sorc-redev-letters-jpeg_20260808_072206_0000.png" class="sorc-global-brand-image evil-only" alt="SORC">
          <img src="/images/newest-sorc-goldlaw-letters-jpeg_20260808_072143_0000.png" class="sorc-global-brand-image lawful-only" alt="SORC">
        </a>
      </div>
    ` : '';

    const navHTML = `
      <div id="sorc-nav-wrapper" class="sorc-nav-wrapper">
        <!-- Hamburger Menu -->
        <nav class="sorc-nav">
          <!-- Home Icon (Far Left) -->
          <a href="${pathToRoot}index.html" class="sorc-nav-home-icon" aria-label="Home">
            <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 10.8 12 3l9 7.8"></path>
              <path d="M5.5 9.5V21h13V9.5"></path>
            </svg>
          </a>

          <!-- Search Bar -->
          <div class="sorc-nav-search-container">
            <svg class="sorc-nav-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input type="text" class="sorc-nav-search-input" placeholder="Delve" aria-label="Search">
          </div>


          <!-- Right Side Controls (Hamburger) -->
          <div class="sorc-nav-right">
            <!-- Hamburger Menu (Far Right) -->
            <button class="sorc-nav-toggle" aria-label="Toggle navigation menu" aria-expanded="false">
              <span class="hamburger">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>

          <!-- Navigation Sidebar -->
          <div class="sorc-nav-sidebar">
            <div class="sorc-nav-header">
              <a href="${pathToRoot}index.html" class="sorc-nav-logo">Into Essentia</a>
              <button class="sorc-nav-close" aria-label="Close menu">✕</button>
            </div>

            <div class="sorc-avatar-theme-toggle-wrapper sorc-sidebar-theme-toggle">
              <button class="sorc-avatar-theme-toggle" aria-label="Toggle theme (Lawful/Evil mode)" aria-pressed="false">
                <span class="sorc-theme-label lawful">LAWFUL</span>
                <span class="sorc-theme-label evil">EVIL</span>
              </button>
            </div>

            <a class="sorc-sidebar-profile-card" href="${pathToRoot}content/auth/signin.html">
              <span class="sorc-sidebar-profile-avatar sorc-visitor-avatar">W</span>
              <span class="sorc-sidebar-profile-copy">
                <span class="sorc-sidebar-profile-identity">
                  <strong class="sorc-sidebar-profile-name">Sign in</strong>
                  <small class="sorc-sidebar-profile-role">Guest</small>
                </span>
                <small class="sorc-sidebar-profile-membership" hidden></small>
              </span>
              <span class="sorc-sidebar-profile-arrow" aria-hidden="true">›</span>
            </a>

            <div class="sorc-nav-content">
              <!-- YOUR SPACE - First Section (Submenu) -->
              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="play" aria-expanded="false" aria-controls="play-menu">
                  <span class="sorc-nav-section-label">YOUR SPACE</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Manage your character, lobbies, room, and personal progression.</p>
                <ul class="sorc-nav-section-menu" id="play-menu">
                  <li><a href="${pathToRoot}content/features/space.html">Your Space Profile</a></li>
                  <li><a href="${pathToRoot}lobbies.html">My Lobbies</a></li>
                  <li><a href="${pathToRoot}content/character-customization-index.html">Character Customization</a></li>
                  <li><a href="${pathToRoot}content/features/room.html">Room</a></li>
                  <li><a href="${pathToRoot}content/features/trading-post.html">Trading Post</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="announcements" aria-expanded="false" aria-controls="announcements-menu">
                  <span class="sorc-nav-section-label">ANNOUNCEMENTS</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Catch up on official SORC updates and notices.</p>
                <ul class="sorc-nav-section-menu" id="announcements-menu">
                  <li><a href="${pathToRoot}content/announcements-index.html">Announcements Index</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="community" aria-expanded="false" aria-controls="community-menu">
                  <span class="sorc-nav-section-label">COMMUNITY</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Connect with players through rankings, fellowships, and forums.</p>
                <ul class="sorc-nav-section-menu" id="community-menu">
                  <li><a href="${pathToRoot}content/features/leaderboard.html">Leaderboard</a></li>
                  <li><a href="${pathToRoot}content/features/fellowships.html">Fellowships</a></li>
                  <li><a href="${pathToRoot}content/features/forum.html">Forums</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="content" aria-expanded="false" aria-controls="content-menu">
                  <span class="sorc-nav-section-label">CONTENT</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Explore the SORC Web features, services, and experiences.</p>
                <ul class="sorc-nav-section-menu" id="content-menu">
                  <li><a href="${pathToRoot}content/content-index.html">Content Index</a></li>
                  <li><a href="${pathToRoot}content/sorc-web-index.html">SORC Web</a></li>
                  <li><a href="${pathToRoot}content/features/sorc-store.html">SORC Store</a></li>
                  <li><a href="${pathToRoot}content/features/exchange.html">Essentia Exchange</a></li>
                  <li><a href="${pathToRoot}content/features/collection.html">Collection</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="game-modes" aria-expanded="false" aria-controls="game-modes-menu">
                  <span class="sorc-nav-section-label">GAME MODES</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Choose how you want to play, from adventures to combat.</p>
                <ul class="sorc-nav-section-menu" id="game-modes-menu">
                  <li><a href="${pathToRoot}content/game-modes-index.html">Game Modes Index</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="library" aria-expanded="false" aria-controls="library-menu">
                  <span class="sorc-nav-section-label">LIBRARY</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Tomes of Essentia, Character Sheets, Journal and other downloadable books and tools.</p>
                <ul class="sorc-nav-section-menu" id="library-menu">
                  <li><a href="${pathToRoot}content/library-index.html">Library</a></li>
                  <li><a href="${pathToRoot}library.html">Legacy Library</a><span class="sorc-nav-item-description">Retire your PC as an NPC, Legend, or Hermit.</span></li>
                  <li><a href="${pathToRoot}content/tomes/heroes-hermits.html">Tomes</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="news" aria-expanded="false" aria-controls="news-menu">
                  <span class="sorc-nav-section-label">NEWS</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Read the latest stories, releases, and developments from Essentia.</p>
                <ul class="sorc-nav-section-menu" id="news-menu">
                  <li><a href="${pathToRoot}content/news-index.html">News Index</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="rules" aria-expanded="false" aria-controls="rules-menu">
                  <span class="sorc-nav-section-label">RULES</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Learn the rules that guide characters, items, and play.</p>
                <ul class="sorc-nav-section-menu" id="rules-menu">
                  <li><a href="${pathToRoot}content/essentia_core/rules-index.html">Complex Rules</a><span class="sorc-nav-item-description">The crunchy version of SORC, includes all planets, detailed stat tracking and a Modular version for stripping it down.</span></li>
                  <li><a href="${pathToRoot}content/drafts/bare-bones.html">Bare Bones Rules</a><span class="sorc-nav-item-description">Bare Bones rules locked in. Less data and tracking, and easier to manage play. Playable Races only from Zailister.</span></li>
                  <li><a href="${pathToRoot}content/essentia_core/rules_in-the-box.html#in-the-box">In the Box · Sheets &amp; Booklets</a></li>
                  <li><a href="${pathToRoot}content/essentia_core/rules_sorc-cards.html#sorc-cards">SORC Cards · Tracking &amp; Recharge</a></li>
                  ${RULES_CHAPTERS.map((ch, idx) => `
                    <li class="sorc-nav-chapter">
                      <details class="sorc-nav-details">
                        <summary class="sorc-nav-chapter-title"><a href="${pathToRoot}content/essentia_core/${ch.file}#${ch.subsections[0]?.id || ''}">Ch. ${idx + 1}: ${ch.name}</a></summary>
                        <ul class="sorc-nav-subsections">
                          ${ch.subsections.map(sub => `
                            <li><a href="${pathToRoot}content/essentia_core/${ch.file}#${sub.id}">${sub.name}</a></li>
                          `).join('')}
                        </ul>
                      </details>
                    </li>
                  `).join('')}
                  <li class="sorc-nav-chapter">
                    <a class="sorc-nav-chapter-title" href="${pathToRoot}content/essentia_core/rules-index.html#chapter-6">Full Index Ch. 6 - 18</a>
                  </li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="trials-of-combat" aria-expanded="false" aria-controls="trials-of-combat-menu">
                  <span class="sorc-nav-section-label">TRIALS OF COMBAT</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <p class="sorc-nav-section-description">Enter tactical challenges and prove yourself in combat.</p>
                <ul class="sorc-nav-section-menu" id="trials-of-combat-menu">
                  <li><a href="${pathToRoot}content/trials-of-combat-index.html">Trials of Combat Index</a></li>
                  <li><a href="${pathToRoot}content/trials-of-combat.html#war">War · Myriad Scale</a></li>
                </ul>
              </div>

              <a href="${pathToRoot}admin.html" class="sorc-nav-direct-link sorc-sidebar-admin-link" hidden>
                <span class="sorc-nav-section-label">ADMIN PANEL</span>
              </a>

              <button type="button" class="sorc-nav-direct-link sorc-sidebar-signout" hidden>
                <span class="sorc-nav-section-label">SIGN OUT</span>
              </button>
            </div>
          </div>

          <!-- Navigation Overlay -->
          <div class="sorc-nav-overlay"></div>
        </nav>
        ${brandBannerHTML}

        <a class="sorc-floating-profile-link" href="${pathToRoot}content/auth/signin.html" aria-label="Sign in">
          <span class="sorc-floating-profile-avatar sorc-visitor-avatar">W</span>
        </a>

      </div>
    `;

    // Inject into body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  mountProfileBadge() {
    const legacyControls = document.getElementById('headerControls');
    if (legacyControls) legacyControls.remove();

    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('sorc_user') || 'null');
    } catch (error) {
      user = null;
    }
    const isSignedIn = !!(user && user.authKey);
    const displayName = isSignedIn
      ? (user.username || user.display_name || user.email || 'Adventurer')
      : 'Sign in';
    const effectiveRole = isSignedIn ? this.getEffectiveRole(user) : 'CIVILIAN';
    const role = isSignedIn ? this.getRoleLabel(effectiveRole) : 'Guest';
    const card = document.querySelector('.sorc-sidebar-profile-card');
    const avatar = document.querySelector('.sorc-sidebar-profile-avatar');
    const name = document.querySelector('.sorc-sidebar-profile-name');
    const roleLabel = document.querySelector('.sorc-sidebar-profile-role');
    const identity = document.querySelector('.sorc-sidebar-profile-identity');
    const membershipLabel = document.querySelector('.sorc-sidebar-profile-membership');
    const adminLink = document.querySelector('.sorc-sidebar-admin-link');
    const signout = document.querySelector('.sorc-sidebar-signout');
    const floatingLink = document.querySelector('.sorc-floating-profile-link');
    const floatingAvatar = document.querySelector('.sorc-floating-profile-avatar');
    if (!card || !avatar || !name || !roleLabel) return;

    card.href = isSignedIn
      ? '/content/features/space.html'
      : '/content/auth/wanderer.html';
    if (floatingLink) {
      floatingLink.href = card.href;
      floatingLink.setAttribute(
        'aria-label',
        isSignedIn ? `Open ${displayName}'s Space` : 'Wanderer welcome page'
      );
    }
    name.textContent = displayName;
    roleLabel.textContent = role;
    if (identity) {
      const roleTone = this.getRoleTone(effectiveRole);
      identity.classList.remove('role-civ', 'role-player', 'role-gm', 'role-owner');
      identity.classList.add(`role-${roleTone}`);
    }
    if (membershipLabel) {
      const tier = isSignedIn ? this.getMembershipLabel(user) : '';
      membershipLabel.textContent = tier ? `${tier.toUpperCase()} ⭐` : '';
      membershipLabel.hidden = !isSignedIn;
      membershipLabel.classList.toggle('basic', tier === 'Basic');
      membershipLabel.classList.toggle('pro', tier === 'Pro');
    }
    const initial = isSignedIn
      ? (displayName.trim().charAt(0).toUpperCase() || 'S')
      : 'W';
    avatar.textContent = initial;
    if (floatingAvatar) floatingAvatar.textContent = initial;
    if (isSignedIn && user.avatar) {
      const makeImage = (target) => {
        const image = document.createElement('img');
        image.src = `/images/avatars/${user.avatar}`;
        image.alt = '';
        image.addEventListener('error', () => {
          image.remove();
          target.textContent = initial;
        });
        target.textContent = '';
        target.appendChild(image);
      };
      makeImage(avatar);
      if (floatingAvatar) makeImage(floatingAvatar);
    }

    const canAdmin = effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
    if (adminLink) adminLink.hidden = !canAdmin;
    if (signout) {
      signout.hidden = !isSignedIn;
      signout.onclick = () => {
        if (typeof window.sorcSignOut === 'function') window.sorcSignOut();
        else {
          localStorage.removeItem('sorc_user');
          window.location.reload();
        }
      };
    }
  }

  getMembershipLabel(user) {
    const membership = String(user.membership || user.membership_status || '').toLowerCase();
    const isPro = user.is_pro === true
      || user.is_pro === 1
      || membership === 'pro'
      || user.pro_member === true
      || user.box_set_redeemed === true
      || user.isPro === true;
    return isPro ? 'Pro' : 'Basic';
  }

  getEffectiveRole(user) {
    const storedRole = String(user.role || '').toUpperCase();
    const email = String(user.email || '').trim().toLowerCase();
    if (storedRole === 'OWNER' || email === 'corbett@sorcrpg.com') return 'OWNER';
    if (storedRole === 'ADMIN' || email === 'markcorbett.mii@gmail.com') return 'ADMIN';
    return storedRole || 'CIVILIAN';
  }

  getRoleLabel(role) {
    const normalizedRole = String(role || '').toUpperCase();
    if (normalizedRole === 'OWNER') return 'OWN';
    if (normalizedRole === 'ADMIN') return 'Admin';
    if (['GM', 'MASTER', 'GAME_MASTER'].includes(normalizedRole)) return 'GM';
    if (normalizedRole === 'PLAYER') return 'PC';
    return 'CIV';
  }

  getRoleTone(role) {
    const normalizedRole = String(role || '').toUpperCase();
    if (normalizedRole === 'PLAYER') return 'player';
    if (['GM', 'MASTER', 'GAME_MASTER', 'ADMIN'].includes(normalizedRole)) {
      return 'gm';
    }
    if (normalizedRole === 'OWNER') return 'owner';
    return 'civ';
  }

  refreshAuthenticatedUser() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem('sorc_user') || 'null');
    } catch (error) {
      saved = null;
    }
    if (!saved || !saved.authKey) return;

    fetch('https://api.sorcrpg.com/api/me', {
      headers: { 'X-Auth-Key': saved.authKey }
    }).then((response) => {
      if (response.status === 401) {
        localStorage.removeItem('sorc_user');
        this.mountProfileBadge();
        this.loadUserProfile();
        return null;
      }
      if (!response.ok) return null;
      return response.json();
    }).then((data) => {
      if (!data || !data.user) return;
      localStorage.setItem('sorc_user', JSON.stringify({
        ...saved,
        ...data.user,
        authKey: saved.authKey
      }));
      this.mountProfileBadge();
      this.loadUserProfile();
    }).catch(() => {});
  }

  getPathToRoot() {
    // Detect depth based on current URL path
    const path = window.location.pathname;
    const depth = (path.match(/\//g) || []).length - 1; // -1 for leading slash

    // Calculate relative path based on page depth:
    // depth 0: root level (/index.html) -> no path needed
    // depth 1: content level (/content/file.html) -> go up one level
    // depth 2: subdirectory level (/content/subdir/file.html) -> go up two levels
    // depth 3+: deeper levels -> go up accordingly
    if (depth >= 3) {
      return '../../../';
    } else if (depth === 2) {
      return '../../';
    } else if (depth === 1) {
      return '../';
    }
    return ''; // depth 0: already at root, no path needed
  }

  attachEventListeners() {
    // Hamburger menu toggle
    const menuToggle = document.querySelector('.sorc-nav-toggle');
    const sidebar = document.querySelector('.sorc-nav-sidebar');
    const overlay = document.querySelector('.sorc-nav-overlay');
    const closeBtn = document.querySelector('.sorc-nav-close');

    if (menuToggle) {
      menuToggle.addEventListener('click', () => this.toggleMenu());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeMenu());
    }

    if (overlay) {
      overlay.addEventListener('click', () => this.closeMenu());
    }

    // "Delve" searches the destinations exposed by the global navigation.
    // Enter opens the best matching destination without sending the query
    // to an unrelated third-party search engine.
    const searchInput = document.querySelector('.sorc-nav-search-input');
    if (searchInput) {
      const destinations = Array.from(
        document.querySelectorAll('.sorc-nav-sidebar a[href]')
      ).map((link) => ({
        label: (link.textContent || '').trim().toLowerCase(),
        href: link.href,
      })).filter((item) => item.label);

      searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          searchInput.value = '';
          searchInput.blur();
          return;
        }
        if (event.key !== 'Enter') return;

        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
          this.openMenu();
          return;
        }
        const match = destinations.find((item) => item.label === query)
          || destinations.find((item) => item.label.startsWith(query))
          || destinations.find((item) => item.label.includes(query));
        if (match) window.location.href = match.href;
      });
    }

    // Section toggles
    const sectionToggles = document.querySelectorAll('.sorc-nav-section-toggle');
    sectionToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const section = toggle.dataset.section;
        this.toggleSection(section, e.currentTarget);
      });
    });

    // Avatar menu toggle
    const avatarBtn = document.querySelector('.sorc-avatar-button');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => this.toggleAvatarMenu());
    }

    // Close avatar menu when clicking outside
    document.addEventListener('click', (e) => {
      const avatar = document.querySelector('.sorc-avatar-floating');
      if (avatar && !avatar.contains(e.target)) {
        this.closeAvatarMenu();
      }
    });

    // Close menu on link click (submenu links)
    const navLinks = document.querySelectorAll('.sorc-nav-section-menu a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => this.closeMenu());
    });

    // Close menu on direct link click
    const directLinks = document.querySelectorAll('.sorc-nav-direct-link');
    directLinks.forEach(link => {
      link.addEventListener('click', () => this.closeMenu());
    });
  }

  toggleMenu() {
    this.isMenuOpen ? this.closeMenu() : this.openMenu();
  }

  openMenu() {
    const sidebar = document.querySelector('.sorc-nav-sidebar');
    const toggle = document.querySelector('.sorc-nav-toggle');
    if (sidebar) {
      sidebar.classList.add('open');
      this.isMenuOpen = true;
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  }

  closeMenu() {
    const sidebar = document.querySelector('.sorc-nav-sidebar');
    const toggle = document.querySelector('.sorc-nav-toggle');
    if (sidebar) {
      sidebar.classList.remove('open');
      this.isMenuOpen = false;
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  }

  toggleSection(section, button) {
    const menu = document.getElementById(`${section}-menu`);
    if (!menu) return;

    const isExpanded = menu.classList.contains('expanded');
    document.querySelectorAll('.sorc-nav-section-menu.expanded').forEach((openMenu) => {
      openMenu.classList.remove('expanded');
      const openButton = document.querySelector(
        `.sorc-nav-section-toggle[aria-controls="${openMenu.id}"]`
      );
      if (openButton) {
        openButton.classList.remove('expanded');
        openButton.setAttribute('aria-expanded', 'false');
      }
    });

    if (!isExpanded) {
      menu.classList.add('expanded');
      button.classList.add('expanded');
      button.setAttribute('aria-expanded', 'true');
    }
  }

  toggleAvatarMenu() {
    const menu = document.querySelector('.sorc-avatar-menu');
    const btn = document.querySelector('.sorc-avatar-button');
    if (menu) {
      menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', menu.classList.contains('open'));
    }
  }

  closeAvatarMenu() {
    const menu = document.querySelector('.sorc-avatar-menu');
    const btn = document.querySelector('.sorc-avatar-button');
    if (menu) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  loadUserProfile() {
    // TODO: Load from localStorage or API
    // For now, use placeholder data
    const usernamEl = document.querySelector('.sorc-avatar-username');
    const tierEl = document.querySelector('.sorc-avatar-tier');

    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('sorc_user') || 'null');
    } catch (error) {
      user = null;
    }
    const isSignedIn = !!(user && user.authKey);
    const username = isSignedIn
      ? (user.username || user.display_name || user.email || 'Adventurer')
      : 'Guest';
    const tier = isSignedIn ? this.getMembershipLabel(user) : 'Guest';

    if (usernamEl) usernamEl.textContent = username;
    if (tierEl) tierEl.textContent = tier;
  }

  initThemeToggle() {
    const themeToggle = document.querySelector('.sorc-avatar-theme-toggle');
    if (!themeToggle) return;

    // Load saved theme preference (default: lawful mode)
    const savedTheme = localStorage.getItem('themeSelected') || 'lawful';
    const isLawful = savedTheme === 'lawful';

    // Set initial state
    this.applyTheme(isLawful);
    themeToggle.setAttribute('aria-pressed', isLawful ? 'false' : 'true');

    // Toggle handler
    themeToggle.addEventListener('click', () => {
      const currentLawful = document.body.classList.contains('lawful-mode');
      this.applyTheme(!currentLawful);
      themeToggle.setAttribute('aria-pressed', !currentLawful ? 'false' : 'true');
    });
  }

  applyTheme(isLawful) {
    if (isLawful) {
      document.body.classList.add('lawful-mode');
      document.body.classList.remove('evil-mode');
      localStorage.setItem('themeSelected', 'lawful');
    } else {
      document.body.classList.remove('lawful-mode');
      document.body.classList.add('evil-mode');
      localStorage.setItem('themeSelected', 'evil');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SORCNavigation();
  });
} else {
  new SORCNavigation();
}
