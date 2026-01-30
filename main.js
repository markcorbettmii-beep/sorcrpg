// ========== THEME SYSTEM ==========
// Apply theme immediately (before DOM loads) to prevent flash
(function() {
  var savedTheme = localStorage.getItem('themeSelected') || 'evil';
  if (savedTheme === 'lawful') {
    document.documentElement.classList.add('lawful-mode');
  }
})();

// Theme switching function - call from buttons
function setTheme(theme) {
  localStorage.setItem('themeSelected', theme);
  if (theme === 'lawful') {
    document.body.classList.add('lawful-mode');
    document.documentElement.classList.add('lawful-mode');
  } else {
    document.body.classList.remove('lawful-mode');
    document.documentElement.classList.remove('lawful-mode');
  }
  updateThemeButtons();
}

// Update button active states
function updateThemeButtons() {
  var savedTheme = localStorage.getItem('themeSelected') || 'evil';
  var evilBtns = document.querySelectorAll('.theme-toggle-btn.evil');
  var lawfulBtns = document.querySelectorAll('.theme-toggle-btn.lawful');
  
  evilBtns.forEach(function(btn) {
    btn.classList.toggle('active', savedTheme === 'evil');
  });
  lawfulBtns.forEach(function(btn) {
    btn.classList.toggle('active', savedTheme === 'lawful');
  });
}

 // ========== FOOTER INJECTION ==========
function injectFooter() {
  var footerDiv = document.getElementById('footer');
  if (footerDiv) {
    footerDiv.innerHTML = `
      <footer>
        <p>&copy; 2025 SorC RPG. All rights reserved.</p>
        <p>
          <a href="terms.html">Terms of Service</a> |
          <a href="privacy.html">Privacy Policy</a> |
          <a href="conduct.html">Code of Conduct</a> |
          <a href="mailto:corbett@sorcrpg.com">corbett@sorcrpg.com</a>
        </p>
      </footer>
    `;
  }
}

// ========== NAVIGATION MENU ==========
function initNavMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const closeLink = document.getElementById('closeLink');

  if (menuToggle) {
    menuToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });
  }

  if (closeLink) {
    closeLink.addEventListener('click', function(e) {
      e.preventDefault();
      navLinks.classList.remove('active');
    });
  }
}

// ========== COOKIE CONSENT ==========
function initCookieConsent() {
  var cookieConsent = document.getElementById('cookieConsent');
  var acceptBtn = document.getElementById('acceptCookiesBtn');
  var hasConsent = localStorage.getItem('sorcCookieConsent') === 'true';

  if (!hasConsent && cookieConsent) {
    cookieConsent.style.display = 'block';
  }

  if (acceptBtn) {
    acceptBtn.onclick = function() {
      localStorage.setItem('sorcCookieConsent', 'true');
      cookieConsent.style.display = 'none';
    };
  }
}

// ========== NEWS CARDS SLIDER ==========
function initNewsSlider() {
  const newsCards = document.querySelectorAll('.news-card');
  const rightArrows = document.querySelectorAll('.arrow-right');
  const leftArrows = document.querySelectorAll('.arrow-left');
  let currentIndex = 0;

  if (newsCards.length === 0) return;

  function showCard(index) {
    newsCards.forEach((card, i) => {
      card.style.display = i === index ? 'flex' : 'none';
    });
  }

  showCard(currentIndex);

  rightArrows.forEach(arrow => {
    arrow.style.pointerEvents = 'auto';
    arrow.addEventListener('click', function(e) {
      e.stopPropagation();
      currentIndex = (currentIndex + 1) % newsCards.length;
      showCard(currentIndex);
    });
  });

  leftArrows.forEach(arrow => {
    arrow.style.pointerEvents = 'auto';
    arrow.addEventListener('click', function(e) {
      e.stopPropagation();
      currentIndex = (currentIndex - 1 + newsCards.length) % newsCards.length;
      showCard(currentIndex);
    });
  });
}

// ========== AGE VERIFICATION ==========
function initAgeVerification() {
  const ageModal = document.getElementById('age-verification');
  const btnYes = document.getElementById('age-yes');
  const btnNo = document.getElementById('age-no');

  if (!ageModal) return;

  const ageVerified = sessionStorage.getItem('ageVerified');

  if (!ageVerified) {
    ageModal.style.display = 'flex';
  }

  if (btnYes) {
    btnYes.onclick = () => {
      sessionStorage.setItem('ageVerified', 'true');
      ageModal.style.display = 'none';
    };
  }

  if (btnNo) {
    btnNo.onclick = () => {
      alert('You must be of age to view this site.');
      window.location.href = 'https://www.google.com';
    };
  }
}

// ========== AUTH0 LOGIN ==========
function parseJwt(token) {
  try {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
  }
}

function showWelcomeAndHideSignup(userInfo) {
  var signups = document.querySelectorAll('.signup-card.legend-signup');
  signups.forEach(function(card) {
    card.style.display = 'none';
  });

  if (!document.querySelector('.welcome-user')) {
    var welcome = document.createElement('div');
    welcome.className = 'welcome-user';
    welcome.innerHTML = '<h2>Welcome, ' + (userInfo.name || userInfo.email || 'Adventurer') + '!</h2>'
      + '<button id="logoutBtn" style="margin-top:10px;">Logout</button>';
    var legendSection = document.querySelector('.legend');
    if (legendSection) legendSection.insertBefore(welcome, legendSection.firstChild);

    document.getElementById('logoutBtn').onclick = function() {
      localStorage.removeItem('sorc_accessToken');
      localStorage.removeItem('sorc_idToken');
      window.location.reload();
    };
  }
}

function handleAuth0Login() {
  if (typeof auth0 === "undefined" || !auth0.parseHash) return;

  auth0.parseHash(function(err, authResult) {
    if (authResult && authResult.accessToken && authResult.idToken) {
      localStorage.setItem('sorc_accessToken', authResult.accessToken);
      localStorage.setItem('sorc_idToken', authResult.idToken);
      var userInfo = parseJwt(authResult.idToken);
      showWelcomeAndHideSignup(userInfo);
      window.location.hash = '';
    } else {
      var storedIdToken = localStorage.getItem('sorc_idToken');
      if (storedIdToken) {
        var userInfo = parseJwt(storedIdToken);
        showWelcomeAndHideSignup(userInfo);
      }
    }
  });
}

// ========== INITIALIZE EVERYTHING ==========
document.addEventListener('DOMContentLoaded', function() {
  // Apply theme to body (documentElement already handled above)
  var savedTheme = localStorage.getItem('themeSelected') || 'evil';
  if (savedTheme === 'lawful') {
    document.body.classList.add('lawful-mode');
  }
  
  updateThemeButtons();
  injectFooter();
  initNavMenu();
  initCookieConsent();
  initNewsSlider();
  initAgeVerification();
  handleAuth0Login();
});
