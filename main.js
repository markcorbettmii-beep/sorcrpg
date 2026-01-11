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
