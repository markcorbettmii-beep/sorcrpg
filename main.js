// Navigation menu logic
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    const closeLink = document.getElementById('closeLink'); // get the close link

    // Toggle menu when hamburger button is clicked
    menuToggle.addEventListener('click', function() {
        navLinks.classList.toggle('active');
    });

    // Close menu when "Close" link is clicked
    closeLink.addEventListener('click', function(e) {
        e.preventDefault(); // prevent default link behavior
        navLinks.classList.remove('active'); // hide menu
    });
});

// SorC Cookie Consent
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

// News Cards Slider
document.addEventListener("DOMContentLoaded", function() {
    const newsCards = document.querySelectorAll('.news-card');
    const rightArrows = document.querySelectorAll('.arrow-right');
    const leftArrows = document.querySelectorAll('.arrow-left');
    let currentIndex = 0;

    // Only show one card at a time
    function showCard(index) {
        newsCards.forEach((card, i) => {
            card.style.display = i === index ? 'flex' : 'none';
        });
    }

    showCard(currentIndex);

    rightArrows.forEach(arrow => {
        arrow.style.pointerEvents = 'auto'; // Make arrow clickable
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
});

// Age verification logic
document.addEventListener('DOMContentLoaded', () => {
  const ageModal = document.getElementById('age-verification');
  const btnYes = document.getElementById('age-yes');
  const btnNo = document.getElementById('age-no');

  // Check if user already verified this session (or store in cookie/localStorage)
  const ageVerified = sessionStorage.getItem('ageVerified');

  if (!ageVerified) {
    // Show modal
    ageModal.style.display = 'flex';
  }

  btnYes.onclick = () => {
    sessionStorage.setItem('ageVerified', 'true');
    ageModal.style.display = 'none';
  };

  btnNo.onclick = () => {
    alert('You must be of age to view this site.');
    // Optionally redirect or close window
    window.location.href = 'https://www.google.com'; // redirect elsewhere
  };
});

// --- Auth0 Google Login detection and persistent login logic ---

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
  // Only show welcome message if not already present
  if (!document.querySelector('.welcome-user')) {
    var welcome = document.createElement('div');
    welcome.className = 'welcome-user';
    welcome.innerHTML = '<h2>Welcome, ' + (userInfo.name || userInfo.email || 'Adventurer') + '!</h2>'
      + '<button id="logoutBtn" style="margin-top:10px;">Logout</button>';
    var legendSection = document.querySelector('.legend');
    if (legendSection) legendSection.insertBefore(welcome, legendSection.firstChild);
    // Add logout logic
    document.getElementById('logoutBtn').onclick = function() {
      localStorage.removeItem('sorc_accessToken');
      localStorage.removeItem('sorc_idToken');
      window.location.reload();
    }
  }
}

function handleAuth0Login() {
  // If Auth0 script is not loaded, skip
  if (typeof auth0 === "undefined" || !auth0.parseHash) return;

  auth0.parseHash(function(err, authResult) {
    if (authResult && authResult.accessToken && authResult.idToken) {
      // Store tokens for persistence
      localStorage.setItem('sorc_accessToken', authResult.accessToken);
      localStorage.setItem('sorc_idToken', authResult.idToken);
      var userInfo = parseJwt(authResult.idToken);
      showWelcomeAndHideSignup(userInfo);
      // Remove hash from URL for cleanliness
      window.location.hash = '';
    } else {
      // On normal page load, check localStorage for tokens
      var storedIdToken = localStorage.getItem('sorc_idToken');
      if (storedIdToken) {
        var userInfo = parseJwt(storedIdToken);
        showWelcomeAndHideSignup(userInfo);
      }
    }
    // Optionally: handle errors here
  });
}

document.addEventListener('DOMContentLoaded', handleAuth0Login);
