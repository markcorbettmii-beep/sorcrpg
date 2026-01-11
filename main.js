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

