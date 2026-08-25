// ========== THEME SYSTEM ==========
if (typeof sorcSyncHtmlBg !== 'function') {
  var sorcSyncHtmlBg = function(isLawful) {
    document.documentElement.style.background = isLawful ? '#f5f5f0' : '#0a0a0a';
  };
}
(function() {
  var savedTheme = localStorage.getItem('themeSelected') || 'lawful';
  if (savedTheme === 'lawful') {
    document.body.classList.add('lawful-mode');
  }
  sorcSyncHtmlBg(savedTheme === 'lawful');
})();

document.addEventListener('DOMContentLoaded', function() {

  // ========== THEME BUTTONS ==========
  var evilBtn = document.querySelector('.theme-toggle-btn.evil');
  var lawfulBtn = document.querySelector('.theme-toggle-btn.lawful');
  if (evilBtn && lawfulBtn) {
    function updateButtonStates() {
      var currentTheme = localStorage.getItem('themeSelected') || 'lawful';
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
      sorcSyncHtmlBg(false);
      updateButtonStates();
    });
    lawfulBtn.addEventListener('click', function() {
      localStorage.setItem('themeSelected', 'lawful');
      document.body.classList.add('lawful-mode');
      sorcSyncHtmlBg(true);
      updateButtonStates();
    });
  }

  // ========== HAMBURGER MENU ==========
  var menuToggle = document.getElementById('menuToggle');
  var navLinks = document.getElementById('navLinks');
  var closeLink = document.getElementById('closeLink');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });
    // Close menu when clicking anywhere outside it
    document.addEventListener('click', function(e) {
      if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
        navLinks.classList.remove('active');
      }
    });
  }
  if (closeLink && navLinks) {
    closeLink.addEventListener('click', function(e) {
      e.preventDefault();
      navLinks.classList.remove('active');
    });
  }

  // ========== CURRENT PAGE NAV ==========
  var currentLinks = document.querySelectorAll('.current-section');
  currentLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
    });
  });

});
