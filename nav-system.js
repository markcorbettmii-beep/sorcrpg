/**
 * SORC Navigation System
 * D&D Beyond-style hamburger menu, badge, and floating avatar
 * Works on all pages with proper theme support (lawful/dark)
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

class SORCNavigation {
  constructor() {
    this.isMenuOpen = false;
    this.init();
  }

  init() {
    this.injectNavigationHTML();
    this.attachEventListeners();
    this.loadUserProfile();
    this.initThemeToggle();
  }

  injectNavigationHTML() {
    // Get the correct path to root based on current page depth
    const pathToRoot = this.getPathToRoot();

    const navHTML = `
      <div id="sorc-nav-wrapper" class="sorc-nav-wrapper">
        <!-- Hamburger Menu -->
        <nav class="sorc-nav">
          <!-- Home Icon (Far Left) -->
          <a href="${pathToRoot}index.html" class="sorc-nav-home-icon" aria-label="Home">
            &#8962;
          </a>

          <!-- Right Side Controls (Search, Hamburger) -->
          <div class="sorc-nav-right">
            <!-- Search Bar -->
            <div class="sorc-nav-search-container">
              <svg class="sorc-nav-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input type="text" class="sorc-nav-search-input" placeholder="Delve" aria-label="Search">
            </div>

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
              <a href="${pathToRoot}index.html" class="sorc-nav-logo">SORC Web</a>
              <button class="sorc-nav-close" aria-label="Close menu">✕</button>
            </div>

            <div class="sorc-nav-content">
              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="play">
                  <span class="sorc-nav-section-label">PLAY</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <ul class="sorc-nav-section-menu" id="play-menu">
                  <li><a href="${pathToRoot}content/features/lobbies.html">Lobbies</a></li>
                  <li><a href="${pathToRoot}content/features/room.html">Room</a></li>
                  <li><a href="${pathToRoot}content/features/trading-post.html">Trading Post</a></li>
                  <li><a href="${pathToRoot}content/features/trials-of-combat.html">Trials of Combat</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="rules">
                  <span class="sorc-nav-section-label">RULES</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <ul class="sorc-nav-section-menu" id="rules-menu">
                  <li><a href="${pathToRoot}content/essentia_core/rules-index.html">Rules Index</a></li>
                  ${RULES_CHAPTERS.map((ch, idx) => `
                    <li class="sorc-nav-chapter">
                      <details class="sorc-nav-details">
                        <summary class="sorc-nav-chapter-title">Ch. ${idx + 1}: ${ch.name}</summary>
                        <ul class="sorc-nav-subsections">
                          ${ch.subsections.map(sub => `
                            <li><a href="${pathToRoot}content/essentia_core/${ch.file}#${sub.id}">${sub.name}</a></li>
                          `).join('')}
                        </ul>
                      </details>
                    </li>
                  `).join('')}
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="library">
                  <span class="sorc-nav-section-label">LIBRARY</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <ul class="sorc-nav-section-menu" id="library-menu">
                  <li><a href="${pathToRoot}library.html">Library</a></li>
                  <li><a href="${pathToRoot}content/tomes/heroes-hermits.html">Tomes</a></li>
                  <li><a href="${pathToRoot}content/reference/talents.html">Talents</a></li>
                  <li><a href="${pathToRoot}content/classes/main-class-tree-avenger.html">Classes</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="community">
                  <span class="sorc-nav-section-label">COMMUNITY</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <ul class="sorc-nav-section-menu" id="community-menu">
                  <li><a href="${pathToRoot}content/features/leaderboard.html">Leaderboard</a></li>
                  <li><a href="${pathToRoot}content/features/fellowships.html">Fellowships</a></li>
                  <li><a href="${pathToRoot}content/features/forum.html">Forums</a></li>
                  <li><a href="${pathToRoot}content/features/threads.html">Threads</a></li>
                </ul>
              </div>

              <div class="sorc-nav-section">
                <button class="sorc-nav-section-toggle" data-section="marketplace">
                  <span class="sorc-nav-section-label">MARKETPLACE</span>
                  <span class="sorc-nav-section-icon">›</span>
                </button>
                <ul class="sorc-nav-section-menu" id="marketplace-menu">
                  <li><a href="${pathToRoot}content/features/sorc-store.html">SORC Store</a></li>
                  <li><a href="${pathToRoot}content/features/exchange.html">Essentia Exchange</a></li>
                  <li><a href="${pathToRoot}content/features/collection.html">Collection</a></li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Navigation Overlay -->
          <div class="sorc-nav-overlay"></div>
        </nav>

        <!-- Badge Component (Membership Status) -->
        <div class="sorc-badge">
          <span class="sorc-badge-tier">Basic</span>
          <span class="sorc-badge-icon">⭐</span>
        </div>

        <!-- Floating Avatar Component -->
        <div class="sorc-avatar-floating">
          <button class="sorc-avatar-button" aria-label="Open user profile menu" aria-expanded="false">
            <div class="sorc-avatar-circle">
              <span class="sorc-avatar-placeholder">U</span>
            </div>
            <span class="sorc-avatar-dropdown">▼</span>
          </button>
          <div class="sorc-avatar-menu">
            <div class="sorc-avatar-header">
              <div class="sorc-avatar-circle-large">
                <span class="sorc-avatar-placeholder">U</span>
              </div>
              <div class="sorc-avatar-info">
                <div class="sorc-avatar-username">User</div>
                <div class="sorc-avatar-tier">Basic Member</div>
              </div>
            </div>
            <div class="sorc-avatar-menu-divider"></div>

            <!-- Theme Toggle Inside Avatar Menu -->
            <div class="sorc-avatar-theme-toggle-wrapper">
              <button class="sorc-avatar-theme-toggle" aria-label="Toggle theme (Lawful/Evil mode)" aria-pressed="false">
                <span class="sorc-theme-label lawful">LAWFUL</span>
                <span class="sorc-theme-label evil">EVIL</span>
              </button>
            </div>

            <div class="sorc-avatar-menu-divider"></div>
            <ul class="sorc-avatar-menu-list">
              <li><a href="${pathToRoot}content/features/characters-home.html">My Characters</a></li>
              <li><a href="${pathToRoot}content/features/achievements.html">Achievements</a></li>
              <li><a href="${pathToRoot}content/features/vault.html">Vault</a></li>
              <li><a href="${pathToRoot}content/auth/public-profile.html">Profile</a></li>
              <li class="sorc-avatar-menu-divider"></li>
              <li><a href="${pathToRoot}content/pages/new-pro.html">Upgrade to Pro</a></li>
              <li><a href="${pathToRoot}content/pages/subscriptions.html">Subscriptions</a></li>
              <li class="sorc-avatar-menu-divider"></li>
              <li><a href="${pathToRoot}content/auth/signin.html">Sign Out</a></li>
            </ul>
          </div>
        </div>
      </div>
    `;

    // Inject into body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  getPathToRoot() {
    // Detect depth based on current URL path
    const path = window.location.pathname;
    const depth = (path.match(/\//g) || []).length - 1; // -1 for leading slash

    // Most pages are 2 levels deep (content/subdir/page.html)
    if (depth >= 3) {
      return '../../../';
    } else if (depth >= 2) {
      return '../../';
    }
    return '../';
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

    // Close menu on link click
    const navLinks = document.querySelectorAll('.sorc-nav-section-menu a');
    navLinks.forEach(link => {
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
    if (menu) {
      menu.classList.toggle('expanded');
      button.classList.toggle('expanded');
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

    const username = localStorage.getItem('sorc_username') || 'Adventurer';
    const tier = localStorage.getItem('sorc_tier') || 'Basic Member';

    if (usernamEl) usernamEl.textContent = username;
    if (tierEl) tierEl.textContent = tier;
  }

  initThemeToggle() {
    const themeToggle = document.querySelector('.sorc-avatar-theme-toggle');
    if (!themeToggle) return;

    // Load saved theme preference (default: lawful mode)
    const savedTheme = localStorage.getItem('sorc_theme') || 'lawful';
    const isLawful = savedTheme === 'lawful';

    // Set initial state
    this.applyTheme(isLawful);
    themeToggle.setAttribute('aria-pressed', isLawful ? 'false' : 'true');

    // Toggle handler
    themeToggle.addEventListener('click', () => {
      const currentLawful = !document.body.classList.contains('lawful-mode');
      this.applyTheme(!currentLawful);
      themeToggle.setAttribute('aria-pressed', !currentLawful ? 'false' : 'true');
    });
  }

  applyTheme(isLawful) {
    if (isLawful) {
      document.body.classList.add('lawful-mode');
      localStorage.setItem('sorc_theme', 'lawful');
    } else {
      document.body.classList.remove('lawful-mode');
      localStorage.setItem('sorc_theme', 'evil');
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
