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

// Social OAuth Sign-in Button Logic
document.addEventListener('DOMContentLoaded', function() {
    const googleBtn = document.querySelector('.oauth-google');
    const appleBtn = document.querySelector('.oauth-apple');

    if (googleBtn) {
        googleBtn.addEventListener('click', function() {
            window.location.href = '/auth/google'; // Redirect to backend Google OAuth
        });
    }
    if (appleBtn) {
        appleBtn.addEventListener('click', function() {
            window.location.href = '/auth/apple'; // Redirect to backend Apple OAuth
        });
    }
});
