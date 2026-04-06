// ========== THEME SYSTEM ==========
(function() {
  var savedTheme = localStorage.getItem('themeSelected') || 'evil';
  if (savedTheme === 'lawful') {
    document.body.classList.add('lawful-mode');
  }
})();

document.addEventListener('DOMContentLoaded', function() {
  var evilBtn = document.querySelector('.theme-toggle-btn.evil') || document.getElementById('theme-evil');
  var lawfulBtn = document.querySelector('.theme-toggle-btn.lawful') || document.getElementById('theme-lawful');
  
  if (evilBtn && lawfulBtn) {
    function updateButtonStates() {
      var currentTheme = localStorage.getItem('themeSelected') || 'evil';
      if (currentTheme === 'evil') {
        evilBtn.classList.add('active');
        lawfulBtn.classList.remove('active');
      } else {
        lawfulBtn.classList.add('active');
        evilBtn.classList.remove('active');
      }
    }
    
    updateButtonStates();
    
    evilBtn.addEventListener('click', function() {
      localStorage.setItem('themeSelected', 'evil');
      document.body.classList.remove('lawful-mode');
      updateButtonStates();
    });
    
    lawfulBtn.addEventListener('click', function() {
      localStorage.setItem('themeSelected', 'lawful');
      document.body.classList.add('lawful-mode');
      updateButtonStates();
    });
  }
});

// ========== FOOTER INJECTION ==========
document.addEventListener('DOMContentLoaded', function() {
  var footerDiv = document.getElementById('footer');
  if (footerDiv) {
    footerDiv.innerHTML = '<footer>' +
      '<div class="container">' +
        '<p>&copy; 2025 Slayers of Rings &sect; Crowns by Ogre Adventurer. All rights reserved.</p>' +
        '<nav class="footer-links">' +
          '<a href="/terms.html">Terms of Service</a>' +
          '<a href="/privacy.html">Privacy Policy</a>' +
          '<a href="/conduct.html">Code of Conduct</a>' +
          '<a href="mailto:corbett@sorcrpg.com">Contact</a>' +
        '</nav>' +
      '</div>' +
    '</footer>';
  }
});

// ========== NAVIGATION MENU ==========
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const closeLink = document.getElementById('closeLink');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });

    if (closeLink) {
      closeLink.addEventListener('click', function(e) {
        e.preventDefault();
        navLinks.classList.remove('active');
      });
    }
  }
});

// ========== COOKIE CONSENT ==========
document.addEventListener("DOMContentLoaded", function() {
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
});

// ========== NEWS CARDS SLIDER ==========
document.addEventListener("DOMContentLoaded", function() {
  const newsCards = document.querySelectorAll('.news-card');
  const rightArrows = document.querySelectorAll('.arrow-right');
  const leftArrows = document.querySelectorAll('.arrow-left');
  let currentIndex = 0;

  if (newsCards.length > 0) {
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
});

// ========== AGE VERIFICATION ==========
document.addEventListener('DOMContentLoaded', function() {
  const ageModal = document.getElementById('age-verification');
  const btnYes = document.getElementById('age-yes');
  const btnNo = document.getElementById('age-no');

  if (ageModal && btnYes && btnNo) {
    const ageVerified = sessionStorage.getItem('ageVerified');

    if (!ageVerified) {
      ageModal.style.display = 'flex';
    }

    btnYes.onclick = function() {
      sessionStorage.setItem('ageVerified', 'true');
      ageModal.style.display = 'none';
    };

    btnNo.onclick = function() {
      alert('You must be of age to view this site.');
      window.location.href = 'https://www.google.com';
    };
  }
});

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
    }
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

document.addEventListener('DOMContentLoaded', handleAuth0Login);

// ========== GOOGLE LOGIN ==========
window.handleGoogleCredential = function(response) {
  var userInfo = parseJwt(response.credential);
  localStorage.setItem('sorc_idToken', response.credential);
  showWelcomeAndHideSignup(userInfo);
};

document.addEventListener('DOMContentLoaded', function() {
  var googleBtns = document.querySelectorAll('.oauth-google');
  googleBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      google.accounts.id.initialize({
        client_id: '72029996593-u4lf2ocdpm257rbq495o1kvoecqc8mbk.apps.googleusercontent.com',
        callback: handleGoogleCredential
      });
      google.accounts.id.prompt();
    });
  });
});
